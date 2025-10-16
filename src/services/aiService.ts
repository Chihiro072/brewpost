import type { ContentNode } from '@/components/planning/PlanningPanel';

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
  // Use VITE_BACKEND_URL so it can be deployed to production
  const baseUrl = import.meta.env.VITE_BACKEND_URL || '';
  const endpoint = `${baseUrl}/api/generate-components`;
  // Try with one retry on server errors / transient failures
  let attempt = 0;
  const maxAttempts = 2;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      console.log('[aiService] fetchComponentsForNode request', { nodeId: node.id, endpoint, attempt });
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node })
      });

      const text = await resp.text();
      let data: unknown = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

      console.log('[aiService] response status/text length', { status: resp.status, textLength: text?.length ?? 0 });

      if (!resp.ok) {
        console.warn('[aiService] non-OK response', { status: resp.status, text });
        // Retry for server errors (5xx)
        if (resp.status >= 500 && attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 300 * attempt));
          continue;
        }
        return [];
      }

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
    } catch (err) {
      console.warn('[aiService] fetchComponentsForNode attempt failed', { attempt, err });
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 300 * attempt));
      else return [];
    }
  }
  return [];
}

export function clearComponentCache(nodeId?: string) {
  if (nodeId) delete cache[nodeId];
  else Object.keys(cache).forEach(k => delete cache[k]);
}

export default { fetchComponentsForNode, clearComponentCache };
