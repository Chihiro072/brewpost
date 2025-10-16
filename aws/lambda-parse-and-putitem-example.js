// Minimal Node.js Lambda handler example — adapt and deploy into ScheduleDispatcherFn
const AWS = require('aws-sdk');
const DDB = new AWS.DynamoDB.DocumentClient();
const SNS = new AWS.SNS();
const TABLE = process.env.SCHEDULES_TABLE || 'Schedules';
const REGION = process.env.REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

exports.handler = async (event) => {
  // ...basic diagnostics
  console.log('Lambda invoked. REGION=', REGION, 'ENV_SCHEDULES_TABLE=', process.env.SCHEDULES_TABLE);
  console.log('Raw event:', JSON.stringify(event).slice(0, 10000));

  // Normalize payload: support direct JSON and API/Function-URL envelope
  let payload = event;
  try {
    if (event && typeof event.body === 'string') {
      payload = JSON.parse(event.body);
      console.log('Parsed event.body -> payload');
    } else if (event && event.body && typeof event.body === 'object') {
      payload = event.body;
      console.log('event.body is object -> payload');
    }
  } catch (e) {
    console.error('Failed to parse event.body:', e);
    return {
      ok: false,
      error: 'invalid_body',
      detail: String(e),
      receivedEventSample: String(event).slice(0, 2000)
    };
  }

  // Surface helpful debug info early
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  console.log('Payload keys:', Object.keys(payload));
  console.log('nodes_count_received=', nodes.length, 'userId=', payload.userId || null);

  if (nodes.length === 0) {
    return {
      ok: false,
      error: 'no_nodes',
      detail: 'No nodes received in payload',
      nodes_count_received: 0,
      receivedPayloadSample: payload && (payload.nodes ? { nodes_preview: payload.nodes.slice(0,3) } : payload)
    };
  }

  const results = [];
  for (const node of nodes) {
    const item = {
      scheduleId: node.id,
      userId: payload.userId || 'anonymous',
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      scheduledDate: node.scheduledDate || null,
      title: node.title || 'Untitled',
      content: node.content || null,
      imageUrl: node.imageUrl || null
    };

    try {
      // Log intended PutItem (never log full sensitive item in prod)
      console.log('Putting item to table', TABLE, 'scheduleId=', item.scheduleId, 'title=', item.title);
      await DDB.put({ TableName: TABLE, Item: item }).promise();
      results.push({ scheduleId: item.scheduleId, status: 'scheduled', scheduledDate: item.scheduledDate, title: item.title });
    } catch (err) {
      console.error('DynamoDB put failed for', item.scheduleId, err && err.message ? err.message : err);
      results.push({ scheduleId: item.scheduleId, status: 'failed', reason: String(err) });
    }
  }

  const ok = results.every(r => r.status === 'scheduled');

  // Helpful full diagnostic return to server/client
  return {
    ok,
    scheduled: results,
    nodes_count_received: nodes.length,
    targetTable: TABLE,
    region: REGION
  };
};
