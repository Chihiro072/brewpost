import { Router } from "express";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const router = Router();
const dynamo = new DynamoDBClient({ region: "us-east-1" });
const TABLE_NAME = process.env.SCHEDULES_TABLE || "SchedulesTable";

router.get("/list", async (req, res) => {
  try {
    const data = await dynamo.send(
      new ScanCommand({
        TableName: TABLE_NAME,
      })
    );

    // Convert DynamoDB records into plain JSON
    const schedules =
      data.Items?.map((item: any) => ({
        id: item.id.S,
        title: item.title.S,
        type: item.type.S,
        status: item.status.S,
        scheduledDate: item.scheduledDate?.S,
        content: item.content?.S,
        imageUrl: item.imageUrl?.S,
      })) || [];

    res.json({ ok: true, schedules });
  } catch (err) {
    console.error("Error fetching schedules:", err);
    res.status(500).json({ ok: false, error: "Failed to fetch schedules" });
  }
});

export default router;
