import apiClient from '@/services/apiService'
import type { ContentNode } from '@/components/planning/PlanningPanel'

export type PlannerSummary = {
  id: string
  title: string
  createdAt: string
  postCount: number
}

export type PlannerDetail = {
  id: string
  title: string
  prompt: string
  status: string
  createdAt: string
  posts: Array<{
    id: string
    title: string
    caption?: string | null
    status: string
    scheduledAt?: string | null
    publishedAt?: string | null
    createdAt: string
    imageCount: number
    hasAnalytics: boolean
  }>
}

export const plannerService = {
  async list (page = 1, pageSize = 50): Promise<PlannerSummary[]> {
    const res = await apiClient.get('/api/content/plans', {
      params: { page, pageSize }
    })
    const plans = (res.data?.plans || []) as any[]
    return plans.map(p => ({
      id: String(p.id),
      title: p.title,
      createdAt: p.createdAt,
      postCount: p.postCount
    }))
  },

  async get (id: string): Promise<PlannerDetail> {
    const res = await apiClient.get(`/api/content/plans/${id}`)
    const d = res.data
    return {
      id: String(d.id),
      title: d.title,
      prompt: d.prompt,
      status: d.status,
      createdAt: d.createdAt,
      posts: (d.posts || []).map((p: any) => ({
        id: String(p.id),
        title: p.title,
        caption: p.caption ?? '',
        status: p.status ?? 'draft',
        scheduledAt: p.scheduledAt ?? null,
        publishedAt: p.publishedAt ?? null,
        createdAt: p.createdAt,
        imageCount: p.imageCount ?? 0,
        hasAnalytics: !!p.hasAnalytics
      }))
    }
  },

  async remove (id: string): Promise<void> {
    await apiClient.delete(`/api/content/plans/${id}`)
  },

  async createFromNodes (title: string, nodes: ContentNode[]): Promise<string> {
    const prompt =
      nodes && nodes.length
        ? `Auto-generated draft with ${nodes.length} posts: ${nodes
            .slice(0, 3)
            .map(n => n.title)
            .join(', ')}`
        : 'Auto-generated draft'
    const planRes = await apiClient.post('/api/content/plans', {
      title,
      prompt
    })
    const planId = String(planRes.data?.id)
    if (planId) {
      for (const n of nodes) {
        try {
          await apiClient.post('/api/posts', {
            planId,
            title: n.title,
            caption: n.content || '',
            imagePrompt: n.imagePrompt || undefined,
            platforms: null
          })
        } catch {}
      }
    }
    return planId
  },

  async updatePlan (id: string, title: string, prompt?: string): Promise<void> {
    await apiClient.put(`/api/content/plans/${id}`, { title, prompt })
  }
}

export function mapPlannerToNodes (detail: PlannerDetail): ContentNode[] {
  // Use the same zigzag layout as AIChat for consistency
  const spacing = 320
  const startX = 100
  const topY = 20
  const bottomY = topY + 180

  // Post type detection function (same logic as AIChat)
  const detectPostType = (
    title: string,
    caption: string
  ): 'engaging' | 'promotional' | 'branding' => {
    const content = `${title} ${caption}`.toLowerCase()

    // 🔵 PROMOTIONAL: Drive direct action (purchase, signup, visit, conversion)
    if (
      content.match(
        /\b(shop|order|buy|get yours|discount|available now|limited|offer|sale|use code|sign up|join|link in bio|free shipping|diy|recipe|create|make|try|get|start)\b/
      )
    ) {
      return 'promotional'
    }

    // 🟡 BRANDING: Build brand identity, trust, and values
    if (
      content.match(
        /\b(crafted|behind the scenes|heritage|tradition|quality|meet|farmer|team|values|trust|story of|our process|secret|day in the life|art of|history|unveiling|science|grading|special)\b/
      )
    ) {
      return 'branding'
    }

    // 🟢 ENGAGING: Spark conversation, curiosity, or sharing (default)
    return 'engaging'
  }

  const ordered = [...detail.posts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  return ordered.map((p, idx) => {
    // Zigzag pattern: alternating top and bottom rows
    const isBottom = idx % 2 === 1
    const x = startX + idx * (spacing / 2)
    const y = isBottom ? bottomY : topY

    return {
      id: p.id,
      title: p.title,
      type: 'post',
      status: (p.status?.toLowerCase() as ContentNode['status']) || 'draft',
      scheduledDate: p.scheduledAt ? new Date(p.scheduledAt) : undefined,
      content: p.caption || '',
      imageUrl: undefined,
      imageUrls: undefined,
      imagePrompt: undefined,
      day: undefined,
      postType: detectPostType(p.title, p.caption || ''),
      connections: idx < ordered.length - 1 ? [ordered[idx + 1].id] : [],
      position: { x, y },
      postedAt: p.publishedAt ? new Date(p.publishedAt) : undefined,
      postedTo: [],
      tweetId: undefined,
      selectedImageUrl: undefined
    }
  })
}
