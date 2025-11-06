import { RedesignedMainLayout } from '@/components/layout/RedesignedMainLayout';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';

type PlanKey = 'basic' | 'pro' | 'unlimited';

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setPlan } = useSubscription();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const planParam = params.get('plan');
    console.log('[Index] search=', location.search, 'planParam=', planParam);
    const validPlans: PlanKey[] = ['basic', 'pro', 'unlimited'];
    if (planParam && validPlans.includes(planParam as PlanKey)) {
      console.log('[Index] applying plan from URL:', planParam);
      setPlan(planParam as PlanKey);
      // Clean the URL
      navigate('/app', { replace: true });
    }
  }, [location.search, navigate, setPlan]);

  return <RedesignedMainLayout />;
};

export default Index;
