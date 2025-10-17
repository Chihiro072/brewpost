import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const sm = new SecretsManagerClient({}); // creds come from the EC2 instance role

export async function loadEnvFromSecrets(secretId = "env") {
  const res = await sm.send(new GetSecretValueCommand({ SecretId: secretId }));
  const raw = res.SecretString ?? Buffer.from(res.SecretBinary as any, "base64").toString("utf8");
  const parsed = JSON.parse(raw);
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = String(v);
  }
  return parsed; // if you also want the object
}