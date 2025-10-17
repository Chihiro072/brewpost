import type { ContentNode } from '@/components/planning/PlanningPanel';
import apiClient from './apiService';

export type GeneratedComponent = {
  id: string;
  type: string;
  title: string;
  name?: string;
  description?: string;
  data?: any;
  category?: string;
  keywords?: string[];
  relevanceScore?: number;
  impact?: 'low' | 'medium' | 'high';
  color?: string;
};

const cache: Record<string, GeneratedComponent[]> = {};

export async function fetchComponentsForNode(node: ContentNode | null): Promise<GeneratedComponent[]> {
  if (!node || !node.id) return [];
  if (cache[node.id]) return cache[node.id];
  
  const endpoint = '/api/ai/generate-components';
  // Try with one retry on server errors / transient failures
  let attempt = 0;
  const maxAttempts = 2;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      console.log('[aiService] fetchComponentsForNode request', { nodeId: node.id, endpoint, attempt });
      const response = await apiClient.post(endpoint, { node });
      const data = response.data;

      console.log('[aiService] response status/data', { status: response.status, data });

      type RespShape = { ok?: boolean; components?: GeneratedComponent[] };
      const parsed = (data && typeof data === 'object') ? (data as RespShape) : null;
      if (!parsed || !parsed.ok) {
        console.warn('[aiService] missing ok/data or parse failed', { parsed, raw: data });
        return [];
      }

      let components = Array.isArray(parsed.components) ? parsed.components as GeneratedComponent[] : [];
      // Normalize legacy/alternate type names from backend. We removed the explicit
      // "target_user" demographic category — map any legacy "local_data" to
      // 'campaign_type' so it appears as campaign content. Promotion-specific
      // suggestions are expected to use type 'promotion_type'.
      components = components.map((comp) => ({
        ...comp,
        type: (comp.type === 'local_data' ? 'campaign_type' : comp.type) as string,
        category: (comp.category === 'Local Data' ? 'Campaign Type' : comp.category) as string,
      }));
      cache[node.id] = components;
      console.log('[aiService] fetched components', { nodeId: node.id, count: components.length });
      return components;
    } catch (error: any) {
      console.error('[aiService] error', { error, attempt });
      // Retry on network errors or server errors (5xx)
      if (attempt < maxAttempts && (error.response?.status >= 500 || !error.response)) {
        await new Promise(r => setTimeout(r, 300 * attempt));
        continue;
      }
      return [];
    }
  }
  return [];
}

export function clearComponentCache(nodeId?: string) {
  if (nodeId) delete cache[nodeId];
  else Object.keys(cache).forEach(k => delete cache[k]);
}

export default { fetchComponentsForNode, clearComponentCache };
