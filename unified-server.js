import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import pkg from "aws-sdk";
import { invokeModelViaHttp } from "./src/server/bedrock.js";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import fetch from "node-fetch";

dotenv.config();

// Configure AWS credentials
if (process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY) {
  pkg.config.update({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION || "us-east-1",
  });
  console.log("✅ AWS credentials configured");
} else {
  console.warn("⚠️ AWS credentials not found in environment variables");
}

const { S3, DynamoDB } = pkg;
const app = express();
const PORT = process.env.PORT || 8081;
const REGION = process.env.REGION || "us-east-1";
const TEXT_MODEL = process.env.TEXT_MODEL;
const IMAGE_MODEL = process.env.IMAGE_MODEL;
const S3_BUCKET = process.env.S3_BUCKET;
const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE || "Schedules";

// Environment detection
const isProduction = process.env.NODE_ENV === "production";
const FRONTEND_URL = process.env.FRONTEND_URL;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Cognito configuration
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET;
const COGNITO_DOMAIN =
  process.env.COGNITO_DOMAIN ||
  "https://us-east-1lnmmjkyb9.auth.us-east-1.amazoncognito.com";

// X API configuration
const X_CLIENT_ID = process.env.VITE_X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.VITE_X_CLIENT_SECRET;
const X_REDIRECT_URI = process.env.VITE_X_REDIRECT_URI;
const X_API_BASE_URL = "https://api.twitter.com/2";
const X_UPLOAD_URL = "https://upload.twitter.com/1.1";

// LinkedIn API configuration
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:8080/Callback';
const LINKEDIN_API_BASE_URL = 'https://api.linkedin.com/v2';

// CORS configuration
// Configure CORS to allow the frontend and local development origins
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:8080",
  "http://localhost:8082",
].filter(Boolean);
console.log("CORS allowed origins:", allowedOrigins.join(", "));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      console.warn("Blocked CORS request from origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Ensure preflight OPTIONS requests are handled
// Note: explicit app.options handler removed because it caused path parsing errors

// Configure body parsing with increased limits for image uploads
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Configure session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

const s3 = new S3({ region: REGION });
const DDB = new DynamoDB.DocumentClient({ region: REGION });

// Helper function to update Node/Schedule with X posting details
async function updateNodeWithXPostingDetails({
  nodeId,
  scheduleId,
  tweetId,
  tweetUrl,
  postedAt,
  status,
}) {
  try {
    console.log("📝 Updating database with X posting details...", {
      nodeId,
      scheduleId,
      tweetId,
    });

    if (nodeId) {
      // Update Node in the database
      // This assumes you have a Node table with the ID as primary key
      // You'll need to adjust the TableName and key structure based on your actual setup
      const updateParams = {
        TableName: "Node", // Adjust table name as needed
        Key: { id: nodeId },
        UpdateExpression:
          "SET xTweetId = :tweetId, xTweetUrl = :tweetUrl, xPostedAt = :postedAt, xPostStatus = :status",
        ExpressionAttributeValues: {
          ":tweetId": tweetId,
          ":tweetUrl": tweetUrl,
          ":postedAt": postedAt,
          ":status": status,
        },
        ReturnValues: "UPDATED_NEW",
      };

      const result = await DDB.update(updateParams).promise();
      console.log("✅ Node updated with X posting details:", result.Attributes);
    }

    if (scheduleId) {
      // Update Schedule in the database
      const updateParams = {
        TableName: SCHEDULES_TABLE,
        Key: { id: scheduleId },
        UpdateExpression:
          "SET xTweetId = :tweetId, xTweetUrl = :tweetUrl, xPostedAt = :postedAt, xPostStatus = :status",
        ExpressionAttributeValues: {
          ":tweetId": tweetId,
          ":tweetUrl": tweetUrl,
          ":postedAt": postedAt,
          ":status": status,
        },
        ReturnValues: "UPDATED_NEW",
      };

      const result = await DDB.update(updateParams).promise();
      console.log(
        "✅ Schedule updated with X posting details:",
        result.Attributes
      );
    }
  } catch (error) {
    console.error(
      "❌ Failed to update database with X posting details:",
      error
    );
    // Don't throw error - we don't want to fail the posting just because DB update failed
  }
}

// ============ X TOKEN MANAGEMENT ============

class XTokenManager {
  static TOKEN_FILE_PATH = join(process.cwd(), "x_tokens.json");

  static getStoredTokens() {
    try {
      const tokenData = readFileSync(this.TOKEN_FILE_PATH, "utf8");
      const tokens = JSON.parse(tokenData);

      // Calculate expires_at if not present but expires_in is available
      if (!tokens.expires_at && tokens.expires_in) {
        const now = Math.floor(Date.now() / 1000);
        tokens.expires_at = now + tokens.expires_in;
      }

      return tokens;
    } catch (error) {
      console.log("No stored X tokens found or invalid format");
      return null;
    }
  }

  static saveTokens(tokens) {
    try {
      // Add expires_at timestamp if not present
      if (!tokens.expires_at && tokens.expires_in) {
        const now = Math.floor(Date.now() / 1000);
        tokens.expires_at = now + tokens.expires_in;
      }

      writeFileSync(this.TOKEN_FILE_PATH, JSON.stringify(tokens, null, 2));
      console.log('✅ X tokens saved successfully');
    } catch (error) {
      console.error('❌ Failed to save X tokens:', error);
      throw error;
    }
  }

  static isTokenValid(tokens) {
    if (!tokens || !tokens.access_token) {
      return false;
    }

    // If no expiration info, assume it might be valid (let API decide)
    if (!tokens.expires_at) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5 minutes buffer

    return tokens.expires_at > now + bufferTime;
  }

  static async refreshAccessToken() {
    const currentTokens = this.getStoredTokens();

    if (!currentTokens || !currentTokens.refresh_token) {
      throw new Error(
        "No refresh token available. Please re-authorize the application."
      );
    }

    console.log("🔄 Refreshing X access token...");

    if (!X_CLIENT_ID) {
      throw new Error(
        "VITE_X_CLIENT_ID not configured in environment variables"
      );
    }

    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: currentTokens.refresh_token,
      });

      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
      };

      // Add authentication based on client type
      if (X_CLIENT_SECRET) {
        // Confidential client - use Basic Auth
        const basic = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString(
          "base64"
        );
        headers["Authorization"] = `Basic ${basic}`;
      } else {
        // Public client - include client_id in body
        body.append("client_id", X_CLIENT_ID);
      }

      const response = await fetch("https://api.x.com/2/oauth2/token", {
        method: "POST",
        headers,
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ Token refresh failed:", response.status, errorData);
        throw new Error(
          `Token refresh failed: ${
            errorData.error_description || errorData.error || "Unknown error"
          }`
        );
      }

      const newTokens = await response.json();

      // Merge with existing tokens (preserve refresh_token if not returned)
      const mergedTokens = {
        ...currentTokens,
        ...newTokens,
        refresh_token: newTokens.refresh_token || currentTokens.refresh_token,
      };

      // Save the new tokens
      this.saveTokens(mergedTokens);

      console.log("✅ X tokens refreshed successfully");
      return mergedTokens;
    } catch (error) {
      console.error("❌ Error refreshing X tokens:", error);
      throw error;
    }
  }

  static async getValidAccessToken() {
    let tokens = this.getStoredTokens();

    if (!tokens) {
      throw new Error(
        "No X tokens found. Please authorize the application first."
      );
    }

    // Check if token is still valid
    if (this.isTokenValid(tokens)) {
      console.log("✅ Using existing valid access token");
      return tokens.access_token;
    }

    // Token expired, try to refresh
    console.log("🔄 Access token expired, refreshing...");
    try {
      tokens = await this.refreshAccessToken();
      return tokens.access_token;
    } catch (error) {
      throw error;
    }
  }
}

// LinkedIn Token Manager Class
class LinkedInTokenManager {
  static TOKEN_FILE_PATH = join(process.cwd(), 'linkedin_tokens.json');

  static getStoredTokens() {
    try {
      const tokenData = readFileSync(this.TOKEN_FILE_PATH, 'utf8');
      const tokens = JSON.parse(tokenData);
      
      // Calculate expires_at if not present but expires_in is available
      if (!tokens.expires_at && tokens.expires_in) {
        const now = Math.floor(Date.now() / 1000);
        tokens.expires_at = now + tokens.expires_in;
      }
      
      return tokens;
    } catch (error) {
      console.log('No stored LinkedIn tokens found or invalid format');
      return null;
    }
  }

  static saveTokens(tokens) {
    try {
      // Add expires_at timestamp if not present
      if (!tokens.expires_at && tokens.expires_in) {
        const now = Math.floor(Date.now() / 1000);
        tokens.expires_at = now + tokens.expires_in;
      }
      
      writeFileSync(this.TOKEN_FILE_PATH, JSON.stringify(tokens, null, 2));
      console.log('✅ LinkedIn tokens saved successfully');
    } catch (error) {
      console.error('❌ Failed to save LinkedIn tokens:', error);
      throw error;
    }
  }

  static isTokenValid(tokens) {
    if (!tokens || !tokens.access_token) {
      return false;
    }

    // If no expiration info, assume it might be valid (let API decide)
    if (!tokens.expires_at) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5 minutes buffer

    return tokens.expires_at > (now + bufferTime);
  }

  static async getValidAccessToken() {
    let tokens = this.getStoredTokens();

    if (!tokens) {
      throw new Error('No LinkedIn tokens found. Please authorize the application first.');
    }

    // LinkedIn tokens cannot be refreshed, so we just check if they're valid
    if (this.isTokenValid(tokens)) {
      console.log('✅ Using existing valid LinkedIn access token');
      return tokens.access_token;
    }

    throw new Error('LinkedIn token expired. Please re-authorize the application.');
  }

  static async getUserInfo(accessToken) {
    try {
      const response = await fetch(`${LINKEDIN_API_BASE_URL}/userinfo`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`LinkedIn API error: ${response.status} ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get LinkedIn user info:', error);
      throw error;
    }
  }
}

// Helper function to upload media to X
async function uploadMedia(imageUrl, accessToken) {
  try {
    console.log("📤 Uploading media to X...");

    // Download and prepare the image
    let imageBuffer;
    if (imageUrl.startsWith("data:")) {
      // Handle base64 data URLs
      const base64Data = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
      console.log(
        "🖼️ Processing base64 image, size:",
        imageBuffer.length,
        "bytes"
      );
    } else {
      console.log("🌐 Fetching image from URL:", imageUrl);
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error(
          "❌ Failed to fetch image:",
          imageResponse.status,
          imageResponse.statusText
        );
        return null;
      }
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      console.log("🖼️ Downloaded image, size:", imageBuffer.length, "bytes");
    }

    // Check authentication
    if (!accessToken) {
      console.error("❌ No access token provided for media upload");
      return null;
    }

    // Upload the image using X API Media Upload endpoint
    console.log("🚀 Uploading media using FormData...");

    const FormData = (await import("form-data")).default;
    const formData = new FormData();
    formData.append("media", imageBuffer, {
      filename: "image.jpg",
      contentType: "image/jpeg",
    });

    const uploadResponse = await fetch(`${X_UPLOAD_URL}/media/upload.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse
        .text()
        .catch(() => "Unknown error");
      console.error(
        "❌ Media upload failed:",
        uploadResponse.status,
        uploadResponse.statusText
      );
      console.error("❌ Error details:", errorText);
      return null;
    }

    const uploadData = await uploadResponse.json();
    console.log("✅ Media uploaded successfully, response:", uploadData);

    // Extract media_id (can be media_id or media_id_string)
    const mediaId =
      uploadData.media_id_string || uploadData.media_id?.toString();

    if (!mediaId) {
      console.error("❌ No media_id returned from upload response");
      console.error("Upload response:", uploadData);
      return null;
    }

    console.log("✅ Media uploaded successfully, media_id:", mediaId);
    return mediaId;
  } catch (error) {
    console.error("❌ Error uploading media:", error);
    return null;
  }
}

// ============ COGNITO AUTH ROUTES ============

app.get("/api/auth/login", (req, res) => {
  const authUrl = `${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}`;
  res.redirect(authUrl);
});

app.post("/api/auth/exchange", async (req, res) => {
  const { code } = req.body;

  try {
    const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokens = await response.json();

    if (tokens.error) {
      return res.status(400).json(tokens);
    }

    req.session.tokens = tokens;
    res.json({ success: true, tokens });
  } catch (err) {
    console.error("Token exchange error:", err);
    res.status(500).json({ error: "Token exchange failed" });
  }
});

app.get("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    const logoutUrl = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${encodeURIComponent(
      FRONTEND_URL
    )}`;
    res.redirect(logoutUrl);
  });
});

app.get("/api/auth/status", (req, res) => {
  res.json({ authenticated: !!req.session.tokens });
});

// ============ X API ROUTES ============

// Post tweet endpoint
app.post("/api/post-tweet", async (req, res) => {
  try {
    const { text, imageUrl, nodeId, scheduleId } = req.body;

    console.log("🐦 X Posting Request:");
    console.log("📝 Text:", text ? `"${text}"` : "(empty - image-only post)");
    console.log("🖼️ Image:", imageUrl ? "Yes" : "No");

    // Validate request
    if (!text && !imageUrl) {
      return res
        .status(400)
        .json({ error: "Either text or image is required" });
    }

    // Check for required environment variables
    if (!X_CLIENT_ID) {
      return res
        .status(500)
        .json({ error: "X API credentials not configured" });
    }

    // Get valid access token (this handles refresh automatically)
    let accessToken;
    try {
      accessToken = await XTokenManager.getValidAccessToken();
      console.log("✅ Got access token for X API");
    } catch (error) {
      console.error("❌ Failed to get access token:", error);
      return res.status(401).json({
        error:
          "No valid X authentication tokens. Please authorize the app first.",
        details: "Run the authorization flow or set tokens in x_tokens.json",
      });
    }

    // Upload media first (if image is provided)
    let mediaId = null;
    if (imageUrl) {
      console.log("🖼️ Image provided, uploading media first...");
      mediaId = await uploadMedia(imageUrl, accessToken);
      if (!mediaId) {
        return res.status(500).json({
          error:
            "Failed to upload image to X. Check authentication and permissions.",
        });
      }
      console.log("✅ Media upload completed, media_id:", mediaId);
    }

    // Create the post with the media
    const tweetData = {};

    // Add text (required for tweets, but can be empty string for image-only posts)
    tweetData.text = text || "";

    // Add media if we have it
    if (mediaId) {
      tweetData.media = {
        media_ids: [mediaId],
      };
    }

    console.log("🚀 Creating tweet with data:", tweetData);

    // Post the tweet using the X API
    const postResponse = await fetch(`${X_API_BASE_URL}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweetData),
    });

    if (!postResponse.ok) {
      const errorData = await postResponse.json().catch(() => ({}));
      console.error("X API error:", postResponse.status, errorData);

      // Handle specific X API errors
      if (postResponse.status === 401) {
        return res
          .status(401)
          .json({
            error: "Authentication failed. Please re-authorize the app.",
          });
      } else if (postResponse.status === 429) {
        return res
          .status(429)
          .json({ error: "Rate limit exceeded. Please try again later." });
      } else if (postResponse.status === 403) {
        // Handle specific 403 error types
        const errorDetail = errorData.detail || errorData.message || "";
        if (errorDetail.includes("duplicate content")) {
          return res.status(403).json({
            error:
              "Duplicate content detected. X does not allow posting the same content twice.",
            suggestion: "Try modifying your post or adding unique content.",
          });
        } else if (
          errorDetail.includes("suspended") ||
          errorDetail.includes("locked")
        ) {
          return res
            .status(403)
            .json({
              error:
                "Account is suspended or locked. Check your X account status.",
            });
        } else {
          return res.status(403).json({
            error:
              errorDetail ||
              "Forbidden. Check your app permissions or account status.",
            details: errorData,
          });
        }
      } else {
        // Update database with failed status if nodeId or scheduleId provided
        if (nodeId || scheduleId) {
          await updateNodeWithXPostingDetails({
            nodeId,
            scheduleId,
            status: "failed",
            postedAt: new Date().toISOString(),
            tweetId: null,
            tweetUrl: null,
          });
        }

        return res.status(postResponse.status).json({
          error:
            errorData.detail ||
            errorData.message ||
            `X API error: ${postResponse.status}`,
          details: errorData,
        });
      }
    }

    const responseData = await postResponse.json();
    const tweetId = responseData.data?.id;

    if (!tweetId) {
      return res.status(500).json({ error: "Tweet posted but no ID returned" });
    }

    console.log("✅ Tweet posted successfully!");
    console.log("🆔 Tweet ID:", tweetId);
    console.log("🔗 Tweet URL: https://x.com/user/status/" + tweetId);

    // Update database with X posting details if nodeId or scheduleId provided
    if (nodeId || scheduleId) {
      await updateNodeWithXPostingDetails({
        nodeId,
        scheduleId,
        tweetId,
        tweetUrl: `https://x.com/user/status/${tweetId}`,
        postedAt: new Date().toISOString(),
        status: "posted",
      });
    }

    return res.json({
      success: true,
      tweetId: tweetId,
      url: `https://x.com/user/status/${tweetId}`,
      message:
        imageUrl && !text
          ? `Image-only tweet posted successfully! View at: https://x.com/user/status/${tweetId}`
          : `Tweet posted successfully! View at: https://x.com/user/status/${tweetId}`,
    });
  } catch (error) {
    console.error("Error posting to X:", error);
    return res
      .status(500)
      .json({ error: "Internal server error while posting to X" });
  }
});

// Get X auth URL endpoint
app.get("/api/x-auth-url", (req, res) => {
  if (!X_CLIENT_ID || !X_REDIRECT_URI) {
    return res.status(500).json({ error: "X OAuth not configured" });
  }

  console.log("🔗 Generating X auth URL...");
  console.log("📋 Client ID:", X_CLIENT_ID);
  console.log("📋 Redirect URI:", X_REDIRECT_URI);

  // Generate a random state for security
  const state = Math.random().toString(36).substring(2, 15);

  // Use a simple code challenge for PKCE
  const codeChallenge = "challenge123";

  const authUrl =
    `https://twitter.com/i/oauth2/authorize?` +
    `response_type=code&` +
    `client_id=${X_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(X_REDIRECT_URI)}&` +
    `scope=tweet.read%20tweet.write%20users.read%20offline.access&` +
    `state=${state}&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=plain`;

  console.log("✅ Generated auth URL:", authUrl);
  res.json({ url: authUrl });
});

// Refresh X tokens endpoint
app.post("/api/x-refresh-token", async (req, res) => {
  try {
    const refreshedTokens = await XTokenManager.refreshAccessToken();
    res.json({ success: true, tokens: refreshedTokens });
  } catch (error) {
    console.error("Token refresh failed:", error);
    res.status(401).json({
      success: false,
      error: error.message || "Failed to refresh tokens",
    });
  }
});

// Simple token validation endpoint
app.get("/api/x-token-status", async (req, res) => {
  try {
    console.log("🔍 Checking X token status...");

    // Try to get a valid access token (this will handle refresh if needed)
    const accessToken = await XTokenManager.getValidAccessToken();

    if (accessToken) {
      console.log("✅ Valid access token available");
      return res.json({
        valid: true,
        authorized: true,
        message: "Valid tokens available",
      });
    } else {
      console.log("❌ No valid access token");
      return res.json({
        valid: false,
        authorized: false,
        message: "No valid tokens",
      });
    }
  } catch (error) {
    console.log("❌ Token validation failed:", error.message);
    return res.json({
      valid: false,
      authorized: false,
      error: error.message,
    });
  }
});

// Check X tokens endpoint
app.get("/api/x-refresh-token", (req, res) => {
  try {
    const tokens = XTokenManager.getStoredTokens();
    const isValid = tokens && XTokenManager.isTokenValid(tokens);

    res.json({
      valid: isValid,
      hasTokens: !!tokens,
      expiresAt: tokens?.expires_at,
    });
  } catch (error) {
    res.json({ valid: false, error: error.message });
  }
});

// Get current user info endpoint (to check which account is authorized)
app.get("/api/x-user-info", async (req, res) => {
  try {
    console.log("🔍 Checking X user info...");
    const accessToken = await XTokenManager.getValidAccessToken();
    console.log("✅ Got valid access token");

    const response = await fetch(`${X_API_BASE_URL}/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 429) {
        console.log("⚠️ X API rate limited - user info unavailable");
      } else {
        console.error("❌ X API /users/me failed:", response.status, errorData);
      }

      return res.status(response.status).json({
        error: "Failed to get user info",
        details: errorData,
      });
    }

    const userData = await response.json();
    console.log("✅ X API /users/me success:", userData.data?.username);

    return res.json({
      success: true,
      user: userData.data,
      message: `Currently authorized as: @${userData.data?.username}`,
    });
  } catch (error) {
    console.error("❌ Error in x-user-info endpoint:", error);
    return res.status(401).json({
      error: "No valid tokens found. Please authorize first.",
      details: error.message,
    });
  }
});

// X callback endpoint (for OAuth flow)
app.get("/api/x-callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ error: "No authorization code provided" });
  }

  try {
    console.log("🔄 Processing X OAuth callback...");
    console.log(
      "📝 Authorization code received:",
      code.substring(0, 20) + "..."
    );

    // Exchange code for tokens
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: X_REDIRECT_URI,
      code_verifier: "challenge123",
    });

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (X_CLIENT_SECRET) {
      const basic = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString(
        "base64"
      );
      headers["Authorization"] = `Basic ${basic}`;
    } else {
      body.append("client_id", X_CLIENT_ID);
    }

    const response = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ Token exchange failed:", response.status, errorData);
      return res
        .status(400)
        .json({ error: "Token exchange failed", details: errorData });
    }

    const tokens = await response.json();
    console.log("✅ New tokens received for account");

    // Save the new tokens (this will overwrite the old account's tokens)
    XTokenManager.saveTokens(tokens);

    // Get user info to confirm which account was authorized
    try {
      const userResponse = await fetch(`${X_API_BASE_URL}/users/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        const username = userData.data?.username;
        console.log(`✅ Successfully authorized account: @${username}`);

        res.json({
          success: true,
          message: `Authorization successful! Now connected to @${username}`,
          user: userData.data,
        });
      } else {
        res.json({
          success: true,
          message: "Authorization successful! You can now post to X.",
        });
      }
    } catch (userError) {
      console.log(
        "Could not fetch user info, but authorization was successful"
      );
      res.json({
        success: true,
        message: "Authorization successful! You can now post to X.",
      });
    }
  } catch (error) {
    console.error("❌ X callback error:", error);
    res.status(500).json({ error: "Callback processing failed" });
  }
});

// ============ LINKEDIN API ROUTES ============

// Get LinkedIn auth URL endpoint
app.get("/api/linkedin-auth-url", (req, res) => {
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_REDIRECT_URI) {
    return res.status(500).json({ error: 'LinkedIn OAuth not configured' });
  }

  console.log('🔗 Generating LinkedIn auth URL...');
  console.log('📋 Client ID:', LINKEDIN_CLIENT_ID);
  console.log('📋 Redirect URI:', LINKEDIN_REDIRECT_URI);

  // Generate a random state for security
  const state = Math.random().toString(36).substring(2, 15);
  
  const scopes = ['openid', 'profile', 'w_member_social'];
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&` +
    `client_id=${LINKEDIN_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&` +
    `scope=${scopes.join('%20')}&` +
    `state=${state}`;

  console.log('✅ Generated LinkedIn auth URL:', authUrl);
  res.json({ url: authUrl });
});

// LinkedIn token status endpoint
app.get("/api/linkedin-token-status", async (req, res) => {
  try {
    console.log('🔍 Checking LinkedIn token status...');
    
    const tokens = LinkedInTokenManager.getStoredTokens();
    
    if (tokens && LinkedInTokenManager.isTokenValid(tokens)) {
      console.log('✅ Valid LinkedIn access token available');
      return res.json({ 
        valid: true,
        authorized: true,
        message: 'Valid tokens available'
      });
    } else {
      console.log('❌ No valid LinkedIn access token');
      return res.json({ 
        valid: false,
        authorized: false,
        message: 'No valid tokens'
      });
    }
  } catch (error) {
    console.log('❌ LinkedIn token validation failed:', error.message);
    return res.json({ 
      valid: false,
      authorized: false,
      error: error.message 
    });
  }
});

// LinkedIn callback endpoint (for OAuth flow)
app.get("/api/linkedin-callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    console.log('🔄 Processing LinkedIn OAuth callback...');
    console.log('📝 Authorization code received:', code.substring(0, 20) + '...');

    // Exchange code for tokens
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET
    });

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ LinkedIn token exchange failed:', response.status, errorData);
      return res.status(400).json({ error: 'Token exchange failed', details: errorData });
    }

    const tokens = await response.json();
    console.log('✅ New LinkedIn tokens received');
    
    // Save the new tokens
    LinkedInTokenManager.saveTokens(tokens);

    // Get user info to confirm which account was authorized
    try {
      const userInfo = await LinkedInTokenManager.getUserInfo(tokens.access_token);
      const name = userInfo.name || userInfo.given_name + ' ' + userInfo.family_name;
      console.log(`✅ Successfully authorized LinkedIn account: ${name}`);
      
      res.json({ 
        success: true, 
        message: `Authorization successful! Now connected to ${name}`,
        user: userInfo
      });
    } catch (userError) {
      console.log('Could not fetch user info, but authorization was successful');
      res.json({ success: true, message: 'Authorization successful! You can now post to LinkedIn.' });
    }

  } catch (error) {
    console.error('❌ LinkedIn callback error:', error);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

// LinkedIn refresh token endpoint (LinkedIn doesn't support refresh tokens, so this is a no-op)
app.post("/api/linkedin-refresh-token", async (req, res) => {
  try {
    // LinkedIn tokens cannot be refreshed, user needs to re-authorize
    res.json({ 
      success: false, 
      error: 'LinkedIn tokens cannot be refreshed. Please re-authorize the application.' 
    });
  } catch (error) {
    console.error('LinkedIn refresh attempt:', error);
    res.status(500).json({ 
      success: false, 
      error: 'LinkedIn tokens cannot be refreshed' 
    });
  }
});

// Post to LinkedIn endpoint
app.post("/api/post-linkedin", async (req, res) => {
  try {
    const { text, imageUrl } = req.body;

    if (!text && !imageUrl) {
      return res.status(400).json({ error: 'Either text or imageUrl is required' });
    }

    console.log('📤 Posting to LinkedIn...');
    console.log('📝 Text length:', text?.length || 0);
    console.log('🖼️ Has image:', !!imageUrl);

    // Get valid access token
    const accessToken = await LinkedInTokenManager.getValidAccessToken();

    // Get user profile info to get person URN
    const userInfo = await LinkedInTokenManager.getUserInfo(accessToken);
    const personUrn = userInfo.sub; // OpenID Connect subject is the person URN

    let shareData = {
      author: `urn:li:person:${personUrn}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: text || ''
          },
          shareMediaCategory: imageUrl ? 'IMAGE' : 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    // If there's an image, handle media upload
    if (imageUrl) {
      try {
        console.log('📤 Uploading image to LinkedIn...');
        
        // Step 1: Register upload
        const registerResponse = await fetch(`${LINKEDIN_API_BASE_URL}/assets?action=registerUpload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
              owner: `urn:li:person:${personUrn}`,
              serviceRelationships: [{
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent'
              }]
            }
          })
        });

        if (!registerResponse.ok) {
          const errorData = await registerResponse.json().catch(() => ({}));
          throw new Error(`Upload registration failed: ${errorData.message || registerResponse.statusText}`);
        }

        const registerData = await registerResponse.json();
        const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
        const asset = registerData.value.asset;

        // Step 2: Upload the image
        let imageBuffer;
        if (imageUrl.startsWith('data:')) {
          const base64Data = imageUrl.split(',')[1];
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
          }
          imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        }

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream'
          },
          body: imageBuffer
        });

        if (!uploadResponse.ok) {
          throw new Error(`Image upload failed: ${uploadResponse.statusText}`);
        }

        // Step 3: Update share data with media
        shareData.specificContent['com.linkedin.ugc.ShareContent'].media = [{
          status: 'READY',
          description: {
            text: 'Shared image'
          },
          media: asset,
          title: {
            text: 'Image'
          }
        }];

        console.log('✅ Image uploaded successfully');
      } catch (imageError) {
        console.error('❌ Image upload failed:', imageError);
        // Continue with text-only post
        console.log('📝 Posting text-only instead');
      }
    }

    // Post the share
    const shareResponse = await fetch(`${LINKEDIN_API_BASE_URL}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(shareData)
    });

    if (!shareResponse.ok) {
      const errorData = await shareResponse.json().catch(() => ({}));
      console.error('❌ LinkedIn post failed:', shareResponse.status, errorData);
      return res.status(shareResponse.status).json({ 
        error: errorData.message || `LinkedIn API error: ${shareResponse.status} ${shareResponse.statusText}` 
      });
    }

    const shareResult = await shareResponse.json();
    const postId = shareResult.id;

    console.log('✅ Successfully posted to LinkedIn');
    console.log('📋 Post ID:', postId);

    res.json({
      success: true,
      postId: postId,
      message: 'Successfully posted to LinkedIn!'
    });

  } catch (error) {
    console.error('❌ LinkedIn posting error:', error);
    
    if (error.message.includes('No LinkedIn tokens found') || error.message.includes('token expired')) {
      return res.status(401).json({ 
        error: 'LinkedIn authorization required. Please authorize the application first.' 
      });
    }
    
    return res.status(500).json({ error: 'Internal server error while posting to LinkedIn' });
  }
});

// ============ BEDROCK FUNCTIONALITY ============

function mapFrontendToBedrockMessages(
  frontendMessages = [],
  instruction = null
) {
  const out = [];
  if (instruction) {
    out.push({ role: "user", content: [{ text: instruction }] });
  }
  for (const m of frontendMessages) {
    const role = m.type === "ai" ? "assistant" : "user";
    out.push({ role, content: [{ text: String(m.content) }] });
  }
  return out;
}

async function generateTextFromBedrock(messagesArray) {
  const payload = {
    messages: mapFrontendToBedrockMessages(
      messagesArray,
      `INSTRUCTION: You are BrewPost assistant. Generate content plans in this EXACT format:

## Post 1
**Title:** [Clean, professional title with NO emojis]
**Caption:** [Write a short, engaging caption in one brief paragraph (3-5 sentences max). Include one key insight. Add 2-3 emojis and hashtags.]
**Image Prompt:** [Detailed visual description including specific elements like lighting, composition, colors, style, mood, and any text overlays. Be specific about the setting, objects, people, and overall aesthetic. Make it 2-3 sentences long.]

## Post 2
**Title:** [Clean, professional title with NO emojis]
**Caption:** [Write a short, engaging caption in one brief paragraph (3-5 sentences max). Include one key insight. Add 2-3 emojis and hashtags.]
**Image Prompt:** [Detailed visual description including specific elements like lighting, composition, colors, style, mood, and any text overlays. Be specific about the setting, objects, people, and overall aesthetic. Make it 2-3 sentences long.]

[Continue for 7 posts total]

RULES:
- Generate exactly 7 posts
- Use "Post 1", "Post 2", etc. (not weekdays)
- Titles must be clean and professional with NO emojis
- Write short captions (one brief paragraph, 2-3 sentences max)
- Include storytelling, insights, and value in captions
- Add emojis and hashtags only in captions, not titles
- Make image prompts detailed and specific (2-3 sentences)
- NO extra explanations or introductions
- Start directly with "## Post 1"`
    ),
  };
  return invokeModelViaHttp(REGION, TEXT_MODEL, payload, "application/json");
}

async function generateImageFromBedrock(promptText, opts = {}) {
  const payload = {
    taskType: "TEXT_IMAGE",
    textToImageParams: { text: String(promptText ?? "") },
    imageGenerationConfig: {
      seed: opts.seed ?? Math.floor(Math.random() * 858993460),
      quality: opts.quality ?? "standard",
      width: opts.width ?? 832,
      height: opts.height ?? 1216,
      numberOfImages: opts.numberOfImages ?? 1,
    },
  };
  return invokeModelViaHttp(REGION, IMAGE_MODEL, payload, "application/json");
}

async function uploadBase64ToS3(base64, keyPrefix = "generated/") {
  const bucket = S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET env var not set");

  const matches = base64.match(/^data:(.+);base64,(.+)$/);
  let mime = "image/png";
  let data = base64;
  let ext = "png";
  if (matches) {
    mime = matches[1];
    data = matches[2];
    if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
    else if (mime.includes("png")) ext = "png";
  }
  const buffer = Buffer.from(data, "base64");
  const key = `${keyPrefix}${Date.now()}.${ext}`;

  try {
    await s3
      .putObject({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
      })
      .promise();

    const presignedUrl = s3.getSignedUrl("getObject", {
      Bucket: bucket,
      Key: key,
      Expires: 864000, // 10 days
    });

    return presignedUrl;
  } catch (err) {
    console.error("S3 putObject failed:", err);
    throw new Error(
      "S3 upload failed: " + (err?.message || JSON.stringify(err))
    );
  }
}

// NOTE: Duplicate/legacy /api/generate-components handler removed. Use the Bedrock-backed
// implementation later in this file (the handler that checks TEXT_MODEL and invokes
// invokeModelViaHttp with the proper payload). Keeping only the canonical implementation
// prevents route shadowing and inconsistent behavior between environments.

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, messages } = req.body;
    if (!prompt && !Array.isArray(messages)) {
      return res.status(400).json({ error: "Provide prompt or messages." });
    }

    const userText =
      typeof prompt === "string"
        ? prompt
        : Array.isArray(messages)
        ? messages[messages.length - 1]?.content
        : "";

    const isImage =
      typeof userText === "string" &&
      /image|cover|banner|foto|gambar/i.test(userText);

    if (isImage && IMAGE_MODEL) {
      const imageResp = await generateImageFromBedrock(userText);
      const maybeB64 =
        imageResp?.images?.[0] ||
        imageResp?.outputs?.[0]?.body ||
        imageResp?.b64_image ||
        imageResp?.image_base64 ||
        imageResp?.base64;

      if (!maybeB64) {
        return res
          .status(500)
          .json({ error: "No base64 found in image response", raw: imageResp });
      }

      const cleaned =
        typeof maybeB64 === "string"
          ? maybeB64.replace(/^"*|"*$/g, "")
          : maybeB64;
      const url = await uploadBase64ToS3(cleaned);
      return res.json({ ok: true, imageUrl: url, raw: imageResp });
    } else {
      const frontendMessages = Array.isArray(messages)
        ? messages
        : [{ role: "user", content: prompt }];
      const resp = await generateTextFromBedrock(frontendMessages);

      let text = null;
      try {
        const arr = resp?.output?.message?.content || [];
        for (const c of arr) {
          if (c?.text) {
            text = c.text;
            break;
          }
        }
      } catch (e) {}

      if (!text) text = JSON.stringify(resp).slice(0, 4000);
      return res.json({ ok: true, text, raw: resp });
    }
  } catch (err) {
    console.error("GENERATE ERROR", err?.stack || err);
    const msg = err?.message || String(err);
    if (msg.includes("403") || /access denied|not authorized/i.test(msg)) {
      return res
        .status(403)
        .json({ error: "403 - Access denied to model", detail: msg });
    }
    return res.status(500).json({ error: "generate_failed", detail: msg });
  }
});

// Nova Canvas image generation endpoint
app.post("/api/generate-image-nova", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    console.log("Generating image with Nova Canvas for prompt:", prompt);

  // Use configured IMAGE_MODEL if present, otherwise use Nova Canvas model
  const imageModelId = IMAGE_MODEL || "amazon.nova-canvas-v1:0";

      let promptText = String(prompt);
      if (promptText.length > 1000) {
        console.warn("[generate-image-nova] prompt too long, truncating to 1000 chars", { length: promptText.length });
        promptText = promptText.slice(0, 1000);
      }

      const payload = {
      taskType: "TEXT_IMAGE",
      textToImageParams: { text: promptText },
      imageGenerationConfig: {
        seed: Math.floor(Math.random() * 858993460),
        quality: "premium", // Use premium quality for Nova Canvas
        width: 1024,
        height: 1024,
        numberOfImages: 1,
      },
    };

    const imageResp = await invokeModelViaHttp(
      REGION,
      imageModelId,
      payload,
      "application/json"
    );
    const maybeB64 =
      imageResp?.images?.[0] ||
      imageResp?.outputs?.[0]?.body ||
      imageResp?.b64_image ||
      imageResp?.image_base64 ||
      imageResp?.base64;

    if (!maybeB64) {
      console.error("No base64 found in Nova Canvas response:", imageResp);
      return res
        .status(500)
        .json({ error: "No base64 found in image response", raw: imageResp });
    }

    const cleaned =
      typeof maybeB64 === "string"
        ? maybeB64.replace(/^"*|"*$/g, "")
        : maybeB64;
    const fullBase64 = cleaned.startsWith("data:")
      ? cleaned
      : `data:image/png;base64,${cleaned}`;
    const url = await uploadBase64ToS3(fullBase64, "nova-canvas/");

    console.log("Nova Canvas image generated successfully:", url);
    return res.json({ ok: true, imageUrl: url, raw: imageResp });
  } catch (err) {
    console.error("NOVA CANVAS GENERATE ERROR", err?.stack || err);
    const msg = err?.message || String(err);
    if (msg.includes("403") || /access denied|not authorized/i.test(msg)) {
      return res
        .status(403)
        .json({
          error: "403 - Access denied to Nova Canvas model",
          detail: msg,
        });
    }
    return res
      .status(500)
      .json({ error: "nova_canvas_generate_failed", detail: msg });
  }
});

// Enhanced prompt generation endpoint
app.post("/api/generate-enhanced-prompt", async (req, res) => {
  try {
    const { title, content, postType } = req.body;
    if (!title && !content) {
      return res.status(400).json({ error: "Title or content is required" });
    }

    // Create enhanced prompt using AI
    const promptInstruction = `Create a detailed, professional image generation prompt for a social media ${
      postType || "promotional"
    } post. 

Post Title: ${title || "N/A"}
Post Content: ${content || "N/A"}

Generate a comprehensive prompt that includes:
- Visual style (modern, professional, eye-catching)
- Color scheme (vibrant, brand-appropriate)
- Layout elements (text placement, composition)
- Specific details about imagery
- Typography style
- Overall mood and atmosphere

Make it suitable for Nova Canvas image generation. Focus on creating realistic, professional marketing materials without placeholder text. The prompt should be 2-3 sentences maximum but highly descriptive.`;

    const messages = [{ type: "user", content: promptInstruction }];
    const aiResponse = await generateTextFromBedrock(messages);

    let enhancedPrompt = null;
    try {
      const arr = aiResponse?.output?.message?.content || [];
      for (const c of arr) {
        if (c?.text) {
          enhancedPrompt = c.text.trim();
          break;
        }
      }
    } catch (e) {
      console.error("Error parsing AI response:", e);
    }

    if (!enhancedPrompt) {
      return res
        .status(500)
        .json({ error: "Failed to generate enhanced prompt" });
    }

    console.log("Enhanced prompt generated:", enhancedPrompt);
    return res.json({ ok: true, enhancedPrompt });
  } catch (err) {
    console.error("ENHANCED PROMPT GENERATE ERROR", err?.stack || err);
    const msg = err?.message || String(err);
    return res
      .status(500)
      .json({ error: "enhanced_prompt_generate_failed", detail: msg });
  }
});

// Canvas image generation from node prompt
app.post("/api/canvas-generate-from-node", async (req, res) => {
  try {
    const { nodeId, imagePrompt, title, content, selectedComponents, components, template } = req.body;
    // normalize components (frontend may send `components` or legacy `selectedComponents`)
    const uiComponents = Array.isArray(components)
      ? components
      : Array.isArray(selectedComponents)
      ? selectedComponents
      : [];
    if (!imagePrompt && !title && !content) {
      return res
        .status(400)
        .json({ error: "Node must have imagePrompt, title, or content" });
    }
    // Create a comprehensive prompt from node data and supplied UI state (components/template)
    let finalPrompt = imagePrompt || "";
    if (!finalPrompt && title) {
      finalPrompt = `Create a professional social media image for: ${title}`;
      if (content) {
        finalPrompt += `. Content context: ${content.substring(0, 200)}`;
      }
    }

    // Only add basic enhancement if no detailed prompt exists
    if (!imagePrompt && finalPrompt.length < 100) {
      finalPrompt +=
        ". Professional, high-quality, social media ready, modern design, vibrant colors";
    }

    // If selected components are provided, explicitly integrate them into the prompt
    try {
      if (Array.isArray(uiComponents) && uiComponents.length > 0) {
        // Promotions: ensure we draw the selected promotion badge
        const promotions = uiComponents.filter(c => (c.category && String(c.category).toLowerCase().includes('promotion')) || (c.name && /%|off|discount/i.test(String(c.name))));
        if (promotions.length > 0) {
          const p = promotions[0];
          finalPrompt += ` Add a circular promotional badge that shows: "${p.name || p.id || 'Offer'}". Render the badge with a high-contrast ring and place it top-right.`;
        }

        // Campaign types and trends influence style (visual-only cues — DO NOT render as text)
        const trends = uiComponents.filter(c => c.category && String(c.category).toLowerCase().includes('trend'));
        if (trends.length > 0) {
          finalPrompt += ` Add visual-only trend cues (sparklines, subtle data waveforms, small chart motifs, or glows) to convey trending performance — do NOT include textual labels for trend names.`;
        }

        const campaigns = uiComponents.filter(c => c.category && String(c.category).toLowerCase().includes('campaign'));
        if (campaigns.length > 0) {
          finalPrompt += ` Infuse campaign-specific visual styling (color accents, background motifs, badges, iconography, or composition changes) that reflect the campaign theme — DO NOT render the campaign name as visible text.`;
        }
      }

      // If a template is provided (company name, palette, logo), instruct model to include them
      if (template) {
  if (template.companyName) finalPrompt += ` Apply brand-consistent styling informed by the company (do NOT render the company name as text); prefer logo, color palette, and brand motifs.`;
  if (template.colorPalette) finalPrompt += ` Use the brand color palette for accents and composition (use colors, gradients, and accents — no textual color labels).`;
  if (template.logoUrl) finalPrompt += ` Reserve space for the logo (bottom-left corner preferred) and incorporate it visually; do not generate the logo as plain text.`;
      }
    } catch (e) {
      console.warn('Failed to integrate selectedComponents/template into prompt', e && (e.message || e));
    }

    console.log(
      "Generating image from node:",
      nodeId,
      "with prompt:",
      finalPrompt
    );

  // Use configured IMAGE_MODEL if present, otherwise use Nova Canvas model
  const imageModelId = IMAGE_MODEL || "amazon.nova-canvas-v1:0";

    let nodePromptText = String(finalPrompt || "");
    if (nodePromptText.length > 1000) {
      console.warn("[canvas-generate-from-node] finalPrompt too long, truncating to 1000 chars", { length: nodePromptText.length });
      nodePromptText = nodePromptText.slice(0, 1000);
    }

    const payload = {
      taskType: "TEXT_IMAGE",
      textToImageParams: { text: nodePromptText },
      imageGenerationConfig: {
        seed: Math.floor(Math.random() * 858993460),
        quality: "premium",
        width: 1024,
        height: 1024,
        numberOfImages: 1,
      },
    };

    const imageResp = await invokeModelViaHttp(
      REGION,
      imageModelId,
      payload,
      "application/json"
    );
    const maybeB64 =
      imageResp?.images?.[0] ||
      imageResp?.outputs?.[0]?.body ||
      imageResp?.b64_image ||
      imageResp?.image_base64 ||
      imageResp?.base64;

    if (!maybeB64) {
      console.error("No base64 found in Nova Canvas response:", imageResp);
      return res
        .status(500)
        .json({ error: "No base64 found in image response", raw: imageResp });
    }

    const cleaned =
      typeof maybeB64 === "string"
        ? maybeB64.replace(/^"*|"*$/g, "")
        : maybeB64;
    const fullBase64 = cleaned.startsWith("data:")
      ? cleaned
      : `data:image/png;base64,${cleaned}`;
    const url = await uploadBase64ToS3(fullBase64, "node-images/");

    console.log("Node image generated successfully:", url);
    return res.json({ ok: true, imageUrl: url, nodeId, prompt: finalPrompt });
  } catch (err) {
    console.error("NODE IMAGE GENERATE ERROR", {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      code: err?.code,
      statusCode: err?.statusCode,
      requestId: err?.requestId,
    });
    const msg = err?.message || String(err);
    return res.status(500).json({
      error: "node_image_generate_failed",
      detail: msg,
      fullError: {
        message: err?.message,
        name: err?.name,
        code: err?.code,
      },
    });
  }
});

// Generate components for node (Bedrock text model)
app.post('/api/generate-components', async (req, res) => {
  try {
    const { node } = req.body;
    if (!node) return res.status(400).json({ error: 'node_required' });

    if (!TEXT_MODEL) {
      console.error('[generate-components] TEXT_MODEL not configured');
      return res.status(500).json({ error: 'text_model_not_configured' });
    }

    const instruction = `You are BrewPost assistant. Given the following node (title, content, postType, type, connections), generate an array of 8-18 components relevant for planning and creative execution. Return ONLY valid JSON (a single JSON array). Each component must be an object with at least these fields: id (unique short string), type (one of: local_data, online_trend, campaign_type, creative_asset), title (short title), name (short identifier), description (1-2 sentence description), category (human-readable category), keywords (array of short keywords), relevanceScore (0-100 number), impact (low|medium|high), color (hex or color name). Base suggestions on the node context. Node: ${JSON.stringify(node)}.`;

    const payload = { messages: mapFrontendToBedrockMessages([], instruction) };

    let resp;
    try {
      resp = await invokeModelViaHttp(REGION, TEXT_MODEL, payload, 'application/json');
    } catch (err) {
      console.error('[generate-components] Bedrock invocation failed', err && (err.message || err));
      return res.status(502).json({ error: 'bedrock_invoke_failed', detail: err && (err.message || String(err)) });
    }

    let text = null;
    try {
      const arr = resp?.output?.message?.content || [];
      for (const c of arr) { if (c?.text) { text = c.text; break; } }
    } catch (e) {}
    if (!text) text = JSON.stringify(resp).slice(0, 4000);

    // Parse JSON array from model
    let components = null;
    try { components = JSON.parse(text); } catch (e) {
      const m = text.match(/\[.*\]/s);
      if (m) {
        try { components = JSON.parse(m[0]); } catch (e2) { components = null; }
      }
    }

    if (!components || !Array.isArray(components)) {
      console.warn('[generate-components] failed to parse components', { rawTextPreview: (text || '').slice(0,400) });
      return res.status(500).json({ error: 'failed_to_parse_components', raw: text, rawResp: resp });
    }

    console.log('[generate-components] parsed components count:', components.length);
    return res.json({ ok: true, components, raw: resp });
  } catch (err) {
    console.error('generate-components error', err);
    return res.status(500).json({ error: 'generate_components_failed', detail: err?.message || String(err) });
  }
});

app.get("/health", (req, res) => res.json({ ok: true, pid: process.pid }));

// Proxy AppSync GraphQL requests from the client. This endpoint will use an API key
// if configured (VITE_APPSYNC_API_KEY). Otherwise, it will sign the request with
// AWS SigV4 using the server credentials so the client does not need IAM creds.
app.post('/api/proxy-appsync', async (req, res) => {
  try {
    const { query, variables } = req.body || {};
    if (!APPSYNC_ENDPOINT) return res.status(500).json({ error: 'appsync_endpoint_not_configured' });

    const payload = JSON.stringify({ query, variables });

    // If API key is provided in env, use it (simpler for dev)
    if (process.env.VITE_APPSYNC_API_KEY) {
      const resp = await fetch(APPSYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.VITE_APPSYNC_API_KEY,
        },
        body: payload,
      });
      const text = await resp.text();
      // Attempt to parse JSON, otherwise return raw text
      try { return res.status(resp.status).json(JSON.parse(text)); } catch (e) { return res.status(resp.status).send(text); }
    }

    // No API key: sign the request with SigV4 using aws-sdk
    try {
      const urlObj = new URL(APPSYNC_ENDPOINT);
      const httpRequest = new pkg.HttpRequest(urlObj.origin, REGION);
      httpRequest.method = 'POST';
      httpRequest.path = urlObj.pathname + urlObj.search;
      httpRequest.body = payload;
      httpRequest.headers = {
        'host': urlObj.host,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      };

      // Ensure credentials are available
      const creds = pkg.config.credentials || new pkg.Credentials({ accessKeyId: process.env.ACCESS_KEY_ID, secretAccessKey: process.env.SECRET_ACCESS_KEY });
      await new Promise((resolve, reject) => { creds.get ? creds.get(err => (err ? reject(err) : resolve())) : resolve(); });

      const signer = new pkg.Signers.V4(httpRequest, 'appsync');
      signer.addAuthorization(creds, new Date());

      // Make the actual fetch with signed headers
      const signedHeaders = httpRequest.headers;
      const finalResp = await fetch(APPSYNC_ENDPOINT, { method: 'POST', headers: signedHeaders, body: payload });
      const finalText = await finalResp.text();
      try { return res.status(finalResp.status).json(JSON.parse(finalText)); } catch (e) { return res.status(finalResp.status).send(finalText); }
    } catch (signErr) {
      console.error('Failed to sign AppSync request:', signErr);
      return res.status(500).json({ error: 'failed_to_sign_request', detail: String(signErr) });
    }
  } catch (err) {
    console.error('proxy-appsync error', err);
    return res.status(500).json({ error: 'proxy_appsync_failed', detail: String(err) });
  }
});

app.get("/api/schedules/list", async (req, res) => {
  try {
    // Determine userId from session, header, or query param (fallback to demo user)
    const userId =
      (req.session &&
        req.session.tokens &&
        req.session.tokens.id_token_payload &&
        req.session.tokens.id_token_payload.sub) ||
      req.headers["x-user-id"] ||
      req.query.userId ||
      "demo-user-123"; // Default for development

    const readFuncUrl =
      process.env.SCHEDULES_READ_LAMBDA_FUNC_URL ||
      process.env.PUBLIC_UPLOADER_FUNC_URL ||
      null;

    // NEW DEBUG: log invocation info to help trace 500 responses
    console.log(
      `[schedules/list] called. userId=${userId}, query.userId=${
        req.query.userId
      }, header.x-user-id=${
        req.headers["x-user-id"]
      }, readFuncUrl=${!!readFuncUrl}, SCHEDULES_TABLE=${SCHEDULES_TABLE}`
    );

    if (readFuncUrl) {
      // Require a userId to avoid exposing all data via function URL
      if (!userId) {
        return res
          .status(400)
          .json({
            ok: false,
            error: "missing_userid",
            detail: "Provide userId in session/header/query to list schedules",
          });
      }

      try {
        const funcHeaders = { "Content-Type": "application/json" };
        if (process.env.SCHEDULES_READ_LAMBDA_FUNC_URL_AUTH) {
          funcHeaders["Authorization"] =
            process.env.SCHEDULES_READ_LAMBDA_FUNC_URL_AUTH;
        }

        // call the per-user function URL
        const resp = await fetch(readFuncUrl, {
          method: "POST",
          headers: funcHeaders,
          body: JSON.stringify({ action: "listByUser", userId }),
        });

        // parse body safely
        let body = null;
        let rawText = null;
        try {
          body = await resp.json();
        } catch (parseErr) {
          rawText = await resp.text().catch(() => null);
          console.warn(
            "[schedules/list] function URL returned non-JSON or parse failed; rawText length=",
            rawText ? rawText.length : 0
          );
        }

        if (!resp.ok) {
          console.error(
            "[schedules/list] Per-user Function URL returned non-200:",
            resp.status,
            body ?? rawText
          );
          // ensure we return serializable detail
          const detail = body ?? rawText ?? `HTTP ${resp.status}`;
          return res
            .status(500)
            .json({
              ok: false,
              error: "function_url_error",
              status: resp.status,
              detail,
            });
        }

        // Accept many common shapes from function URL:
        let schedulesRaw = null;
        if (Array.isArray(body)) {
          schedulesRaw = body;
        } else if (body && Array.isArray(body.schedules)) {
          schedulesRaw = body.schedules;
        } else if (body && Array.isArray(body.Items)) {
          schedulesRaw = body.Items;
        } else if (body && Array.isArray(body.items)) {
          schedulesRaw = body.items;
        } else if (body && Array.isArray(body.scheduled)) {
          schedulesRaw = body.scheduled;
        } else if (body && Array.isArray(body.data)) {
          schedulesRaw = body.data;
        }

        if (schedulesRaw !== null) {
          console.log(
            "[schedules/list] Raw schedules from Lambda:",
            schedulesRaw
          );
          console.log("[schedules/list] First raw item:", schedulesRaw[0]);
          console.log(
            "[schedules/list] First item title:",
            schedulesRaw[0]?.title
          );

          const items = (schedulesRaw || []).map((it) => {
            console.log("[schedules/list] Mapping item:", it);
            console.log(
              "[schedules/list] Item title field:",
              it.title,
              "Type:",
              typeof it.title
            );
            return {
              scheduleId: it.scheduleId ?? it.id ?? it.ID ?? it.nodeId ?? null,
              userId: it.userId ?? userId,
              status: it.status ?? it.state ?? null,
              createdAt: it.createdAt ?? it.created_at ?? null,
              scheduledDate:
                it.scheduledDate ?? it.scheduled_date ?? it.scheduledAt ?? null,
              title: it.title ?? "Untitled",
              content: it.content ?? null,
              imageUrl: it.imageUrl ?? null,
              type: it.type ?? "post",
              raw: it,
            };
          });
          console.log("[schedules/list] Mapped items:", items);
          return res.json({ ok: true, schedules: items });
        }

        // unexpected shape — stringify/capture for debugging
        const detail = body ?? rawText ?? "empty_response";
        console.warn(
          "[schedules/list] Per-user Function URL returned unexpected shape:",
          detail
        );
        return res
          .status(500)
          .json({
            ok: false,
            error: "unexpected_function_response",
            detail:
              typeof detail === "string" ? detail : JSON.stringify(detail),
          });
      } catch (funcErr) {
        console.error(
          "[schedules/list] Per-user Function URL call failed:",
          funcErr && (funcErr.message || funcErr)
        );
        // fallthrough to try DynamoDB query below
      }
    }

    // No function URL or function call failed: attempt to query DynamoDB by userId (preferred to scan)
    if (userId) {
      try {
        const q = {
          TableName: SCHEDULES_TABLE,
          KeyConditionExpression: "userId = :uid",
          ExpressionAttributeValues: { ":uid": userId },
        };
        const data = await DDB.query(q).promise();
        const items = (data.Items || []).map((it) => ({
          scheduleId: it.scheduleId ?? it.id ?? it.ID,
          userId: it.userId ?? userId,
          status: it.status ?? null,
          createdAt: it.createdAt ?? null,
          scheduledDate: it.scheduledDate ?? null,
          title: it.title ?? "Untitled",
          content: it.content ?? null,
          imageUrl: it.imageUrl ?? null,
        }));
        return res.json({ ok: true, schedules: items });
      } catch (queryErr) {
        console.warn(
          "DynamoDB query by userId failed, will attempt scan as fallback:",
          queryErr && queryErr.message ? queryErr.message : queryErr
        );
        // If query failed due to permissions or table key mismatch, we will try scan below (with auth detection).
      }
    }

    // Fallback: scan the table (existing behavior) — keep auth detection
    try {
      const data = await DDB.scan({ TableName: SCHEDULES_TABLE }).promise();
      const items = (data.Items || []).map((it) => ({
        scheduleId: it.scheduleId ?? it.id ?? it.ID,
        userId: it.userId ?? null,
        status: it.status ?? null,
        createdAt: it.createdAt ?? null,
        scheduledDate: it.scheduledDate ?? null,
        title: it.title ?? "Untitled",
        content: it.content ?? null,
        imageUrl: it.imageUrl ?? null,
      }));
      return res.json({ ok: true, schedules: items });
    } catch (scanErr) {
      console.error("Failed to list schedules (scan):", scanErr);

      const msg =
        scanErr && scanErr.message ? String(scanErr.message) : String(scanErr);
      const isScanDenied =
        /not authorized to perform: dynamodb:Scan/i.test(msg) ||
        /is not authorized to perform: dynamodb:Scan/i.test(msg) ||
        (/dynamodb:Scan/i.test(msg) &&
          /not authorized|AccessDenied/i.test(msg));

      if (isScanDenied) {
        const detail = {
          message: msg,
          hint: 'The server identity is missing permission "dynamodb:Scan" (or related read actions) on the schedules table. Prefer attaching the per-user Lambda or grant read permissions to the server identity.',
        };
        console.error("DynamoDB Scan authorization error detected:", detail);
        return res
          .status(403)
          .json({ ok: false, error: "DynamoDBScanAuthorizationError", detail });
      }

      return res
        .status(500)
        .json({ ok: false, error: "Failed to list schedules", detail: msg });
    }
  } catch (err) {
    console.error("Unhandled error in schedules list:", err);
    return res
      .status(500)
      .json({
        ok: false,
        error: "list_failed",
        detail: err && err.message ? err.message : String(err),
      });
  }
});

app.post("/api/schedules/create-all", async (req, res) => {
  const { nodes } = req.body;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json({ ok: false, error: "No nodes provided" });
  }

  const lambdaName =
    process.env.SCHEDULES_LAMBDA_NAME || process.env.SCHEDULES_LAMBDA_ARN;
  const lambdaFuncUrl = process.env.SCHEDULES_LAMBDA_FUNC_URL || null; // <-- new env var
  if (!lambdaName && !lambdaFuncUrl) {
    console.error(
      "SCHEDULES_LAMBDA_NAME/SCHEDULES_LAMBDA_ARN or SCHEDULES_LAMBDA_FUNC_URL not configured"
    );
    return res.status(500).json({
      ok: false,
      error: "schedules_lambda_not_configured",
      detail:
        "Set SCHEDULES_LAMBDA_NAME or SCHEDULES_LAMBDA_ARN or SCHEDULES_LAMBDA_FUNC_URL in environment to the Lambda function or its function URL.",
    });
  }

  try {
    const userId =
      (req.session &&
        req.session.tokens &&
        req.session.tokens.id_token_payload &&
        req.session.tokens.id_token_payload.sub) ||
      req.headers["x-user-id"] ||
      req.body.userId ||
      "demo-user-123"; // Default for development

    // NEW: validate nodes are non-empty and add quick debug logging
    if (!Array.isArray(nodes) || nodes.length === 0) {
      console.warn("create-all called with empty nodes array, aborting.");
      return res
        .status(400)
        .json({
          ok: false,
          error: "nodes_empty",
          detail: "No nodes provided to schedule",
        });
    }

    const payload = {
      action: "createAll",
      userId,
      nodes: nodes.map((node) => ({
        ...node,
        type: node.type || "post", // ensure type is included
      })),
      nodes_count: Array.isArray(nodes) ? nodes.length : 0,
      debug: {
        schedulesTable: SCHEDULES_TABLE,
        region: REGION,
      },
    };

    // Optional debug: print minimal preview if enabled via env
    if (process.env.SCHEDULES_DEBUG === "true") {
      console.log(
        "Dispatching schedules payload: nodes_count=",
        payload.nodes_count,
        "firstNodePreview=",
        nodes[0] ? { id: nodes[0].id, title: nodes[0].title } : null,
        "debug=",
        payload.debug
      );
    }

    // Try SDK invoke first if configured
    if (lambdaName) {
      try {
        const lambda = new pkg.Lambda({ region: REGION });
        const invokeResp = await lambda
          .invoke({
            FunctionName: lambdaName,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
          })
          .promise();

        let parsed;
        try {
          parsed = invokeResp.Payload
            ? JSON.parse(String(invokeResp.Payload))
            : null;
        } catch (e) {
          parsed = null;
        }

        if (invokeResp.FunctionError) {
          console.error(
            "Schedules lambda reported function error via SDK:",
            parsed || invokeResp
          );
          if (
            lambdaFuncUrl &&
            /AccessDenied|not authorized|AccessDeniedException/i.test(
              JSON.stringify(parsed || "")
            )
          ) {
            console.warn(
              "Attempting fallback to Lambda function URL due to function error."
            );
          } else {
            return res
              .status(500)
              .json({
                ok: false,
                error: "schedules_lambda_error",
                detail: parsed || invokeResp,
              });
          }
        } else {
          console.log("Schedules lambda SDK response (parsed):", parsed);
          // If lambda says ok but returned no scheduled items, surface the full payload for debugging
          if (
            parsed &&
            parsed.ok &&
            Array.isArray(parsed.scheduled) &&
            parsed.scheduled.length === 0
          ) {
            console.warn(
              "Lambda returned ok but scheduled array empty. Surface full lambda response to caller for inspection."
            );
            return res
              .status(200)
              .json({
                ok: true,
                warning: "lambda_ok_but_no_items",
                lambdaResponse: parsed,
              });
          }
          return res
            .status(parsed && parsed.ok === false ? 500 : 200)
            .json(parsed);
        }
      } catch (sdkErr) {
        const msg = sdkErr && sdkErr.message ? sdkErr.message : String(sdkErr);
        console.error("Lambda SDK invoke failed:", msg);

        // Detect explicit missing lambda:InvokeFunction permission and handle it
        const isInvokeDenied =
          /not authorized to perform: lambda:InvokeFunction/i.test(msg) ||
          /is not authorized to perform: lambda:InvokeFunction/i.test(msg);

        if (isInvokeDenied) {
          console.warn(
            "Detected missing lambda:InvokeFunction permission for current identity."
          );

          // If function URL is available, fall back to HTTP POST
          if (lambdaFuncUrl) {
            console.warn(
              "Falling back to configured Lambda Function URL:",
              lambdaFuncUrl
            );
            // allow flow to continue to Function URL invocation below
          } else {
            // No fallback available — return actionable guidance to the caller
            const detail = {
              message: msg,
              hint: 'The server process identity is missing permission "lambda:InvokeFunction" on the dispatcher Lambda. Attach a policy allowing lambda:InvokeFunction for the function ARN to the IAM user/role (see aws/allow-invoke-lambda-policy.json).',
            };
            console.error(
              "Lambda invoke authorization error (no fallback):",
              detail
            );
            return res
              .status(403)
              .json({
                ok: false,
                error: "lambda_invoke_authorization_error",
                detail,
              });
          }
        } else {
          // For other SDK errors, only fallback if it's a general access denied and we have a function URL
          if (
            /access denied|not authorized|AccessDenied|AccessDeniedException/i.test(
              msg
            ) &&
            lambdaFuncUrl
          ) {
            console.warn(
              "Lambda SDK invoke denied; falling back to Lambda function URL:",
              lambdaFuncUrl
            );
            // fallthrough to HTTP invocation below
          } else {
            return res
              .status(500)
              .json({ ok: false, error: "invoke_failed", detail: msg });
          }
        }
      }
    }

    // Fallback: call Lambda Function URL via HTTP POST if available
    if (lambdaFuncUrl) {
      try {
        const funcHeaders = { "Content-Type": "application/json" };
        if (process.env.SCHEDULES_LAMBDA_FUNC_URL_AUTH) {
          funcHeaders["Authorization"] =
            process.env.SCHEDULES_LAMBDA_FUNC_URL_AUTH;
        }

        // Log call for debugging
        console.log(
          `POST ${lambdaFuncUrl} with nodes_count=${payload.nodes_count}`
        );

        const resp = await fetch(lambdaFuncUrl, {
          method: "POST",
          headers: funcHeaders,
          body: JSON.stringify(payload),
        });
        const result = await resp.json().catch(() => null);
        if (!resp.ok) {
          console.error("Function URL returned non-200:", resp.status, result);
          return res
            .status(500)
            .json({
              ok: false,
              error: "function_url_error",
              status: resp.status,
              detail: result,
            });
        }
        console.log("Function URL response:", result);

        // treat generic success without scheduled items as actionable failure
        const hasScheduledArray =
          result &&
          (Array.isArray(result.scheduled) || Array.isArray(result.results));
        const reportedSuccess =
          result && (result.ok === true || result.success === true);
        if (reportedSuccess && !hasScheduledArray) {
          console.error(
            "Function URL responded success but did not return scheduled items:",
            result
          );
          return res.status(500).json({
            ok: false,
            error: "lambda_success_no_items",
            detail:
              "Lambda function responded with success but did not return any scheduled items. Check Lambda logs and that the function received nodes (nodes_count).",
            nodes_count_sent: payload.nodes_count,
            lambdaResponse: result,
          });
        }

        // Normalize the response format
        const normalizedResult = {
          ...result,
          scheduled: result.scheduled || result.results || [],
        };
        return res
          .status(result && result.ok === false ? 500 : 200)
          .json(normalizedResult);
      } catch (httpErr) {
        console.error("Function URL POST failed:", httpErr);
        return res
          .status(500)
          .json({
            ok: false,
            error: "function_url_invoke_failed",
            detail:
              httpErr && httpErr.message ? httpErr.message : String(httpErr),
          });
      }
    }

    // Should not reach here
    return res
      .status(500)
      .json({ ok: false, error: "no_invoke_path_available" });
  } catch (err) {
    console.error("Failed to invoke schedules lambda/path:", err);
    return res
      .status(500)
      .json({
        ok: false,
        error: "invoke_failed",
        detail: err && err.message ? err.message : String(err),
      });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`Environment: ${isProduction ? "production" : "development"}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(
    `Allowed origins: ${[
      FRONTEND_URL,
      "http://localhost:8082",
      "http://localhost:8080",
    ]
      .filter(Boolean)
      .join(", ")}`
  );
  console.log(`Redirect URI: ${REDIRECT_URI}`);
});
