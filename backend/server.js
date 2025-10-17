import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Simple CORS configuration to allow frontend during development
// Include FRONTEND_URL from environment so production frontend can be allowed
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
const allowedOrigins = [FRONTEND_URL, 'http://localhost:8080', 'http://localhost:8082'].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    console.warn('Blocked CORS origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Handle preflight for all routes
// Note: explicit preflight handler removed due to path parsing issues; cors middleware handles OPTIONS

// Configure session to store tokens safely on backend
app.use(
  session({
    secret: "supersecret", // change this to something secure
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // set true if using HTTPS
  })
);

// ====== CONFIG (replace these with your Cognito values) ======
const CLIENT_ID = "4b5sfdlheh53u9ba26733scdvs";
const CLIENT_SECRET = "14ic458tq5h8tvk40miu1re7hm1bd9tp1s25pr3e1hjk9lnoh5fb";
const COGNITO_DOMAIN = "https://us-east-1lnmmjkyb9.auth.us-east-1.amazoncognito.com";
const REDIRECT_URI = "http://localhost:8080/Callback"; // frontend callback page
// ============================================================

// Login → Redirect user to Cognito login page
app.get("/login", (req, res) => {
  const authUrl = `${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=code&scope=email+openid+phone&redirect_uri=${REDIRECT_URI}`;
  res.redirect(authUrl);
});

// Cognito callback → Forward code to frontend
app.get("/Callback", (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("No code received from Cognito");
  }
  // Forward to frontend
  res.redirect(`http://localhost:8080/Callback?code=${code}`);
});

// Exchange code for tokens
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

    // Save tokens in session
    req.session.tokens = tokens;

    res.json({ success: true });
  } catch (err) {
    console.error("Token exchange error:", err);
    res.status(500).json({ error: "Token exchange failed" });
  }
});

// Logout → Clear session and redirect to Cognito logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    const logoutUrl = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=http://localhost:8080`;
    res.redirect(logoutUrl);
  });
});

// Start server
app.listen(8081, () => {
  console.log("✅ Server running on http://localhost:8081");
});
