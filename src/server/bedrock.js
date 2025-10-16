import fetch from "node-fetch";

// Invoke an Amazon Bedrock model via the runtime API with a simple timeout
export async function invokeModelViaHttp(region, modelId, bodyJson, accept = "application/json") {
  const API_KEY = process.env.BEARER_TOKEN_BEDROCK || process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.BEDROCK_BEARER_TOKEN;
  if (!API_KEY) throw new Error("Missing Bedrock bearer token env var (BEARER_TOKEN_BEDROCK / AWS_BEARER_TOKEN_BEDROCK)");

  if (!region) throw new Error("Missing region for Bedrock invocation");
  if (!modelId) throw new Error("Missing modelId for Bedrock invocation");

  const encodedModel = encodeURIComponent(modelId);
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModel}/invoke`;

  // Short timeout to avoid Nginx upstream timeouts; allow override via env (ms)
  const timeoutMs = parseInt(process.env.BEDROCK_INVOKE_TIMEOUT_MS || "60000", 10);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  console.log('DEBUG: Bedrock invoke url:', url);
  console.log('DEBUG: Bedrock modelId (raw):', modelId);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: accept,
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(bodyJson),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Bedrock invoke aborted after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    // include response body so you can inspect server error
    const short = (text || '').slice(0, 2000);
    throw new Error(`Bedrock error ${res.status}: ${short}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
