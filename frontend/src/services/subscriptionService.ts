type PlanKey = 'basic' | 'pro' | 'unlimited';

const getScopedKey = (userId?: string) => `bp_plan_${userId || 'guest'}`;

export const subscriptionService = {
  getPlan(userId?: string): PlanKey | null {
    try {
      const key = getScopedKey(userId);
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!v) return null;
      if (v === 'basic' || v === 'pro' || v === 'unlimited') return v;
      return null;
    } catch {
      return null;
    }
  },
  setPlan(userId: string | undefined, plan: PlanKey | null) {
    try {
      const key = getScopedKey(userId);
      if (plan) {
        window.localStorage.setItem(key, plan);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch {}
  },
  getUserId(): string | undefined {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem('userId') || undefined : undefined;
    } catch {
      return undefined;
    }
  }
};