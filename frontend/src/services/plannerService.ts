import apiClient from "@/services/apiService";
import type { ContentNode } from "@/components/planning/PlanningPanel";

export type PlannerSummary = {
  id: string;
  title: string;
  createdAt: string;
  postCount: number;
};

export type PlannerDetail = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  createdAt: string;
  posts: Array<{
    id: string;
    title: string;
    caption?: string | null;
    status: string;
    scheduledAt?: string | null;
    publishedAt?: string | null;
    createdAt: string;
    imageCount: number;
    hasAnalytics: boolean;
  }>;
};

export const plannerService = {
  async list(page = 1, pageSize = 50): Promise<PlannerSummary[]> {
    const res = await apiClient.get("/api/content/plans", { params: { page, pageSize } });
    const plans = (res.data?.plans || []) as any[];
    return plans.map((p) => ({ id: String(p.id), title: p.title, createdAt: p.createdAt, postCount: p.postCount }));
  },

  async get(id: string): Promise<PlannerDetail> {
    const res = await apiClient.get(`/api/content/plans/${id}`);
    const d = res.data;
    return {
      id: String(d.id),
      title: d.title,
      prompt: d.prompt,
      status: d.status,
      createdAt: d.createdAt,
      posts: (d.posts || []).map((p: any) => ({
        id: String(p.id),
        title: p.title,
        caption: p.caption ?? "",
        status: p.status ?? "draft",
        scheduledAt: p.scheduledAt ?? null,
        publishedAt: p.publishedAt ?? null,
        createdAt: p.createdAt,
        imageCount: p.imageCount ?? 0,
        hasAnalytics: !!p.hasAnalytics,
      })),
    };
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/content/plans/${id}`);
  },

  async createFromNodes(title: string, nodes: ContentNode[]): Promise<string> {
    const prompt = (nodes && nodes.length)
      ? `Auto-generated draft with ${nodes.length} posts: ${nodes.slice(0, 3).map(n => n.title).join(', ')}`
      : 'Auto-generated draft';
    const planRes = await apiClient.post("/api/content/plans", { title, prompt });
    const planId = String(planRes.data?.id);
    if (planId) {
      for (const n of nodes) {
        try {
          await apiClient.post("/api/posts", {
            planId,
            title: n.title,
            caption: n.content || "",
            imagePrompt: n.imagePrompt || undefined,
            platforms: null,
          });
        } catch {}
      }
    }
    return planId;
  },

  async updatePlan(id: string, title: string, prompt?: string): Promise<void> {
    await apiClient.put(`/api/content/plans/${id}`, { title, prompt });
  },
};

export function mapPlannerToNodes(detail: PlannerDetail): ContentNode[] {
  const gridCols = 4;
  const gapX = 220;
  const gapY = 160;
  const ordered = [...detail.posts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return ordered.map((p, idx) => {
    const col = idx % gridCols;
    const row = Math.floor(idx / gridCols);
    return {
      id: p.id,
      title: p.title,
      type: "post",
      status: (p.status?.toLowerCase() as ContentNode["status"]) || "draft",
      scheduledDate: p.scheduledAt ? new Date(p.scheduledAt) : undefined,
      content: p.caption || "",
      imageUrl: undefined,
      imageUrls: undefined,
      imagePrompt: undefined,
      day: undefined,
      postType: "engaging",
      connections: idx < ordered.length - 1 ? [ordered[idx + 1].id] : [],
      position: { x: 80 + col * gapX, y: 80 + row * gapY },
      postedAt: p.publishedAt ? new Date(p.publishedAt) : undefined,
      postedTo: [],
      tweetId: undefined,
      selectedImageUrl: undefined,
    };
  });
}
