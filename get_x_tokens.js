// get_x_tokens.js  (Node 18+ / ESM)
// Usage (PowerShell):
//   $env:X_CLIENT_ID="<YOUR_OAUTH2_CLIENT_ID>"
//   # optional if you created a confidential client:
//   $env:X_CLIENT_SECRET="<YOUR_CLIENT_SECRET>"
//   node get_x_tokens.js

import http from "http";
import crypto from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ---- load .env (optional) ---------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
for (const envPath of [join(__dirname, ".env"), join(__dirname, "..", ".env")]) {
  try {
    const env = readFileSync(envPath, "utf8");
    env.split("\n").forEach((l) => {
      const s = l.trim();
      if (!s || s.startsWith("#")) return;
      const [k, ...v] = s.split("=");
      if (k && v.length) process.env[k] = v.join("=").trim();
    });
    console.log(`Loaded .env from ${envPath}`);
    break;
  } catch { /* ignore */ }
}

// ---- config -----------------------------------------------------------------
const client_id = process.env.X_CLIENT_ID;
const client_secret = process.env.X_CLIENT_SECRET || null;

// Change port here if 8989 is busy
const REDIRECT_URI = (process.env.X_REDIRECT_URI || "http://127.0.0.1:8989/Callback").trim();
const SCOPE = "tweet.write tweet.read users.read offline.access";
if (!client_id) {
  console.error("Missing X_CLIENT_ID. Set env or .env file.");
  process.exit(1);
}

// ---- PKCE -------------------------------------------------------------------
const code_verifier = crypto.randomBytes(32).toString("base64url");
const code_challenge = crypto.createHash("sha256").update(code_verifier).digest("base64url");

// ---- open authorize URL -----------------------------------------------------
const authURL =
  `https://x.com/i/oauth2/authorize?response_type=code` +
  `&client_id=${encodeURIComponent(client_id)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&state=state123&code_challenge=${code_challenge}&code_challenge_method=S256`;

console.log("PKCE code_verifier (keep for this run):", code_verifier);
console.log("\nOpen and approve:\n", authURL, "\n");

// ---- tiny callback server ---------------------------------------------------
http.createServer(async (req, res) => {
  console.log("Inbound:", req.url);
  const path = req.url.split("?")[0].toLowerCase();
  if (path !== "/callback") {
    res.writeHead(404);
    res.end("Not Found - expected /Callback");
    return;
  }

  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  if (!code) { res.writeHead(400); res.end("Missing code"); return; }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier
  });

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (client_secret) {
    const basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");
    headers["Authorization"] = `Basic ${basic}`;
  } else {
    body.set("client_id", client_id); // public client
  }

  const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers,
    body
  });

  const json = await tokenRes.json();
  console.log("\nTokens:", json, "\n");

  if (!tokenRes.ok || !json.access_token) {
    res.writeHead(500);
    res.end("Token exchange failed; see console.");
    process.exit(1);
  }

  // persist for convenience (DON'T commit this file)
  writeFileSync(join(__dirname, "x_tokens.json"), JSON.stringify(json, null, 2));
  res.end("Tokens received. You can close this tab.");
  process.exit(0);
}).listen(new URL(REDIRECT_URI).port, () => console.log("Listening on", REDIRECT_URI));
