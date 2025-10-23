import apiClient from './apiService';
import type { NodeDTO } from './nodeService';
import { NodeAPI } from './nodeService';
import { generateClient } from 'aws-amplify/api';

// Initialize the Amplify GraphQL client
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

export async function createScheduleService(scheduleData: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Schedule | null> {
  try {
    const response = await apiClient.post('/api/schedules', scheduleData);
    return response.data || null;
  } catch (error) {
    console.error('Error creating schedule:', error);
    return null;
  }
}

export async function updateScheduleService(id: string, scheduleData: Partial<Schedule>): Promise<Schedule | null> {
  try {
    const response = await apiClient.put(`/api/schedules/${id}`, scheduleData);
    return response.data || null;
  } catch (error) {
    console.error('Error updating schedule:', error);
    return null;
  }
}

export async function deleteScheduleService(id: string): Promise<boolean> {
  try {
    const response = await apiClient.delete(`/api/schedules/${id}`);
    return response.status === 200 || response.status === 204;
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return false;
  }
}

export const scheduleService = {
  async createSchedules(nodes: Partial<NodeDTO>[]) {
    try {
      console.log('[scheduleService] Creating schedules for nodes:', nodes);
      
      const response = await apiClient.post('/api/schedules/batch', { nodes });
      
      console.log('[scheduleService] Batch create result:', response.data);
      return response.data || [];
    } catch (error) {
      console.error('[scheduleService] Error creating schedules:', error);
      return [];
    }
  },

  async fetchSchedules() {
    try {
      console.log('[scheduleService] Fetching schedules');
      
      const response = await apiClient.get('/api/schedules');
      
      console.log('[scheduleService] Fetch schedules result:', response.data);
      return response.data || [];
    } catch (error) {
      console.error('[scheduleService] Error fetching schedules:', error);
      return [];
    }
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