import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Clock, Target, Eye, Zap, Bot, Send, X, CheckCircle, Loader2 } from 'lucide-react';
import { AIChat } from '@/components/ai/AIChat';
import { LinkedInService } from '@/lib/linkedin-service';

// LinkedIn Icon Component
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

interface ContentNode {
  id: string;
  title: string;
  type: 'post' | 'image' | 'story';
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: Date;
  content: string;
  imageUrl?: string;
  connections: string[];
  position: { x: number; y: number };
  postedAt?: Date;
  postedTo?: string[];
  tweetId?: string;
  linkedInId?: string;
}

interface CalendarEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ContentNode | null;
  onSave: (updatedEvent: ContentNode) => void;
  onDelete?: (eventId: string) => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  open,
  onOpenChange,
  event,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState<Partial<ContentNode>>({});
  const [isPostingToX, setIsPostingToX] = useState(false);
  const [isPostingToLinkedIn, setIsPostingToLinkedIn] = useState(false);
  const [xAuthorized, setXAuthorized] = useState<boolean | null>(null);
  const [xUserInfoCached, setXUserInfoCached] = useState(false);
  const [currentXUser, setCurrentXUser] = useState<string | null>(null);
  const [postResults, setPostResults] = useState<{
    x?: { success: boolean; message: string };
    linkedin?: { success: boolean; message: string };
  }>({});
  const [linkedInAuthorized, setLinkedInAuthorized] = useState<boolean | null>(null);

 const checkXAuthStatus = async () => {
    try {
      console.log('🔍 Checking X authorization status in modal...');
      
      // First check if we have valid tokens
      const tokenResponse = await fetch('/api/x-token-status');
      const tokenData = await tokenResponse.json();
      
      if (tokenData.valid && tokenData.authorized) {
        console.log('✅ Valid X tokens found in modal');
        
        // Try to get user info only if not already cached
        if (!xUserInfoCached) {
          try {
            const userResponse = await fetch('/api/x-user-info');
            if (userResponse.ok) {
              const userData = await userResponse.json();
              const username = userData.user?.username;
              console.log('✅ X user info retrieved in modal:', username);
              setCurrentXUser(username);
            } else {
              console.log('⚠️ Valid tokens but could not get X user info in modal');
              setCurrentXUser(null);
            }
            setXUserInfoCached(true);
          } catch (userError) {
            console.log('⚠️ X user info fetch failed, but tokens are valid in modal');
            setCurrentXUser(null);
            setXUserInfoCached(true);
          }
        }
        
        setXAuthorized(true);
      } else {
        console.log('❌ No valid X tokens in modal');
        setCurrentXUser(null);
        setXAuthorized(false);
      }
    } catch (error) {
      console.error('❌ X auth check failed in modal:', error);
      setCurrentXUser(null);
      setXAuthorized(false);
    }
  };

  const checkLinkedInAuthStatus = async () => {
    try {
      console.log('🔍 Checking LinkedIn authorization status in modal...');
      const result = await LinkedInService.checkTokens();
      console.log('LinkedIn auth check result:', result);
      setLinkedInAuthorized(result.valid);
    } catch (error) {
      console.error('❌ LinkedIn auth check failed in modal:', error);
      setLinkedInAuthorized(false);
    }
  };

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        type: event.type,
        status: event.status,
        content: event.content,
        scheduledDate: event.scheduledDate,
        imageUrl: event.imageUrl
      });
    }
    // Reset post results when event changes
    setPostResults({});
    
    // Check X authorization when modal opens
    if (open) {
      checkXAuthStatus();
      checkLinkedInAuthStatus();
    }
  }, [event, open]);

  // Listen for window focus to recheck auth after authorization (only if not authorized)
  useEffect(() => {
    if (!open) return;
    
    const handleFocus = () => {
      if (xAuthorized === false) {
        console.log('🔄 Window focused, rechecking X auth status in modal...');
        checkXAuthStatus();
      }
      if (linkedInAuthorized === false) {
        console.log('🔄 Window focused, rechecking LinkedIn auth status in modal...');
        checkLinkedInAuthStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [open, xAuthorized, linkedInAuthorized]);

  // Auto-dismiss success messages after 10 seconds
  useEffect(() => {
    if (postResults.x?.success || postResults.linkedin?.success) {
      const timer = setTimeout(() => {
        setPostResults(prev => ({
          ...prev,
          ...(postResults.x?.success && { x: undefined }),
          ...(postResults.linkedin?.success && { linkedin: undefined })
        }));
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [postResults]);

  const handleSave = () => {
    if (!event) return;
    
    const updatedEvent: ContentNode = {
      ...event,
      ...formData,
      title: formData.title || event.title,
      type: formData.type || event.type,
      status: formData.status || event.status,
      content: formData.content || event.content,
      scheduledDate: formData.scheduledDate,
      imageUrl: formData.imageUrl
    };

    console.log('CalendarEventModal handleSave - updatedEvent:', updatedEvent);
    onSave(updatedEvent);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (event && onDelete) {
      onDelete(event.id);
      onOpenChange(false);
    }
  };

  const handleSmartXAction = async () => {
    if (xAuthorized === null) {
      // Still checking auth status
      return;
    }

    if (!xAuthorized) {
      // Need to authorize first
      setIsPostingToX(true);
      try {
        const response = await fetch('/api/x-auth-url');
        const data = await response.json();
        
        if (data.url) {
          window.open(data.url, '_blank');
          setPostResults(prev => ({
            ...prev,
            x: { 
              success: true, 
              message: 'Authorization window opened. Complete the authorization and try again.' 
            }
          }));
          
          // Set up periodic recheck for authorization
          const recheckInterval = setInterval(() => {
            console.log('🔄 Rechecking X auth status in modal after authorization...');
            checkXAuthStatus();
          }, 5000);
          
          // Clear interval after 1 minute
          setTimeout(() => {
            clearInterval(recheckInterval);
          }, 60000);
          
        } else {
          setPostResults(prev => ({
            ...prev,
            x: { success: false, message: 'Failed to get authorization URL' }
          }));
        }
      } catch (error) {
        setPostResults(prev => ({
          ...prev,
          x: { success: false, message: 'Failed to get authorization URL' }
        }));
      } finally {
        setIsPostingToX(false);
      }
      return;
    }

    // Already authorized, proceed with posting
    if (!event?.content) {
      setPostResults(prev => ({
        ...prev,
        x: { success: false, message: 'No content to post' }
      }));
      return;
    }

    if (event.content.length > 280) {
      setPostResults(prev => ({
        ...prev,
        x: { success: false, message: 'Content exceeds 280 character limit for X' }
      }));
      return;
    }

    setIsPostingToX(true);
    setPostResults(prev => ({ ...prev, x: undefined }));

    try {
      // Use the new XService instead of PostingService
      const response = await fetch('/api/post-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: event.content,
          imageUrl: event.imageUrl,
          nodeId: event.id, // Pass the node/event ID for database tracking
          scheduleId: event.scheduleId // Pass schedule ID if available
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        const updatedEvent = {
          ...event,
          status: 'published' as const,
          postedAt: new Date(),
          postedTo: [...(event.postedTo || []), 'X'],
          tweetId: result.tweetId
        };
        
        onSave(updatedEvent);
        
        setPostResults(prev => ({
          ...prev,
          x: { 
            success: true, 
            message: `Successfully posted to X! Tweet ID: ${result.tweetId}` 
          }
        }));
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to post to X';
        
        // Check if it's an auth error
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Authentication failed')) {
          setXAuthorized(false);
          setCurrentXUser(null);
          setXUserInfoCached(false);
          setPostResults(prev => ({
            ...prev,
            x: { success: false, message: 'Authorization expired. Click the button to re-authorize.' }
          }));
        } else {
          setPostResults(prev => ({
            ...prev,
            x: { success: false, message: errorMessage }
          }));
        }
      }
    } catch (error) {
      setPostResults(prev => ({
        ...prev,
        x: { 
          success: false, 
          message: 'An unexpected error occurred while posting to X' 
        }
      }));
    } finally {
      setIsPostingToX(false);
    }
  };

  const getXButtonText = () => {
    if (xAuthorized === null) return 'Checking...';
    if (!xAuthorized) return 'Authorize X Account';
    return 'Post to X';
  };

  const getXButtonIcon = () => {
    if (xAuthorized === null) return <Loader2 className="w-4 h-4 mr-2 animate-spin" />;
    if (!xAuthorized) return <X className="w-4 h-4 mr-2" />;
    return isPostingToX ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />;
  };

  const getLinkedInButtonText = () => {
    if (linkedInAuthorized === null) return 'Checking...';
    if (!linkedInAuthorized) return 'Authorize LinkedIn';
    return 'Post to LinkedIn';
  };

  const getLinkedInButtonIcon = () => {
    if (linkedInAuthorized === null) return <Loader2 className="w-4 h-4 mr-2 animate-spin" />;
    if (!linkedInAuthorized) return <LinkedInIcon className="w-4 h-4 mr-2" />;
    return isPostingToLinkedIn ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkedInIcon className="w-4 h-4 mr-2" />;
  };

  const handleSmartLinkedInAction = async () => {
    if (linkedInAuthorized === null) {
      // Still checking auth status
      return;
    }

    if (!linkedInAuthorized) {
      // Need to authorize first
      setIsPostingToLinkedIn(true);
      try {
        const result = await LinkedInService.getAuthUrl();
        
        if (result.url) {
          window.open(result.url, '_blank');
          setPostResults(prev => ({
            ...prev,
            linkedin: { 
              success: true, 
              message: 'Authorization window opened. Complete the authorization and try again.' 
            }
          }));
          
          // Set up periodic recheck for authorization
          const recheckInterval = setInterval(() => {
            console.log('🔄 Rechecking LinkedIn auth status in modal after authorization...');
            checkLinkedInAuthStatus();
          }, 5000);
          
          // Clear interval after 1 minute
          setTimeout(() => {
            clearInterval(recheckInterval);
          }, 60000);
          
        } else {
          setPostResults(prev => ({
            ...prev,
            linkedin: { success: false, message: result.error || 'Failed to get authorization URL' }
          }));
        }
      } catch (error) {
        setPostResults(prev => ({
          ...prev,
          linkedin: { success: false, message: 'Failed to get authorization URL' }
        }));
      } finally {
        setIsPostingToLinkedIn(false);
      }
      return;
    }

    // Already authorized, proceed with posting
    await handlePostToLinkedIn();
  };

  const handlePostToLinkedIn = async () => {
    if (!event?.content && !event?.imageUrl) {
      setPostResults(prev => ({
        ...prev,
        linkedin: { success: false, message: 'No content or image to post' }
      }));
      return;
    }

    if (event.content && event.content.length > 3000) {
      setPostResults(prev => ({
        ...prev,
        linkedin: { success: false, message: 'Content exceeds 3000 character limit for LinkedIn' }
      }));
      return;
    }

    setIsPostingToLinkedIn(true);
    setPostResults(prev => ({ ...prev, linkedin: undefined }));

    try {
      let result;
      
      // If we have both content and image, or just image
      if (event.imageUrl) {
        result = await LinkedInService.postToLinkedInWithImage({ 
          text: event.content || '', 
          imageUrl: event.imageUrl 
        });
      } else {
        // Text only post
        result = await LinkedInService.postToLinkedIn(event.content);
      }
      
      if (result.ok && result.postId) {
        const updatedEvent = {
          ...event,
          status: 'published' as const,
          postedAt: new Date(),
          postedTo: [...(event.postedTo || []), 'LinkedIn'],
          linkedInId: result.postId
        };
        
        onSave(updatedEvent);
        
        setPostResults(prev => ({
          ...prev,
          linkedin: { 
            success: true, 
            message: `Successfully posted to LinkedIn! Post ID: ${result.postId}` 
          }
        }));
      } else {
        const errorMessage = result.error || 'Failed to post to LinkedIn';
        setPostResults(prev => ({
          ...prev,
          linkedin: { 
            success: false, 
            message: errorMessage
          }
        }));
      }
    } catch (error) {
      setPostResults(prev => ({
        ...prev,
        linkedin: { 
          success: false, 
          message: 'An unexpected error occurred while posting to LinkedIn' 
        }
      }));
    } finally {
      setIsPostingToLinkedIn(false);
    }
  };

  const getTypeIcon = (type: ContentNode['type']) => {
    switch (type) {
      case 'post': return Target;
      case 'image': return Eye;
      case 'story': return Zap;
      default: return Target;
    }
  };

  const getStatusColor = (status: ContentNode['status']) => {
    switch (status) {
      case 'published': return 'bg-success text-success-foreground';
      case 'scheduled': return 'text-white';
      case 'draft': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!event) return null;

  const TypeIcon = getTypeIcon(event.type);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] border-[#03624C]/50" 
        style={{backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(12px)'}}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{backgroundColor: '#03624C'}}>
              <TypeIcon className="w-4 h-4 text-white" />
            </div>
            Edit Scheduled Event
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">Edit Event</TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Assistant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Event Info */}
            <div className="flex items-center gap-2 p-3 bg-card/50 rounded-lg border border-border/20">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm">
                {event.scheduledDate?.toLocaleDateString()} at {event.scheduledDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Badge 
                className={`ml-auto text-white`}
                style={{
                  backgroundColor: event.status === 'scheduled' ? '#03624C' : 
                                   event.status === 'published' ? '#2CC295' : 
                                   '#6B7280'
                }}
              >
                {event.status}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'post' | 'image' | 'story') => 
                    setFormData(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post">Post</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'draft' | 'scheduled' | 'published') => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Scheduled Date & Time</Label>
              <Input
                id="scheduledDate"
                type="datetime-local"
                value={formData.scheduledDate ? 
                  new Date(formData.scheduledDate.getTime() - formData.scheduledDate.getTimezoneOffset() * 60000)
                    .toISOString().slice(0, 16) : ''
                }
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  scheduledDate: e.target.value ? new Date(e.target.value) : undefined 
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter your content..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL (optional)</Label>
              <Input
                id="imageUrl"
                value={formData.imageUrl || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://example.com/image.jpg"
              />
              
              {/* Image Preview */}
              {(formData.imageUrl || event?.imageUrl) && (
                <div className="mt-3">
                  <Label className="text-sm font-medium mb-2 block">Image Preview</Label>
                  <div className="border border-border/20 rounded-lg overflow-hidden bg-card/50 flex justify-start">
                    <img 
                      src={formData.imageUrl || event?.imageUrl} 
                      alt="Preview" 
                      className="max-h-60 object-cover rounded-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="h-[60vh]">
            <div className="h-full border border-border/20 rounded-lg">
              <AIChat />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-4 border-t">
          <Button 
            onClick={handleSave} 
            className="text-white shadow-lg transition-colors"
            style={{backgroundColor: '#03624C'}}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2CC295'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#03624C'}
          >
            Save Changes
          </Button>
          
          {/* X Smart Action Button */}
          <Button
            variant="outline"
            size="default"
            onClick={handleSmartXAction}
            disabled={
              isPostingToX || 
              xAuthorized === null || 
              (xAuthorized && (!event?.content || event.content.length > 280))
            }
            className="transition-all duration-200 border-[#03624C]/50 text-[#00DF81]"
            style={{backgroundColor: 'rgba(0, 15, 49, 0.5)'}}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(3, 98, 76, 0.3)';
              e.currentTarget.style.borderColor = 'rgba(44, 194, 149, 0.7)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 15, 49, 0.5)';
              e.currentTarget.style.borderColor = 'rgba(3, 98, 76, 0.5)';
            }}
          >
            {getXButtonIcon()}
            {isPostingToX ? 'Processing...' : getXButtonText()}
          </Button>

          {/* X User Info Badge (show when authorized and have user info) */}
          {/* {currentXUser && xAuthorized && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
              <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-800 dark:text-green-200">
                @{currentXUser}
              </span>
            </div>
          )} */}
          
          {/* LinkedIn User Info Badge (show when authorized) */}
          {/* {linkedInAuthorized && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
              <CheckCircle className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-800 dark:text-blue-200">
                LinkedIn Connected
              </span>
            </div>
          )} */}
          
          <Button
            variant="outline"
            size="default"
            onClick={handleSmartLinkedInAction}
            disabled={
              isPostingToLinkedIn || 
              linkedInAuthorized === null || 
              (linkedInAuthorized && (!event?.content && !event?.imageUrl)) ||
              (linkedInAuthorized && event?.content && event.content.length > 3000)
            }
            className="transition-all duration-200 border-[#03624C]/50 text-[#00DF81]"
            style={{backgroundColor: 'rgba(0, 15, 49, 0.5)'}}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(3, 98, 76, 0.3)';
              e.currentTarget.style.borderColor = 'rgba(44, 194, 149, 0.7)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 15, 49, 0.5)';
              e.currentTarget.style.borderColor = 'rgba(3, 98, 76, 0.5)';
            }}
          >
            {getLinkedInButtonIcon()}
            {isPostingToLinkedIn ? 'Processing...' : getLinkedInButtonText()}
          </Button>
          
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          {onDelete && (
            <Button 
              variant="outline" 
              onClick={handleDelete}
              className="ml-auto border-destructive/20 hover:border-destructive/40 text-destructive"
            >
              Delete Event
            </Button>
          )}
        </div>
      </DialogContent>
      </Dialog>

      {/* Post Results - Portal to Body for Top Layer */}
      {open && (postResults.x || postResults.linkedin) && 
        createPortal(
          <div 
            className="fixed bottom-4 right-4 space-y-2" 
            style={{ 
              position: 'fixed', 
              zIndex: 999999999,
              pointerEvents: 'none'
            }}
          >
            {postResults.x && (
              <div className={`p-4 rounded-lg border-2 shadow-2xl backdrop-blur-md max-w-sm animate-in slide-in-from-right-2 pointer-events-auto transform transition-all duration-300 ${
                postResults.x.success 
                  ? 'bg-green-50/98 border-green-400 text-green-900 dark:bg-green-900/98 dark:border-green-500 dark:text-green-100' 
                  : 'bg-red-50/98 border-red-400 text-red-900 dark:bg-red-900/98 dark:border-red-500 dark:text-red-100'
              }`}>
                <div className="flex items-center gap-3">
                  {postResults.x.success ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <X className="w-5 h-5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className="text-sm font-semibold block">X (Twitter)</span>
                    <p className="text-xs mt-1 opacity-90">{postResults.x.message}</p>
                  </div>
                  <button
                    onClick={() => setPostResults(prev => ({ ...prev, x: undefined }))}
                    className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            
            {postResults.linkedin && (
              <div className={`p-4 rounded-lg border-2 shadow-2xl backdrop-blur-md max-w-sm animate-in slide-in-from-right-2 pointer-events-auto transform transition-all duration-300 ${
                postResults.linkedin.success 
                  ? 'bg-green-50/98 border-green-400 text-green-900 dark:bg-green-900/98 dark:border-green-500 dark:text-green-100' 
                  : 'bg-red-50/98 border-red-400 text-red-900 dark:bg-red-900/98 dark:border-red-500 dark:text-red-100'
              }`}>
                <div className="flex items-center gap-3">
                  {postResults.linkedin.success ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <X className="w-5 h-5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className="text-sm font-semibold block">LinkedIn</span>
                    <p className="text-xs mt-1 opacity-90">{postResults.linkedin.message}</p>
                  </div>
                  <button
                    onClick={() => setPostResults(prev => ({ ...prev, linkedin: undefined }))}
                    className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body
        )
      }
    </>
  );
};