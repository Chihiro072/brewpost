import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type PlanKey = 'basic' | 'pro' | 'unlimited';

type SubscriptionContextValue = {
  plan: PlanKey | null;
  setPlan: (p: PlanKey | null) => void;
  isPro: boolean;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plan, setPlanState] = useState<PlanKey | null>(null);
  const { user, isAuthenticated } = useAuth();

  // Initialize and re-initialize when auth state or userId changes
  useEffect(() => {
    import('@/services/subscriptionService').then(({ subscriptionService }) => {
      const uid = (user?.id || subscriptionService.getUserId());
      if (isAuthenticated) {
        if (uid) {
          const p = subscriptionService.getPlan(uid);
          // Clear guest plan to avoid leakage into authenticated sessions
          subscriptionService.setPlan(undefined, null);
          console.log('[SubscriptionContext] init (auth+uid): userId=', uid, 'user plan=', p, 'guest cleared');
          setPlanState(p ?? null);
        } else {
          // Authenticated but no userId yet (race) — do NOT read guest plan
          // Ensure guest plan is cleared and show no plan until userId resolves
          subscriptionService.setPlan(undefined, null);
          console.log('[SubscriptionContext] init (auth, no uid): cleared guest plan; withholding plan display');
          setPlanState(null);
        }
      } else {
        const guestPlan = subscriptionService.getPlan(undefined);
        console.log('[SubscriptionContext] init (guest): plan=', guestPlan);
        setPlanState(guestPlan);
      }
    }).catch((err) => { console.warn('[SubscriptionContext] init failed', err); });
  }, [isAuthenticated, user?.id]);

  const setPlan = (p: PlanKey | null) => {
    console.log('[SubscriptionContext] setPlan called with', p);
    import('@/services/subscriptionService').then(({ subscriptionService }) => {
      const uid = (user?.id || subscriptionService.getUserId());
      if (isAuthenticated) {
        if (uid) {
          // For logged-in users, persist only to user key and clear guest
          subscriptionService.setPlan(uid, p);
          subscriptionService.setPlan(undefined, null);
          console.log('[SubscriptionContext] persisted plan for user', uid, '=>', p, 'and cleared guest plan');
        } else {
          // Authenticated but userId unknown yet — do NOT persist as guest
          console.warn('[SubscriptionContext] authenticated without userId; skipping persistence and guest plan writes');
        }
      } else {
        // For guests, persist to guest key only
        subscriptionService.setPlan(undefined, p);
        console.log('[SubscriptionContext] persisted guest plan =>', p);
      }
      setPlanState(p);
    }).catch((err) => {
      console.warn('[SubscriptionContext] setPlan persist failed', err);
      setPlanState(p);
    });
  };

  return (
    <SubscriptionContext.Provider value={{ plan, setPlan, isPro: plan === 'pro' }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
};