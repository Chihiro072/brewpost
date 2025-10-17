'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { XService } from '@/lib/x-service';
import { 
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Twitter
} from 'lucide-react';

interface PostToXProps {
  initialText?: string;
  onPostSuccess?: (tweetId: string) => void;
  onPostError?: (error: string) => void;
  className?: string;
}

export const PostToX: React.FC<PostToXProps> = ({
  initialText = '',
  onPostSuccess,
  onPostError,
  className = ''
}) => {
  const [text, setText] = useState(initialText);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [userInfoCached, setUserInfoCached] = useState(false);
  const [postResult, setPostResult] = useState<{
    success: boolean;
    message: string;
    tweetId?: string;
  } | null>(null);

  // Check authorization status
  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking X authorization status...');
      
      // First check if we have valid tokens
      const tokenResponse = await fetch('/api/x-token-status');
      const tokenData = await tokenResponse.json();
      
      if (tokenData.valid && tokenData.authorized) {
        console.log('✅ Valid tokens found');
        
        // Try to get user info only if not already cached
        if (!userInfoCached) {
          try {
            const userResponse = await fetch('/api/x-user-info');
            if (userResponse.ok) {
              const userData = await userResponse.json();
              const username = userData.user?.username;
              console.log('✅ User info retrieved:', username);
              setCurrentUser(username);
              setUserInfoCached(true);
              setPostResult({ 
                success: true, 
                message: `Ready to post as @${username}` 
              });
            } else {
              console.log('⚠️ Valid tokens but could not get user info (rate limited or other issue)');
              setCurrentUser(null);
              setUserInfoCached(true); // Cache the "no user info" result to avoid retrying
              setPostResult({ 
                success: true, 
                message: 'Ready to post to X!' 
              });
            }
          } catch (userError) {
            console.log('⚠️ User info fetch failed, but tokens are valid');
            setCurrentUser(null);
            setUserInfoCached(true); // Cache the failure to avoid retrying
            setPostResult({ 
              success: true, 
              message: 'Ready to post to X!' 
            });
          }
        } else {
          // Use cached result
          console.log('📋 Using cached user info');
          setPostResult({ 
            success: true, 
            message: currentUser ? `Ready to post as @${currentUser}` : 'Ready to post to X!' 
          });
        }
        
        setIsAuthorized(true);
      } else {
        console.log('❌ No valid tokens');
        setCurrentUser(null);
        setIsAuthorized(false);
        setPostResult(null);
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      setCurrentUser(null);
      setIsAuthorized(false);
      setPostResult(null);
    }
  };

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Only recheck on window focus if not already authorized (avoid spam)
  useEffect(() => {
    const handleFocus = () => {
      if (isAuthorized === false) {
        console.log('🔄 Window focused, rechecking auth status...');
        checkAuthStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthorized]);

  const handleSmartAction = async () => {
    if (isAuthorized === null) {
      // Still checking auth status
      return;
    }

    if (!isAuthorized) {
      // Need to authorize first
      setIsProcessing(true);
      try {
        const result = await XService.getAuthUrl();
        if (result.url) {
          window.open(result.url, '_blank');
          setPostResult({ 
            success: true, 
            message: 'Authorization window opened. Complete the authorization and return to this page.' 
          });
          
          // Set up a timer to recheck auth status periodically (less frequent)
          const recheckInterval = setInterval(() => {
            console.log('🔄 Rechecking auth status after authorization...');
            checkAuthStatus();
          }, 10000); // Check every 10 seconds instead of 3
          
          // Clear interval after 1 minute instead of 2
          setTimeout(() => {
            clearInterval(recheckInterval);
          }, 60000);
          
        } else {
          setPostResult({ success: false, message: result.error || 'Failed to get authorization URL' });
        }
      } catch (error) {
        setPostResult({ success: false, message: 'Failed to get authorization URL' });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Already authorized, proceed with posting
    if (!text.trim()) {
      setPostResult({ success: false, message: 'Please enter some text to post' });
      return;
    }

    if (text.length > 280) {
      setPostResult({ success: false, message: 'Tweet exceeds 280 character limit' });
      return;
    }

    setIsProcessing(true);
    setPostResult(null);

    try {
      const result = await XService.postTweet(text);
      
      if (result.ok && result.tweetId) {
        setPostResult({ 
          success: true, 
          message: `Successfully posted to X!`,
          tweetId: result.tweetId
        });
        
        // Clear text on successful post
        setText('');
        
        // Call success callback
        if (onPostSuccess) {
          onPostSuccess(result.tweetId);
        }
      } else {
        const errorMessage = result.error || 'Failed to post to X';
        
        // Check if it's an auth error
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Authentication failed')) {
          setIsAuthorized(false);
          setCurrentUser(null);
          setPostResult({ success: false, message: 'Authorization expired. Click the button to re-authorize.' });
        } else {
          setPostResult({ success: false, message: errorMessage });
        }
        
        if (onPostError) {
          onPostError(errorMessage);
        }
      }
    } catch (error) {
      const errorMessage = 'An unexpected error occurred while posting';
      setPostResult({ success: false, message: errorMessage });
      
      if (onPostError) {
        onPostError(errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const getButtonText = () => {
    if (isAuthorized === null) return 'Checking...';
    if (!isAuthorized) return 'Authorize X Account';
    return 'Post to X';
  };

  const getButtonIcon = () => {
    if (isAuthorized === null) return <Loader2 className="w-4 h-4 mr-2 animate-spin" />;
    if (!isAuthorized) return <ExternalLink className="w-4 h-4 mr-2" />;
    return isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />;
  };

  const characterCount = text.length;
  const isOverLimit = characterCount > 280;
  const charactersRemaining = 280 - characterCount;

  return (
    <Card className={`p-6 bg-card/95 backdrop-blur-xl border-border/50 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Twitter className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Post to X</h3>
              <p className="text-sm text-muted-foreground">Share your content on X (Twitter)</p>
            </div>
          </div>
        </div>

        <Separator className="opacity-50" />

        {/* Text Input */}
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
            className="min-h-[120px] bg-background/50 backdrop-blur-sm border-border/30 resize-none"
            maxLength={300} // Allow a bit over the limit to show warning
          />
          
          {/* Character Count */}
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <Badge 
                variant={isOverLimit ? "destructive" : "secondary"}
                className="text-xs"
              >
                {charactersRemaining} characters remaining
              </Badge>
            </div>
            <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {characterCount}/280
            </span>
          </div>
        </div>

        {/* Result Message */}
        {postResult && (
          <Card className={`p-3 ${postResult.success 
            ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
            : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
          }`}>
            <div className="flex items-start gap-2">
              {postResult.success ? (
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-sm ${postResult.success 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-red-800 dark:text-red-200'
                }`}>
                  {postResult.message}
                </p>
                {postResult.success && postResult.tweetId && (
                  <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Tweet ID: {postResult.tweetId}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                      onClick={() => window.open(`https://x.com/user/status/${postResult.tweetId}`, '_blank')}
                    >
                      View on X
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        <Separator className="opacity-50" />

        {/* Current User Display */}
        {currentUser && isAuthorized && currentUser !== 'Unknown User' && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Authorized as: <strong>@{currentUser}</strong>
            </span>
          </div>
        )}

        {/* Single Smart Action Button */}
        <div className="flex justify-center gap-3">
          <Button 
            className={`min-w-[200px] shadow-lg transition-all duration-200 ${
              isAuthorized === false 
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 shadow-orange-500/25' 
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-blue-500/25'
            } text-white border-0`}
            onClick={handleSmartAction}
            disabled={
              isProcessing || 
              isAuthorized === null || 
              (isAuthorized && (!text.trim() || isOverLimit))
            }
          >
            {getButtonIcon()}
            {isProcessing ? 'Processing...' : getButtonText()}
          </Button>
          
          {/* Refresh Status Button (only show when not authorized) */}
          {isAuthorized === false && (
            <Button 
              variant="outline"
              size="sm"
              onClick={checkAuthStatus}
              className="border-orange-200 hover:border-orange-400 text-orange-700 hover:text-orange-800"
              title="Check if authorization is complete"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground space-y-1 text-center">
          {!isAuthorized && (
            <p>• <strong>Step 1:</strong> Click the orange button to authorize your X account</p>
          )}
          {isAuthorized && (
            <>
              <p>• Write your tweet and click the blue button to post</p>
              <p>• Maximum 280 characters per post</p>
            </>
          )}
          {isAuthorized === null && (
            <p>• Checking authorization status...</p>
          )}
        </div>
      </div>
    </Card>
  );
};