// pages/api/auth/login.ts
import { NextApiRequest, NextApiResponse } from 'next';

const CLIENT_ID = "26r93segq8ia0ra1ilggk02afa";
const COGNITO_DOMAIN = "https://ap-southeast-1ktnxdaubg.auth.ap-southeast-1.amazoncognito.com";
const REDIRECT_URI = "http://localhost:8080/Callback"; // frontend callback page

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const authUrl = `${COGNITO_DOMAIN}/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`;
  res.redirect(authUrl);
}
