// pages/api/auth/exchange.ts
import { NextApiRequest, NextApiResponse } from 'next';

const CLIENT_ID = "26r93segq8ia0ra1ilggk02afa";
const CLIENT_SECRET = "hssdhk2sdn4o4llm8u0fq1gb751gqh3vpnhvk8e3uhjojde14vs";
const COGNITO_DOMAIN = "https://ap-southeast-1ktnxdaubg.auth.ap-southeast-1.amazoncognito.com";
const REDIRECT_URI = "http://localhost:8080/Callback"; // frontend callback page

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.body;

  if (!code) return res.status(400).json({ error: "No code provided" });

  try {
    const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokens = await response.json();
    if (tokens.error) return res.status(400).json(tokens);

    res.status(200).json(tokens);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Token exchange failed' });
  }
}
