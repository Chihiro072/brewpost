import apiClient from './apiService';
import type { NodeDTO } from './nodeService';
import { NodeAPI } from './nodeService';

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
      const response = await apiClient.get('/api/schedules');
      const raw = Array.isArray(response.data) ? response.data : [];
      const schedules = raw.map((item: any) => ({
        scheduleId: item.scheduleId || item.id,
        userId: item.userId,
        status: item.status,
        createdAt: item.createdAt,
        scheduledDate: item.scheduledDate,
        title: item.title,
        content: item.content,
        imageUrl: item.imageUrl,
        type: item.type || 'post'
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
      const response = await apiClient.put(`/api/schedules/update/${node.id}`, {
        title: node.title,
        content: node.content,
        imageUrl: node.imageUrl,
        scheduledDate: node.scheduledDate ? node.scheduledDate.toISOString() : null,
        status: node.status
      });
      console.log(`✅ Updated schedule: ${node.id}`, response.status);
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
      const response = await apiClient.delete(`/api/schedules/${scheduleId}`);
      console.log(`✅ Deleted schedule: ${scheduleId}`, response.status);
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