'use client';

import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { LinkedInService } from '@/lib/linkedin-service';
import { 
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ImageIcon,
  X
} from 'lucide-react';

interface PostToLinkedInProps {
  initialText?: string;
  initialImage?: string;
  onPostSuccess?: (postId: string) => void;
  onPostError?: (error: string) => void;
  className?: string;
}

export const PostToLinkedIn: React.FC<PostToLinkedInProps> = ({
  initialText = '',
  initialImage = '',
  onPostSuccess,
  onPostError,
  className = ''
}) => {
  const [text, setText] = useState(initialText);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(initialImage);
  const [isPosting, setIsPosting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [postResult, setPostResult] = useState<{
    success: boolean;
    message: string;
    postId?: string;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePost = async () => {
    if (!text.trim() && !selectedImage && !imagePreview) {
      setPostResult({ success: false, message: 'Please enter some text or select an image to post' });
      return;
    }

    if (text.length > 3000) {
      setPostResult({ success: false, message: 'Post exceeds 3000 character limit' });
      return;
    }

    setIsPosting(true);
    setPostResult(null);

    try {
      let result;
      
      if (selectedImage || imagePreview) {
        let imageUrl = imagePreview;
        
        // If we have a new image file, convert it to data URL
        if (selectedImage) {
          const reader = new FileReader();
          imageUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedImage);
          });
        }
        
        result = await LinkedInService.postToLinkedInWithImage({ 
          text, 
          imageUrl 
        });
      } else {
        result = await LinkedInService.postToLinkedIn(text);
      }
      
      if (result.ok && result.postId) {
        setPostResult({ 
          success: true, 
          message: `Successfully posted to LinkedIn!`,
          postId: result.postId
        });
        
        // Clear form on successful post
        setText('');
        clearImage();
        
        // Call success callback
        if (onPostSuccess) {
          onPostSuccess(result.postId);
        }
      } else {
        const errorMessage = result.error || 'Failed to post to LinkedIn';
        setPostResult({ success: false, message: errorMessage });
        
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
      setIsPosting(false);
    }
  };

  const handleRefreshTokens = async () => {
    setIsRefreshing(true);
    try {
      const result = await LinkedInService.refreshTokens();
      if (result.success) {
        setPostResult({ success: true, message: 'Tokens refreshed successfully!' });
      } else {
        setPostResult({ success: false, message: result.error || 'Failed to refresh tokens' });
      }
    } catch (error) {
      setPostResult({ success: false, message: 'Failed to refresh tokens' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGetAuthUrl = async () => {
    try {
      const result = await LinkedInService.getAuthUrl();
      if (result.url) {
        window.open(result.url, '_blank');
        setPostResult({ success: true, message: 'Authorization URL opened. Please complete the authorization process.' });
      } else {
        setPostResult({ success: false, message: result.error || 'Failed to get authorization URL' });
      }
    } catch (error) {
      setPostResult({ success: false, message: 'Failed to get authorization URL' });
    }
  };

  const characterCount = text.length;
  const isOverLimit = characterCount > 3000;
  const charactersRemaining = 3000 - characterCount;

  return (
    <Card className={`p-6 bg-card/95 backdrop-blur-xl border-border/50 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Post to LinkedIn</h3>
              <p className="text-sm text-muted-foreground">Share with your professional network</p>
            </div>
          </div>
        </div>

        <div className="border-t border-border/20" />

        {/* Text Input */}
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your thoughts with your professional network..."
            className="min-h-[120px] bg-background/50 backdrop-blur-sm border-border/30 resize-none"
            maxLength={3100} // Allow a bit over the limit to show warning
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
              {characterCount}/3000
            </span>
          </div>
        </div>

        {/* Image Upload Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="border-primary/20 hover:border-primary/40"
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              {selectedImage || imagePreview ? 'Change Image' : 'Add Image'}
            </Button>
            
            {(selectedImage || imagePreview) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearImage}
                className="border-red-200 hover:border-red-400 text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          
          {/* Image Preview */}
          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-w-full h-auto max-h-64 rounded-lg border border-border/30"
              />
            </div>
          )}
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
                {postResult.success && postResult.postId && (
                  <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Post ID: {postResult.postId}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        <div className="border-t border-border/20" />

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button 
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-lg shadow-blue-600/25 border-0"
            onClick={handlePost}
            disabled={isPosting || (!text.trim() && !selectedImage && !imagePreview) || isOverLimit}
          >
            {isPosting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {isPosting ? 'Posting...' : 'Post to LinkedIn'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleRefreshTokens}
            disabled={isRefreshing}
            className="border-primary/20 hover:border-primary/40"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isRefreshing ? 'Refreshing...' : 'Refresh Tokens'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleGetAuthUrl}
            className="border-primary/20 hover:border-primary/40"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Authorize App
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Make sure to authorize the app first if you haven't already</p>
          <p>• Use "Refresh Tokens" if you encounter authentication issues</p>
          <p>• Maximum 3000 characters per post</p>
          <p>• Supports image uploads (JPEG, PNG, GIF)</p>
          <p>• 🔒 Posts are shared with your professional network</p>
        </div>
      </div>
    </Card>
  );
};