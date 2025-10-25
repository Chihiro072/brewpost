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
      connections: node.connections || [],
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
      scheduledDate: nodeData.scheduledDate
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
      connections: node.connections || [],
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
      selectedImageUrl: nodeData.selectedImageUrl
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
      connections: node.connections || [],
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
  createdAt: string;
  updatedAt: string;
};


// NodeAPI object for compatibility with existing code - now using REST API
export const NodeAPI = {
  list: async () => {
    try {
      console.log('[NodeAPI] list called');
      const nodes = await fetchNodes();
      // Return in GraphQL-like format for compatibility
      return {
        data: {
          listNodes: {
            items: nodes
          }
        }
      };
    } catch (error) {
      console.error('[NodeAPI] Error in list:', error);
      throw error;
    }
  },

  create: async (input: any) => {
    try {
      console.log('[NodeAPI] create called with:', input);
      const node = await createNodeService(input);
      // Return in GraphQL-like format for compatibility
      return {
        data: {
          createNode: node
        }
      };
    } catch (error) {
      console.error('[NodeAPI] Error in create:', error);
      throw error;
    }
  },

  update: async (input: any) => {
    try {
      console.log('[NodeAPI] update called with:', input);
      const nodeId = input.id || input.nodeId;
      const node = await updateNodeService(nodeId, input);
      // Return in GraphQL-like format for compatibility
      return {
        data: {
          updateNode: node
        }
      };
    } catch (error) {
      console.error('[NodeAPI] Error in update:', error);
      throw error;
    }
  },
  async remove(projectId: string, nodeId: string) {
    try {
      console.log('Deleting node:', { projectId, nodeId });
      // Find the node first to get the database id
      const filter = { projectId: { eq: projectId }, nodeId: { eq: nodeId } };
  const listResponse = await (client.graphql as any)({ query: listNodes, variables: { filter }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } });
      const items = (listResponse as any).data.listNodes.items || [];
      
      if (items.length === 0) {
        throw new Error(`Node not found: ${nodeId}`);
      }
      
      const nodeToDelete = items[0];
      const deleteInput = { id: nodeToDelete.id };
      
      const response = await (client.graphql as any)({ query: deleteNode, variables: { input: deleteInput }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } });
      console.log('Delete node response:', response);
      return response;
    } catch (error) {
      console.error('Error deleting node:', error);
      if (error && typeof error === 'object' && 'errors' in error) {
        console.error('GraphQL errors:', (error as any).errors);
        const errors = (error as any).errors;
        let hasNullFieldErrors = false;
        errors?.forEach((err: any, index: number) => {
            console.error(`Error ${index + 1}:`, err.message);
          if (err.locations) console.error('Locations:', err.locations);
          if (err.path) console.error('Path:', err.path);
          if (err.message && err.message.includes('Cannot return null for non-nullable type')) {
            hasNullFieldErrors = true;
          }
        });
        if (hasNullFieldErrors && errors.length <= 3) {
          console.log('Deletion likely succeeded despite GraphQL schema issues');
          return { data: { deleteNode: { projectId, nodeId } } };
        }
      }
      throw error;
    }
  },

  // Edges
  async listEdges(projectId: string) {
    try {
      console.log('Fetching edges for project:', projectId);
      const filter = { projectId: { eq: projectId } };
      const response = await (client.graphql as any)({ query: listEdges, variables: { filter }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } });
      console.log('List edges response:', response);
      const items = (response as any).data.listEdges.items || [];
      console.log('List edges data:', items);
      return items as { edgeId:string; from:string; to:string }[];
    } catch (error) {
      console.error('Error listing edges:', error);
      throw error;
    }
  },
  async createEdge(projectId: string, from: string, to: string, label?: string) {
    try {
      console.log('Creating edge:', { projectId, from, to, label });
      
      // Check if edge already exists in either direction
      const filter = { 
        projectId: { eq: projectId },
        or: [
          { and: [{ from: { eq: from } }, { to: { eq: to } }] },
          { and: [{ from: { eq: to } }, { to: { eq: from } }] }
        ]
      };
      
  const existingResponse = await (client.graphql as any)({ query: listEdges, variables: { filter }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } });
      const existingEdges = (existingResponse as any).data.listEdges.items || [];
      
      if (existingEdges.length > 0) {
        console.log('Edge already exists:', existingEdges[0]);
        return existingEdges[0]; // Return existing edge
      }
      
      const edgeInput = {
        projectId,
        edgeId: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from,
        to
      };
  const response = await (client.graphql as any)({ query: createEdge, variables: { input: edgeInput }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } });
      console.log('Create edge response:', response);
      return (response as any).data.createEdge;
    } catch (error) {
      console.error('Error creating edge:', error);
      throw error;
    }
  },
  async deleteEdge(projectId: string, edgeId: string) {
    try {
      console.log('Deleting edge:', { projectId, edgeId });
      
      // First find the edge to get the database ID
      const filter = { projectId: { eq: projectId }, edgeId: { eq: edgeId } };
  const listResponse = await (client.graphql as any)({ query: listEdges, variables: { filter }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } });
      const items = (listResponse as any).data.listEdges.items || [];
      
      if (items.length === 0) {
        console.warn(`Edge not found: ${edgeId}`);
        return; // Edge doesn't exist, consider it deleted
      }
      
      const edgeToDelete = items[0];
      const deleteInput = { id: edgeToDelete.id };
      
  const response = await (client.graphql as any)({ query: deleteEdge, variables: { input: deleteInput }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } });
      console.log('Delete edge response:', response);
      return response;
    } catch (error) {
      console.error('Error deleting edge:', error);
      throw error;
    }
  },

  // Subscriptions temporarily disabled
  subscribe(projectId: string, onEvent: (evt: { type:'created'|'updated'|'deleted'|'edge'; payload: any }) => void) {
    console.log('Subscriptions temporarily disabled');
    return () => {};
  },
};
