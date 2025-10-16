import '../amplify-config';
import { generateClient } from '@aws-amplify/api';
import { listNodes } from '../graphql/queries';
import type { NodeDTO } from './nodeService';
import { NodeAPI } from './nodeService';

const client = generateClient();

// Inline mutation for Lambda-backed batch scheduling
const CREATE_SCHEDULE_WITH_EVENTBRIDGE = /* GraphQL */ `
  mutation CreateScheduleWithEventBridge($input: ScheduleEventBridgeInput!) {
    createScheduleWithEventBridge(input: $input) {
      ok
      scheduled {
        scheduleId
        status
        scheduledDate
      }
      __typename
    }
  }
`;

export const scheduleService = {
  async createSchedules(nodes: Partial<NodeDTO>[]) {
    console.log('scheduleService.createSchedules called with:', nodes);

    const results = await Promise.all(nodes.map(async (node) => {
      try {
        // Check if schedule already exists
        const existingScheduleResult = await client.graphql({
          query: `query ListSchedules {
            listSchedules(filter: { scheduleId: { eq: "${node.id}" } }) {
              items {
                id
                scheduleId
              }
            }
          }`
        });
        
        const existingSchedules = (existingScheduleResult as any).data.listSchedules.items;
        const existingSchedule = existingSchedules.length > 0 ? existingSchedules[0] : null;
        
        const scheduleData = {
          scheduleId: node.id!,
          title: (node as any).title || 'Untitled',
          content: (node as any).description || (node as any).content || '',
          imageUrl: (node as any).imageUrl || null,
          imageUrls: (node as any).imageUrls || (node.imageUrl ? [node.imageUrl] : null),
          scheduledDate: node.scheduledDate ? new Date(node.scheduledDate).toISOString() : null,
          status: 'scheduled',
          userId: 'anonymous'
        };
        
        let scheduleResult;
        
        if (existingSchedule) {
          // Update existing schedule
          scheduleResult = await client.graphql({
            query: `mutation UpdateSchedule($input: UpdateScheduleInput!) {
              updateSchedule(input: $input) {
                id
                scheduleId
                title
                content
                imageUrl
                imageUrls
                scheduledDate
                status
                userId
              }
            }`,
            variables: { 
              input: {
                id: existingSchedule.id,
                ...scheduleData
              }
            }
          });
          console.log(`✅ Updated schedule: ${node.id}`, scheduleResult);
        } else {
          // Create new schedule
          scheduleResult = await client.graphql({
            query: `mutation CreateSchedule($input: CreateScheduleInput!) {
              createSchedule(input: $input) {
                id
                scheduleId
                title
                content
                imageUrl
                imageUrls
                scheduledDate
                status
                userId
              }
            }`,
            variables: { input: scheduleData }
          });
          console.log(`✅ Created schedule: ${node.id}`, scheduleResult);
        }
        
        return {
          id: node.id,
          scheduleId: node.id,
          ok: true,
          status: 'scheduled',
          scheduledDate: node.scheduledDate,
        };
      } catch (error) {
        console.error(`Failed to schedule node ${node.id}:`, error);
        return {
          id: node.id,
          scheduleId: node.id,
          ok: false,
          status: 'error',
          scheduledDate: node.scheduledDate,
        };
      }
    }));

    return { ok: true, results, scheduled: results.filter(r => r.ok) };
  },

  async listSchedules() {
    try {
      const result = await client.graphql({
        query: `query ListSchedules {
          listSchedules {
            items {
              id
              scheduleId
              title
              content
              imageUrl
              imageUrls
              scheduledDate
              status
              userId
              createdAt
              updatedAt
            }
          }
        }`
      });

      const items = (result as any).data.listSchedules.items || [];
      const schedules = items.map((item: any) => ({
        scheduleId: item.scheduleId,
        userId: item.userId,
        status: item.status,
        createdAt: item.createdAt,
        scheduledDate: item.scheduledDate,
        title: item.title,
        content: item.content,
        imageUrl: item.imageUrl,
        type: 'post'
      }));

      return { ok: true, schedules };
    } catch (error) {
      console.error('Failed to list schedules:', error);
      return { 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  async updateSchedule(node: any) {
    try {
      // First find the schedule to get its database ID
      const existingScheduleResult = await client.graphql({
        query: `query ListSchedules {
          listSchedules(filter: { scheduleId: { eq: "${node.id}" } }) {
            items {
              id
              scheduleId
            }
          }
        }`
      });
      
      const existingSchedules = (existingScheduleResult as any).data.listSchedules.items;
      if (existingSchedules.length === 0) {
        return { ok: false, error: 'Schedule not found' };
      }
      
      const schedule = existingSchedules[0];
      
      // Update the schedule
      await client.graphql({
        query: `mutation UpdateSchedule($input: UpdateScheduleInput!) {
          updateSchedule(input: $input) {
            id
            scheduleId
            title
            content
            imageUrl
            scheduledDate
            status
          }
        }`,
        variables: { 
          input: {
            id: schedule.id,
            title: node.title,
            content: node.content,
            imageUrl: node.imageUrl,
            scheduledDate: node.scheduledDate ? node.scheduledDate.toISOString() : null,
            status: node.status
          }
        }
      });
      
      console.log(`✅ Updated schedule: ${node.id}`);
      return { ok: true };
    } catch (error) {
      console.error(`Failed to update schedule ${node.id}:`, error);
      return { 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  async deleteSchedule(scheduleId: string) {
    try {
      // First find the schedule to get its database ID
      const existingScheduleResult = await client.graphql({
        query: `query ListSchedules {
          listSchedules(filter: { scheduleId: { eq: "${scheduleId}" } }) {
            items {
              id
              scheduleId
            }
          }
        }`
      });
      
      const existingSchedules = (existingScheduleResult as any).data.listSchedules.items;
      if (existingSchedules.length === 0) {
        return { ok: false, error: 'Schedule not found' };
      }
      
      const schedule = existingSchedules[0];
      
      // Delete the schedule using its database ID
      await client.graphql({
        query: `mutation DeleteSchedule($input: DeleteScheduleInput!) {
          deleteSchedule(input: $input) {
            id
            scheduleId
          }
        }`,
        variables: { 
          input: {
            id: schedule.id
          }
        }
      });
      
      console.log(`✅ Deleted schedule: ${scheduleId}`);
      return { ok: true };
    } catch (error) {
      console.error(`Failed to delete schedule ${scheduleId}:`, error);
      return { 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
};