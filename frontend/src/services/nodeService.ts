// src/services/nodeService.ts
import apiClient from './apiService';
import type { ContentNode } from '@/components/planning/PlanningPanel';
// Direct AppSync endpoint (matches amplify-config.ts)
const APPSYNC_ENDPOINT = 'https://hgaezqpz7jbztedzzsrn74hqki.appsync-api.us-east-1.amazonaws.com/graphql';

export async function fetchNodes(): Promise<ContentNode[]> {
  try {
    console.log('[nodeService] fetchNodes called');
    const response = await apiClient.get('/api/nodes');
    console.log('[nodeService] fetchNodes result:', response.data);
    return response.data || [];
  } catch (error) {
    console.error('[nodeService] Error fetching nodes:', error);
    return [];
  }
}

export async function createNodeService(nodeData: Partial<ContentNode>): Promise<ContentNode | null> {
  try {
    console.log('[nodeService] createNodeService called with:', nodeData);
    const response = await apiClient.post('/api/nodes', nodeData);
    console.log('[nodeService] createNodeService result:', response.data);
    return response.data || null;
  } catch (error) {
    console.error('[nodeService] Error creating node:', error);
    return null;
  }
}

export async function updateNodeService(id: string, nodeData: Partial<ContentNode>): Promise<ContentNode | null> {
  try {
    console.log('[nodeService] updateNodeService called with:', { id, nodeData });
    const response = await apiClient.put(`/api/nodes/${id}`, nodeData);
    console.log('[nodeService] updateNodeService result:', response.data);
    return response.data || null;
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


export const NodeAPI = {
  async list(projectId: string) {
    try {
      console.log('Fetching nodes for project:', projectId);
      const filter = { projectId: { eq: projectId } };
      const response = await (client.graphql as any)({ query: listNodes, variables: { filter }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } });
      console.log('List nodes response:', response);
      const items = (response as any).data.listNodes.items || [];
      console.log('List nodes data:', items);
      return items as NodeDTO[];
    } catch (error) {
      console.error('Error listing nodes:', error);
      throw error;
    }
  },
  async create(input: {
    projectId: string; title: string; description?: string; x?: number; y?: number; status?: string; contentId?: string;
    type?: string; day?: string; imageUrl?: string; imageUrls?: string[]; imagePrompt?: string; scheduledDate?: string;
  }) { 
    try {
      console.log('Creating node:', input);
      const nodeInput = {
        projectId: input.projectId,
        nodeId: `node-${Date.now()}`, // Generate unique nodeId
        title: input.title,
        description: input.description,
        x: input.x,
        y: input.y,
        status: input.status,
        contentId: input.contentId,
        type: input.type,
        day: input.day,
        imageUrl: input.imageUrl,
        imageUrls: input.imageUrls,
        imagePrompt: input.imagePrompt,
        scheduledDate: input.scheduledDate
      };
      const response = await (client.graphql as any)({ query: createNode, variables: { input: nodeInput }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } }); 
      console.log('Create node response:', response);
      console.log('Create node data:', (response as any).data.createNode);
      return (response as any).data.createNode as NodeDTO;
    } catch (error) {
      console.error('Error creating node:', error);
      throw error;
    }
  },
  async update(input: {
    id?: string; projectId: string; nodeId: string; title?: string; description?: string; x?: number; y?: number; status?: string; contentId?: string;
    type?: string; day?: string; imageUrl?: string; imageUrls?: string[]; imagePrompt?: string; scheduledDate?: string;
  }) { 
    let updateInput: any = { ...input };
    try {
      console.log('Updating node:', input);
      // If no id provided, try to find the node first
      if (!input.id) {
        const filter = { projectId: { eq: input.projectId }, nodeId: { eq: input.nodeId } };
        const listResponse = await (client.graphql as any)({ query: listNodes, variables: { filter }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } });
        const items = (listResponse as any).data.listNodes.items || [];
        if (items.length > 0) {
          updateInput.id = items[0].id;
        } else {
          throw new Error(`Node not found: ${input.nodeId}`);
        }
      }

      // Keep imageUrls in the input since it exists in the schema
      console.log('imageUrls in updateInput:', updateInput.imageUrls);
      
      console.log('Final updateInput being sent to GraphQL API:', JSON.stringify(updateInput, null, 2));
      console.log('GraphQL mutation query:', updateNode);
      const response = await (client.graphql as any)({ query: updateNode, variables: { input: updateInput }, authMode: 'apiKey', headers: { 'x-api-key': (import.meta.env.VITE_APPSYNC_API_KEY as string) } }); 
      console.log('Update node response:', response);
      return (response as any).data.updateNode as NodeDTO;
    } catch (error) {
      console.error('Error updating node via Amplify client:', error);
      console.error('Input that caused error:', JSON.stringify(updateInput, null, 2));
      if (error && typeof error === 'object' && 'errors' in error) {
        console.error('GraphQL errors:', (error as any).errors);
        (error as any).errors?.forEach((err: any, index: number) => {
          console.error(`Error ${index + 1}:`, err.message);
          if (err.locations) console.error('Locations:', err.locations);
          if (err.path) console.error('Path:', err.path);
        });
      }
      // Always attempt direct fetch fallback to AppSync with x-api-key for robustness
      try {
        console.warn('Attempting direct fetch fallback to AppSync with x-api-key (update)');
        const res = await fetchGraphqlDirect(updateNode, { input: updateInput });
        console.log('Direct fetch fallback result:', res);
        if (res.ok && res.body && res.body.data && res.body.data.updateNode) {
          console.log('Direct fetch fallback succeeded, returning updateNode');
          return res.body.data.updateNode as NodeDTO;
        }
        // If direct fetch failed, log body for diagnosis
        console.error('Direct fetch fallback body:', res.body);
      } catch (fbErr) {
        console.error('Fallback fetch error:', fbErr);
      }
      if (error && typeof error === 'object' && 'errors' in error) {
        console.error('GraphQL errors:', (error as any).errors);
        (error as any).errors?.forEach((err: any, index: number) => {
          console.error(`Error ${index + 1}:`, err.message);
          if (err.locations) console.error('Locations:', err.locations);
          if (err.path) console.error('Path:', err.path);
        });
      }
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
