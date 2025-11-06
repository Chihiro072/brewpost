// src/services/nodeService.ts
import apiClient from './apiService';
import type { ContentNode } from '@/components/planning/PlanningPanel';

export async function fetchNodes(): Promise<ContentNode[]> {
  try {
    console.log('[nodeService] fetchNodes called');
    const response = await apiClient.get('/api/nodes');
    console.log('[nodeService] fetchNodes result:', response.data);
    
    // Transform the API response to match ContentNode interface
    const nodes = response.data?.map((node: any) => ({
      id: node.id,
      title: node.title,
      type: node.type,
      status: node.status,
      scheduledDate: node.scheduledDate ? new Date(node.scheduledDate) : undefined,
      content: node.description || node.content || '',
      imageUrl: node.imageUrl,
      imageUrls: node.imageUrls,
      imagePrompt: node.imagePrompt,
      day: node.day,
      postType: node.postType,
      focus: node.focus,
      connections: Array.isArray(node.connections) ? node.connections : [],
      position: { x: node.x || 0, y: node.y || 0 },
      postedAt: node.postedAt ? new Date(node.postedAt) : undefined,
      postedTo: node.postedTo,
      tweetId: node.tweetId,
      selectedImageUrl: node.selectedImageUrl
    })) || [];
    
    return nodes;
  } catch (error) {
    console.error('[nodeService] Error fetching nodes:', error);
    return [];
  }
}

export async function createNodeService(nodeData: Partial<ContentNode>): Promise<ContentNode | null> {
  try {
    console.log('[nodeService] createNodeService called with:', nodeData);
    
    const requestData = {
      title: nodeData.title,
      description: nodeData.content,
      type: nodeData.type,
      status: nodeData.status,
      x: nodeData.position?.x,
      y: nodeData.position?.y,
      imageUrl: nodeData.imageUrl,
      imageUrls: nodeData.imageUrls,
      imagePrompt: nodeData.imagePrompt,
      day: nodeData.day,
      postType: nodeData.postType,
      focus: nodeData.focus,
      scheduledDate: nodeData.scheduledDate,
      connections: Array.isArray(nodeData.connections) ? nodeData.connections : [],
    };
    
    const response = await apiClient.post('/api/nodes', requestData);
    console.log('[nodeService] createNodeService result:', response.data);
    
    // Transform response to ContentNode
    const node = response.data;
    return {
      id: node.id,
      title: node.title,
      type: node.type,
      status: node.status,
      scheduledDate: node.scheduledDate ? new Date(node.scheduledDate) : undefined,
      content: node.description || node.content || '',
      imageUrl: node.imageUrl,
      imageUrls: node.imageUrls,
      imagePrompt: node.imagePrompt,
      day: node.day,
      postType: node.postType,
      focus: node.focus,
      connections: Array.isArray(node.connections) ? node.connections : [],
      position: { x: node.x || 0, y: node.y || 0 },
      postedAt: node.postedAt ? new Date(node.postedAt) : undefined,
      postedTo: node.postedTo,
      tweetId: node.tweetId,
      selectedImageUrl: node.selectedImageUrl
    };
  } catch (error) {
    console.error('[nodeService] Error creating node:', error);
    return null;
  }
}

export async function updateNodeService(id: string, nodeData: Partial<ContentNode>): Promise<ContentNode | null> {
  try {
    console.log('[nodeService] updateNodeService called with:', { id, nodeData });
    
    const requestData = {
      title: nodeData.title,
      description: nodeData.content,
      type: nodeData.type,
      status: nodeData.status,
      x: nodeData.position?.x,
      y: nodeData.position?.y,
      imageUrl: nodeData.imageUrl,
      imageUrls: nodeData.imageUrls,
      imagePrompt: nodeData.imagePrompt,
      day: nodeData.day,
      postType: nodeData.postType,
      focus: nodeData.focus,
      scheduledDate: nodeData.scheduledDate,
      selectedImageUrl: nodeData.selectedImageUrl,
      connections: Array.isArray(nodeData.connections) ? nodeData.connections : undefined,
    };
    
    console.log('[nodeService] Sending PUT request to:', `/api/nodes/${id}`);
    console.log('[nodeService] Request payload:', JSON.stringify(requestData, null, 2));
    
    const response = await apiClient.put(`/api/nodes/${id}`, requestData);
    console.log('[nodeService] updateNodeService result:', response.data);
    
    // Transform response to ContentNode
    const node = response.data;
    return {
      id: node.id,
      title: node.title,
      type: node.type,
      status: node.status,
      scheduledDate: node.scheduledDate ? new Date(node.scheduledDate) : undefined,
      content: node.description || node.content || '',
      imageUrl: node.imageUrl,
      imageUrls: node.imageUrls,
      imagePrompt: node.imagePrompt,
      day: node.day,
      postType: node.postType,
      focus: node.focus,
      connections: Array.isArray(node.connections) ? node.connections : [],
      position: { x: node.x || 0, y: node.y || 0 },
      postedAt: node.postedAt ? new Date(node.postedAt) : undefined,
      postedTo: node.postedTo,
      tweetId: node.tweetId,
      selectedImageUrl: node.selectedImageUrl
    };
  } catch (error) {
    console.error('[nodeService] Error updating node:', error);
    return null;
  }
}

export async function deleteNodeService(id: string): Promise<boolean> {
  try {
    console.log('[nodeService] deleteNodeService called with:', id);
    const response = await apiClient.delete(`/api/nodes/${id}`);
    console.log('[nodeService] deleteNodeService result:', response.status);
    return response.status === 200 || response.status === 204;
  } catch (error) {
    console.error('[nodeService] Error deleting node:', error);
    return false;
  }
}

// Legacy GraphQL functions removed - now using REST API

export type NodeDTO = {
  id: string;
  projectId: string;
  nodeId: string;
  title: string;
  description?: string | null;
  x?: number | null;
  y?: number | null;
  status?: string | null;
  contentId?: string | null;
  type?: string | null;
  day?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  imagePrompt?: string | null;
  scheduledDate?: string | null;
  selectedImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

// Helper to normalize backend response into NodeDTO
const toNodeDTO = (node: any): NodeDTO => ({
  id: node.id,
  projectId: node.projectId ?? 'default',
  nodeId: node.nodeId ?? node.id,
  title: node.title,
  description: node.description ?? node.content ?? null,
  x: node.x ?? null,
  y: node.y ?? null,
  status: node.status ?? null,
  contentId: node.contentId ?? node.id ?? null,
  type: node.type ?? null,
  day: node.day ?? null,
  imageUrl: node.imageUrl ?? null,
  imageUrls: node.imageUrls ?? null,
  imagePrompt: node.imagePrompt ?? null,
  scheduledDate: node.scheduledDate ?? null,
  selectedImageUrl: node.selectedImageUrl ?? null,
  createdAt: node.createdAt ?? new Date().toISOString(),
  updatedAt: node.updatedAt ?? new Date().toISOString(),
});

// Check if AppSync client is available
function hasAppSync(): boolean {
  try {
    const apiKey = (import.meta.env.VITE_APPSYNC_API_KEY as string);
    const clientAny = (typeof window !== 'undefined') ? (window as any).client : undefined;
    return !!apiKey && !!clientAny && typeof clientAny.graphql === 'function';
  } catch {
    return false;
  }
}

// NodeAPI object for compatibility with existing code - now using REST API
export const NodeAPI = {
  list: async (projectId?: string) => {
    try {
      console.log('[NodeAPI] list called');
      const resp = await apiClient.get('/api/nodes', { params: projectId ? { projectId } : {} });
      const raw = Array.isArray(resp.data) ? resp.data : [];
      const nodes: NodeDTO[] = raw.map(toNodeDTO);
      return nodes;
    } catch (error) {
      console.error('[NodeAPI] Error in list:', error);
      throw error;
    }
  },

  create: async (input: any) => {
    try {
      console.log('[NodeAPI] create called with:', input);
      const requestData = {
        title: input.title,
        description: input.description ?? input.content,
        type: input.type,
        status: input.status,
        x: input.x,
        y: input.y,
        imageUrl: input.imageUrl,
        imageUrls: input.imageUrls,
        imagePrompt: input.imagePrompt,
        day: input.day,
        postType: input.postType,
        focus: input.focus,
        scheduledDate: input.scheduledDate,
        selectedImageUrl: input.selectedImageUrl,
        connections: Array.isArray(input.connections) ? input.connections : [],
      };
      const resp = await apiClient.post('/api/nodes', requestData);
      const node = toNodeDTO(resp.data);
      return node;
    } catch (error) {
      console.error('[NodeAPI] Error in create:', error);
      throw error;
    }
  },

  update: async (input: any) => {
    try {
      console.log('[NodeAPI] update called with:', input);
      const nodeId = input.id || input.nodeId;
      const requestData = {
        title: input.title,
        description: input.description ?? input.content,
        type: input.type,
        status: input.status,
        x: input.x,
        y: input.y,
        imageUrl: input.imageUrl,
        imageUrls: input.imageUrls,
        imagePrompt: input.imagePrompt,
        day: input.day,
        postType: input.postType,
        focus: input.focus,
        scheduledDate: input.scheduledDate,
        selectedImageUrl: input.selectedImageUrl,
        connections: Array.isArray(input.connections) ? input.connections : undefined,
      };
      const resp = await apiClient.put(`/api/nodes/${nodeId}`, requestData);
      const node = toNodeDTO(resp.data);
      return node;
    } catch (error) {
      console.error('[NodeAPI] Error in update:', error);
      throw error;
    }
  },

  async remove(projectId: string, nodeId: string) {
    try {
      console.log('[NodeAPI] remove called for:', { projectId, nodeId });
      await apiClient.delete(`/api/nodes/${nodeId}`);
      return { ok: true };
    } catch (error) {
      console.error('Error deleting node:', error);
      throw error;
    }
  },

  // Edge operations via REST: persist connections array on source node
  async listEdges(projectId: string) {
    try {
      // Fetch nodes and convert connections to edges
      const resp = await apiClient.get('/api/nodes', { params: projectId ? { projectId } : {} });
      const nodes = Array.isArray(resp.data) ? resp.data : [];
      const edges: { edgeId:string; from:string; to:string }[] = [];
      for (const n of nodes) {
        const from = n.id || n.nodeId;
        const conns = Array.isArray(n.connections) ? n.connections : [];
        for (const to of conns) {
          edges.push({ edgeId: `${from}->${to}`, from, to });
        }
      }
      return edges;
    } catch (error) {
      console.error('[NodeAPI] Error listing edges via REST:', error);
      return [] as { edgeId:string; from:string; to:string }[];
    }
  },

  async createEdge(projectId: string, from: string, to: string) {
    try {
      // Get the source node, append connection, update
      const sourceResp = await apiClient.get(`/api/nodes/${from}`);
      const source = sourceResp.data;
      const current = Array.isArray(source.connections) ? source.connections : [];
      if (current.includes(to)) {
        return { edgeId: `${from}->${to}`, from, to };
      }
      const updated = [...current, to];
      await apiClient.put(`/api/nodes/${from}`, { connections: updated });
      return { edgeId: `${from}->${to}`, from, to };
    } catch (error) {
      console.error('[NodeAPI] Error creating edge via REST:', error);
      return { edgeId: `temp-${from}-${to}`, from, to };
    }
  },

  async deleteEdge(projectId: string, edgeId: string) {
    try {
      const [from, to] = edgeId.includes('->') ? edgeId.split('->') : [undefined, undefined];
      if (!from || !to) return;
      const sourceResp = await apiClient.get(`/api/nodes/${from}`);
      const source = sourceResp.data;
      const current = Array.isArray(source.connections) ? source.connections : [];
      const updated = current.filter((c: string) => c !== to);
      await apiClient.put(`/api/nodes/${from}`, { connections: updated });
    } catch (error) {
      console.error('[NodeAPI] Error deleting edge via REST:', error);
    }
  },

  // Subscriptions temporarily disabled
  subscribe(projectId: string, onEvent: (evt: { type:'created'|'updated'|'deleted'|'edge'; payload: any }) => void) {
    console.log('Subscriptions temporarily disabled');
    return () => {};
  },
};
