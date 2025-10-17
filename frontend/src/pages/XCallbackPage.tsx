import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2, Twitter } from 'lucide-react';

export default function XCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<{
    loading: boolean;
    success: boolean;
    message: string;
    user?: string;
  }>({ loading: true, success: false, message: 'Processing authorization...' });

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus({
          loading: false,
          success: false,
          message: `Authorization failed: ${errorDescription || error}`
        });
        return;
      }

      if (!code) {
        setStatus({
          loading: false,
          success: false,
          message: 'No authorization code received'
        });
        return;
      }

      try {
        // Call the backend callback endpoint
        const response = await fetch(`/api/x-callback?code=${encodeURIComponent(code)}&state=${searchParams.get('state') || ''}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setStatus({
            loading: false,
            success: true,
            message: data.message || 'Authorization successful!',
            user: data.user?.username
          });
        } else {
          setStatus({
            loading: false,
            success: false,
            message: data.error || 'Authorization failed'
          });
        }
      } catch (error) {
        console.error('Callback processing error:', error);
        setStatus({
          loading: false,
          success: false,
          message: 'Failed to process authorization'
        });
      }
    };

    handleCallback();
  }, [searchParams]);

  const handleContinue = () => {
    navigate('/test-twitter');
  };

  const handleRetry = () => {
    navigate('/test-twitter');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Twitter className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">X Authorization</h1>
        </div>

        {status.loading ? (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-muted-foreground">{status.message}</p>
          </div>
        ) : status.success ? (
          <div className="space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <div>
              <p className="text-green-700 dark:text-green-300 font-semibold">
                {status.message}
              </p>
              {status.user && (
                <p className="text-sm text-muted-foreground mt-2">
                  Connected to: <strong>@{status.user}</strong>
                </p>
              )}
            </div>
            <Button 
              onClick={handleContinue}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Continue to X Testing
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-red-700 dark:text-red-300">{status.message}</p>
            <div className="space-y-2">
              <Button 
                onClick={handleRetry}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => navigate('/')}
                variant="ghost"
                className="w-full"
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}