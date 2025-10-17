// src/server/server.js
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import pkg from "aws-sdk";
import { invokeModelViaHttp } from "./bedrock.js";

dotenv.config();

const { S3 } = pkg;

const PORT = process.env.PORT || 8081;
const REGION = process.env.REGION || "us-east-1";
const TEXT_MODEL = process.env.TEXT_MODEL; 
const IMAGE_MODEL = process.env.IMAGE_MODEL; 
const S3_BUCKET = process.env.S3_BUCKET;

const app = express();

// CORS only after app is created
app.use(
  cors({
    origin: "http://localhost:8080", 
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(bodyParser.json());

// S3 client (v2)
const s3 = new S3({ region: REGION });

function mapFrontendToBedrockMessages(frontendMessages = [], instruction = null) {
  const out = [];
  if (instruction) {
    out.push({
      role: "user",
      content: [{ text: instruction }],
    });
  }
  for (const m of frontendMessages) {
    const role = m.type === "ai" ? "assistant" : "user"; // avoid role: "system"
    out.push({
      role,
      content: [{ text: String(m.content) }],
    });
  }
  return out;
}

async function generateTextFromBedrock(messagesArray) {
  const payload = {
    messages: mapFrontendToBedrockMessages(
      messagesArray,
      `INSTRUCTION: You are BrewPost assistant — a professional-grade **social media strategist and planner** for Instagram content.

      You operate in TWO MODES:

      1. PLANNER MODE:
      - Generate a 7-day weekly content plan (Monday–Sunday)
      - One post per day — **NO reels or carousels**. Only **single static image posts**
      - Each post must include:
        - **Title**: Strong, curiosity-driven line that must be **visibly placed inside the image**
        - **Caption**: Write a storytelling or educational caption (aim for blog-style or micro-essay length). It should be engaging, unique, non-repetitive, and include **2–3 relevant emojis** + strategic hashtags. Avoid filler or generic tips — write like a thought leader.
        - **Image Prompt**: Describe the visual content of the post, including how the **title should appear inside the image** (font size/placement/vibe optional but encouraged)

      2. STRATEGIST MODE:
      - When given goals, ideas, or raw themes, help by:
        - Brainstorming compelling **title options**
        - Crafting detailed **image prompt suggestions** (including embedded text/title)
        - Recommending the **tone, structure, or opening hook** of the caption
        - Offering complete **caption drafts** with strong strategic positioning

      GENERAL RULES:
      - Always clarify if the user’s goal is ambiguous.
      - **Never repeat ideas or reuse phrasing** — each output should feel tailor-made.
      - Think like a senior creative strategist — **sharp, persuasive, and brand-aware**
      - Focus on real content value, storytelling power, and audience psychology.

      Output should always be structured, useful, and ready to deploy in a content calendar or automation pipeline.`
    ),
  };
  return invokeModelViaHttp(REGION, TEXT_MODEL, payload, "application/json");
}

async function generateImageFromBedrock(promptText, opts = {}) {
  // opts: { width, height, quality, numberOfImages, seed }
  const payload = {
    taskType: "TEXT_IMAGE",
    textToImageParams: {
      text: String(promptText ?? ""),
    },
    imageGenerationConfig: {
      seed: opts.seed ?? Math.floor(Math.random() * 858993460),
      quality: opts.quality ?? "standard", // standard | high etc.
      width: opts.width ?? 832,
      height: opts.height ?? 1216,
      numberOfImages: opts.numberOfImages ?? 1,
    },
  };

  // invokeModelViaHttp expects the region and model id
  return invokeModelViaHttp(REGION, IMAGE_MODEL, payload, "application/json");
}


// server.js — replace uploadBase64ToS3 with:
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
    // Upload WITHOUT ACL (no public-read)
    await s3
      .putObject({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
        // REMOVE ACL: "public-read"
        // Optionally add server-side encryption:
        // ServerSideEncryption: "AES256",
      })
      .promise();

    // Generate a presigned URL for reading (valid 3600s)
    const presignedUrl = s3.getSignedUrl("getObject", {
      Bucket: bucket,
      Key: key,
      Expires: 3600, // seconds
    });

    // return the presigned URL (safe even if bucket blocks public ACLs)
    return presignedUrl;
  } catch (err) {
    console.error("S3 putObject failed:", err);
    throw new Error("S3 upload failed: " + (err && err.message ? err.message : JSON.stringify(err)));
  }
}


app.post("/generate", async (req, res) => {
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
      typeof userText === "string" && /image|cover|banner|foto|gambar/i.test(userText);

    if (isImage && IMAGE_MODEL) {
      const imageResp = await generateImageFromBedrock(userText);
      console.log("DEBUG: imageResp:", JSON.stringify(imageResp).slice(0, 2000)); // truncated log

      const maybeB64 =
        // primary (Nova Canvas official)
        (imageResp && imageResp.images && imageResp.images[0]) ||
        // some other providers / older shapes
        imageResp?.outputs?.[0]?.body ||
        imageResp?.b64_image ||
        imageResp?.image_base64 ||
        imageResp?.base64 ||
        null;

      if (!maybeB64) {
        // helpful debug object for server response
        return res.status(500).json({
          error: "No base64 found in image response",
          raw: imageResp,
        });
      }

      // If the model returns a raw JSON-encoded base64 with quotes, strip them:
      const cleaned = typeof maybeB64 === "string" ? maybeB64.replace(/^"+|"+$/g, "") : maybeB64;

      const url = await uploadBase64ToS3(cleaned);
      return res.json({ ok: true, imageUrl: url, raw: imageResp });

    } else {
      const frontendMessages = Array.isArray(messages) ? messages : [{ role: "user", content: prompt }];
      const resp = await generateTextFromBedrock(frontendMessages);

      // Try to extract text from common response locations
      let text = null;
      try {
        const arr = resp?.output?.message?.content || [];
        for (const c of arr) {
          if (c && c.text) {
            text = c.text;
            break;
          }
        }
      } catch (e) {}

      if (!text) {
        text = JSON.stringify(resp).slice(0, 4000);
      }
      return res.json({ ok: true, text, raw: resp });
    }
  } catch (err) {
    console.error("GENERATE ERROR", err && err.stack ? err.stack : err);
    const msg = (err && err.message) ? err.message : String(err);
    if (msg.includes("403") || /access denied|not authorized/i.test(msg)) {
      return res.status(403).json({ error: "403 - Access denied to model", detail: msg });
    }
    return res.status(500).json({ error: "generate_failed", detail: msg });
  }
});

app.get("/health", (req, res) => res.json({ ok: true, pid: process.pid }));
app.listen(PORT, () => console.log(`Server listening on ${PORT} (region=${REGION})`));
