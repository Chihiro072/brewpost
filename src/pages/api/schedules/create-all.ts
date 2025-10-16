import { Router } from "express";
import { EventBridgeClient, PutRuleCommand, PutTargetsCommand, RemoveTargetsCommand, DeleteRuleCommand } from "@aws-sdk/client-eventbridge";
import type { NextApiRequest, NextApiResponse } from "next";
import AWS from "aws-sdk";

const router = Router();
const eventbridge = new EventBridgeClient({ region: "us-east-1" });

const REGION = process.env.REGION || "us-east-1";
const TABLE_NAME = process.env.SCHEDULES_TABLE || "SchedulesTable";

// --- Replace router.post("/create-all", ...) with Lambda invocation ---
router.post("/create-all", async (req, res) => {
  const { nodes } = req.body;
  if (!nodes || !Array.isArray(nodes)) {
    return res.status(400).json({ ok: false, error: "nodes array required" });
  }

  const lambdaName = process.env.SCHEDULES_LAMBDA_NAME || process.env.SCHEDULES_LAMBDA_ARN;
  const lambdaFuncUrl = process.env.SCHEDULES_LAMBDA_FUNC_URL || null; // <-- new env var
  if (!lambdaName && !lambdaFuncUrl) {
    return res.status(500).json({ ok: false, error: 'schedules_lambda_not_configured', detail: 'Set SCHEDULES_LAMBDA_NAME or SCHEDULES_LAMBDA_ARN or SCHEDULES_LAMBDA_FUNC_URL' });
  }

  const userId = req.headers['x-user-id'] || req.body.userId || 'anonymous';

  // NEW: guard empty nodes at runtime
  if (!Array.isArray(nodes) || nodes.length === 0) {
    console.warn('API create-all invoked with empty nodes.');
    return res.status(400).json({ ok: false, error: 'nodes_empty', detail: 'No nodes provided to schedule' });
  }

  const payload = { 
    action: 'createAll', 
    userId, 
    nodes, 
    nodes_count: Array.isArray(nodes) ? nodes.length : 0,
    debug: { schedulesTable: TABLE_NAME, region: REGION }
  };

  // Debug log when enabled
  if (process.env.SCHEDULES_DEBUG === 'true') {
    console.log('create-all payload nodes_count=', payload.nodes_count, 'firstNodePreview=', nodes[0] ? { id: nodes[0].id, title: nodes[0].title } : null, 'debug=', payload.debug);
  }

  // Try SDK invoke first
  if (lambdaName) {
    const lambda = new AWS.Lambda({ region: REGION });
    try {
      const resp = await lambda.invoke({ FunctionName: lambdaName, InvocationType: 'RequestResponse', Payload: JSON.stringify(payload) }).promise();
      let parsed;
      try { parsed = resp.Payload ? JSON.parse(String(resp.Payload)) : null; } catch (e) { parsed = null; }

      if (resp.FunctionError) {
        console.error('Schedules lambda function error via SDK:', parsed || resp);
        if (lambdaFuncUrl && /AccessDenied|not authorized|AccessDeniedException/i.test(JSON.stringify(parsed || ''))) {
          console.warn('Function error looks like access denied; attempting function URL fallback.');
        } else {
          return res.status(500).json({ ok: false, error: 'schedules_lambda_error', detail: parsed || resp });
        }
      } else {
        console.log('Schedules lambda SDK response (parsed):', parsed);
        if (parsed && parsed.ok && Array.isArray(parsed.scheduled) && parsed.scheduled.length === 0) {
          console.warn('Lambda returned ok but scheduled array empty. Surface full lambda response to caller for inspection.');
          return res.status(200).json({ ok: true, warning: 'lambda_ok_but_no_items', lambdaResponse: parsed });
        }
        return res.json(parsed ?? { ok: true, scheduled: [] });
      }
    } catch (sdkErr) {
      const msg = sdkErr && sdkErr.message ? sdkErr.message : String(sdkErr);
      console.error('Lambda SDK invoke failed:', msg);

      const isInvokeDenied = /not authorized to perform: lambda:InvokeFunction/i.test(msg) ||
                             /is not authorized to perform: lambda:InvokeFunction/i.test(msg);

      if (isInvokeDenied) {
        console.warn('Detected missing lambda:InvokeFunction permission for current identity.');
        if (lambdaFuncUrl) {
          console.warn('Falling back to configured Lambda Function URL:', lambdaFuncUrl);
          // fallthrough to HTTP fallback below
        } else {
          const detail = {
            message: msg,
            hint: 'The server identity is missing lambda:InvokeFunction on the dispatcher Lambda. Attach a policy allowing lambda:InvokeFunction for the function ARN (see aws/allow-invoke-lambda-policy.json).'
          };
          console.error('Lambda invoke authorization error (no function URL):', detail);
          return res.status(403).json({ ok: false, error: 'lambda_invoke_authorization_error', detail });
        }
      } else {
        if (/access denied|not authorized|AccessDenied|AccessDeniedException/i.test(msg) && lambdaFuncUrl) {
          console.warn('Lambda SDK invoke denied; falling back to function URL.');
        } else {
          return res.status(500).json({ ok: false, error: 'invoke_failed', detail: msg });
        }
      }
    }
  }

  // Fallback to Function URL
  if (lambdaFuncUrl) {
    try {
      const funcHeaders: Record<string,string> = { 'Content-Type': 'application/json' };
      if (process.env.SCHEDULES_LAMBDA_FUNC_URL_AUTH) {
        funcHeaders['Authorization'] = process.env.SCHEDULES_LAMBDA_FUNC_URL_AUTH;
      }

      console.log(`POST ${lambdaFuncUrl} with nodes_count=${payload.nodes_count}`);

      const resp = await fetch(lambdaFuncUrl, {
        method: 'POST',
        headers: funcHeaders,
        body: JSON.stringify(payload)
      });
      const parsed = await resp.json().catch(() => null);
      if (!resp.ok) {
        console.error('Function URL returned non-200:', resp.status, parsed);
        return res.status(500).json({ ok: false, error: 'function_url_error', status: resp.status, detail: parsed });
      }
      console.log('Function URL response:', parsed);

      // if function reports success but did not return scheduled items -> surface as error
      const hasScheduledArray = parsed && Array.isArray(parsed.scheduled);
      const reportedSuccess = parsed && (parsed.ok === true || parsed.success === true);
      if (reportedSuccess && !hasScheduledArray) {
        console.error('Function URL responded success but no scheduled items were returned:', parsed);
        return res.status(500).json({
          ok: false,
          error: 'lambda_success_no_items',
          detail: 'Lambda function responded with success but did not return any scheduled items. Check Lambda logs and that it received nodes (nodes_count).',
          nodes_count_sent: payload.nodes_count,
          lambdaResponse: parsed
        });
      }

      return res.json(parsed ?? { ok: true, scheduled: [] });
    } catch (err) {
      console.error('Function URL invoke failed:', err);
      return res.status(500).json({ ok: false, error: 'function_url_invoke_failed', detail: err && (err as any).message ? (err as any).message : String(err) });
    }
  }

  return res.status(500).json({ ok: false, error: 'no_invoke_path' });
});

export default router;

// --- Replace nextHandler POST behavior to invoke Lambda too ---
export async function nextHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { nodes } = req.body;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json({ ok: false, error: "nodes array required" });
  }

  const results: any[] = [];
  const errors: any[] = [];

  // small retry helper
  async function retryable(fn: () => Promise<any>, attempts = 3, baseDelay = 200) {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`Retryable attempt ${i + 1} failed, retrying in ${delay}ms:`, err && err.message ? err.message : err);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  for (const node of nodes) {
    try {
      // pick userId from header/body if provided, else 'anonymous' (Next APIs typically don't have express sessions)
      const userId = (req.headers['x-user-id'] as string) || (req.body && req.body.userId) || 'anonymous';
      const scheduledDateISO = node.scheduledDate ? (typeof node.scheduledDate === "string" ? node.scheduledDate : new Date(node.scheduledDate).toISOString()) : null;

      // Use scheduleId as PK
      const item = {
        scheduleId: node.id,
        userId,
        status: "scheduled",
        createdAt: new Date().toISOString(),
        ...(scheduledDateISO ? { scheduledDate: scheduledDateISO } : {})
      };

      try {
        await retryable(() => DDB.put({ TableName: TABLE_NAME, Item: item }).promise(), 3, 200);
      } catch (ddbErr) {
        const msg = ddbErr && ddbErr.message ? ddbErr.message : String(ddbErr);
        console.error("DynamoDB put failed:", ddbErr);

        // If this is an authorization error, return immediately with guidance
        if (/access denied|not authorized|AccessDenied|AccessDeniedException/i.test(msg)) {
          const detail = {
            message: msg,
            hint: 'IAM permission error: the identity used by the server is missing dynamodb:PutItem for the target table. Attach an IAM policy allowing PutItem on the table ARN or run the server with credentials that have this permission.'
          };
          console.error('DynamoDB authorization error detected:', detail);
          return res.status(500).json({ ok: false, error: 'DynamoDB authorization error', detail });
        }

        errors.push({ id: node.id, reason: `DynamoDB put failed: ${msg}` });
        results.push({ scheduleId: node.id, status: "failed", reason: msg });
        continue;
      }

      results.push({ scheduleId: node.id, status: "scheduled", scheduledDate: scheduledDateISO || null });
    } catch (err) {
      console.error("Error creating schedule:", err);
      errors.push({ id: node?.id ?? null, error: (err as any).message ?? String(err) });
      results.push({ scheduleId: node?.id ?? null, status: "failed", warning: (err as any).message ?? String(err) });
    }
  }

  // Return 200 and ok:true so frontend flow doesn't treat partial errors as fatal.
  const partial = errors.length > 0;
  return res.json({ ok: true, scheduled: results, partial, errors: partial ? errors : undefined });
}
