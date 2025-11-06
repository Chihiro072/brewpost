import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';

const REDIRECT_SECONDS_DEFAULT = 5;

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(REDIRECT_SECONDS_DEFAULT);
  
  const sessionId = searchParams.get('session_id');
  const plan = searchParams.get('plan') || 'your subscription';

  const redirectToApp = () => {
    setIsLoading(true);
    // Redirect to main app page with plan passthrough
    navigate(`/app${plan ? `?plan=${encodeURIComponent(plan)}` : ''}`);
  };

  useEffect(() => {
    // Optional: verify Stripe session here
    console.log('[PaymentSuccess] session_id=', sessionId, 'plan=', plan);

    // Start countdown auto-redirect
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          redirectToApp();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionId, plan]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700 p-8 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          Payment Successful!
        </h1>
        
        <p className="text-gray-300 mb-6">
          Thank you for subscribing to {plan}. Your payment has been processed successfully.
        </p>
        
        {sessionId && (
          <div className="bg-gray-700 rounded-lg p-3 mb-6">
            <p className="text-xs text-gray-400 mb-1">Session ID</p>
            <p className="text-sm text-gray-300 font-mono break-all">
              {sessionId}
            </p>
          </div>
        )}
        
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Redirecting to app in {secondsLeft} seconds...
          </p>
          <p className="text-sm text-gray-400">
            You can now enjoy all the features of your subscription.
          </p>
          
          <Button
            onClick={redirectToApp}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Redirecting...
              </>
            ) : (
              'Done'
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PaymentSuccess;