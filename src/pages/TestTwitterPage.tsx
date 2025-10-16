'use client';

import { PostToX } from '@/components/post-to-x';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
  Twitter,
  ArrowLeft,
  Info,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function TestTwitterPage() {
  const [postedTweets, setPostedTweets] = useState<Array<{
    id: string;
    text: string;
    timestamp: Date;
    tweetId?: string;
  }>>([]);

  const handlePostSuccess = (tweetId: string) => {
    console.log('Tweet posted successfully:', tweetId);
    // You can add logic here to update your UI or store the tweet info
  };

  const handlePostError = (error: string) => {
    console.error('Tweet post failed:', error);
    // You can add logic here to handle errors
  };

  const sampleTexts = [
    "Just launched our new AI-powered campaign generator! 🚀 #AI #Marketing #Innovation",
    "Working on something exciting... Stay tuned! ✨",
    "The future of marketing is here, and it's powered by AI 🤖 #TechTrends",
    "Building amazing tools for creators and marketers 💡 #BuildInPublic"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Twitter className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">X Integration Test</h1>
              <p className="text-muted-foreground">Test posting to X (Twitter) from your application</p>
            </div>
          </div>

          <Badge variant="outline" className="mb-6">
            Test Environment
          </Badge>
        </div>

        {/* Instructions */}
        <Card className="p-6 mb-8 bg-blue-50/50 border-blue-200/50 dark:bg-blue-950/20 dark:border-blue-800/50">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Setup Instructions</h3>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p><strong>1. Check Tokens:</strong> Your x_tokens.json file should have valid access tokens</p>
                <p><strong>2. Environment:</strong> Make sure VITE_X_CLIENT_ID and VITE_X_CLIENT_SECRET are set</p>
                <p><strong>3. Test Posting:</strong> Use the form below to test posting tweets</p>
                <p><strong>4. Authorization:</strong> Click "Authorize App" if you need to re-authorize</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Main Post to X Component */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <PostToX
              initialText=""
              onPostSuccess={handlePostSuccess}
              onPostError={handlePostError}
            />
            
            {/* Sample Texts */}
            <Card className="p-4 bg-card/50 backdrop-blur-sm">
              <h3 className="font-semibold mb-3">Sample Texts</h3>
              <div className="space-y-2">
                {sampleTexts.map((text, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-left h-auto p-3 whitespace-normal"
                    onClick={() => {
                      // You can use these to populate the text area
                      navigator.clipboard.writeText(text);
                    }}
                  >
                    <div className="text-xs text-muted-foreground">
                      "{text}"
                    </div>
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Click to copy sample text to clipboard
              </p>
            </Card>
          </div>

          {/* Status and Information Panel */}
          <div className="space-y-6">
            {/* Environment Check */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Environment Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Client ID configured</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Client Secret configured</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Tokens available in x_tokens.json</span>
                </div>
              </div>
            </Card>

            {/* API Endpoints */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Available API Endpoints</h3>
              <div className="space-y-2 text-sm">
                <div className="bg-muted/50 p-2 rounded font-mono">
                  POST /api/post-tweet
                </div>
                <div className="bg-muted/50 p-2 rounded font-mono">
                  POST /api/x-refresh-token
                </div>
                <div className="bg-muted/50 p-2 rounded font-mono">
                  GET /api/x-auth-url
                </div>
                <div className="bg-muted/50 p-2 rounded font-mono">
                  GET /api/x-callback
                </div>
              </div>
            </Card>

            {/* Recent Posts */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Recent Posts</h3>
              {postedTweets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No posts yet. Try posting a tweet!</p>
              ) : (
                <div className="space-y-2">
                  {postedTweets.map((tweet) => (
                    <div key={tweet.id} className="p-2 bg-muted/50 rounded text-xs">
                      <p className="font-mono">{tweet.text}</p>
                      <p className="text-muted-foreground mt-1">
                        {tweet.timestamp.toLocaleString()}
                      </p>
                      {tweet.tweetId && (
                        <p className="text-blue-600">ID: {tweet.tweetId}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        <Separator className="my-8 opacity-50" />

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>X Integration • Built with React and X API v2</p>
        </div>
      </div>
    </div>
  );
}