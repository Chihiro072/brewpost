import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PostingService } from '@/services/postingService';
import { 
  Calendar,
  Clock,
  Share2,
  Edit,
  Download,
  Target,
  Eye,
  Zap,
  Image as ImageIcon,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface ContentNode {
  id: string;
  title: string;
  type: 'post' | 'image' | 'story';
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: Date;
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
  day?: string;
  connections: string[];
  postedAt?: Date;
  postedTo?: string[];
  tweetId?: string;
}

interface ContentModalProps {
  node: ContentNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditNode?: (node: ContentNode) => void;
}

export const ContentModal: React.FC<ContentModalProps> = ({ 
  node, 
  open, 
  onOpenChange,
  onEditNode 
}) => {
  const [isPosting, setIsPosting] = useState(false);
  const [postResult, setPostResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!node) return null;

  const handlePost = async () => {
    if (!node?.content) {
      setPostResult({ success: false, message: 'No content to post' });
      return;
    }

    setIsPosting(true);
    setPostResult(null);

    try {
      const result = await PostingService.postToX(node.content);
      
      if (result.ok) {
        // Update the node with posted information
        const updatedNode = {
          ...node,
          status: 'published' as const,
          postedAt: new Date(),
          postedTo: ['X'],
          tweetId: result.tweetId
        };
        
        // Notify parent component about the status change
        if (onEditNode) {
          onEditNode(updatedNode);
        }
        
        setPostResult({ 
          success: true, 
          message: `Successfully posted to X! Tweet ID: ${result.tweetId}` 
        });
      } else {
        setPostResult({ 
          success: false, 
          message: result.error || 'Failed to post to X' 
        });
      }
    } catch (error) {
      setPostResult({ 
        success: false, 
        message: 'An unexpected error occurred while posting' 
      });
    } finally {
      setIsPosting(false);
    }
  };

  const getStatusColor = (status: ContentNode['status']) => {
    switch (status) {
      case 'published': return 'bg-success text-success-foreground';
      case 'scheduled': return 'bg-gradient-primary text-white';
      case 'draft': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
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

  const TypeIcon = getTypeIcon(node.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
                <TypeIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">{node.title}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground capitalize">
                  {node.type} content • ID: {node.id}
                </DialogDescription>
              </div>
            </div>
            <Badge className={`${getStatusColor(node.status)} border-none`}>
              {node.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Posted Status - Show prominently if content has been posted */}
          {node.postedAt && node.postedTo && (
            <div>
              <h3 className="text-sm font-medium mb-3">Posting Status</h3>
              <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      ✅ This content has been posted!
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Posted to {node.postedTo.join(', ')} on {node.postedAt.toLocaleDateString()} at {node.postedAt.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                {node.tweetId && (
                  <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Tweet ID: {node.tweetId}
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Content Preview */}
          <div>
            <h3 className="text-sm font-medium mb-3">Content Preview</h3>
            <Card className="p-4 bg-gradient-subtle border-border/30">
              {node.type === 'image' && (
                <div className="w-full h-48 bg-gradient-secondary rounded-lg mb-4 flex items-center justify-center">
                  <div className="text-center">
                    <ImageIcon className="w-12 h-12 text-white/80 mx-auto mb-2" />
                    <p className="text-white/80 text-sm">Generated Image Preview</p>
                  </div>
                </div>
              )}
              <p className="text-sm leading-relaxed">{node.content}</p>
            </Card>
          </div>

          {/* Image Prompt */}
          {node.imagePrompt && (
            <div>
              <h3 className="text-sm font-medium mb-3">Image Prompt</h3>
              <Card className="p-4 bg-card/50 backdrop-blur-sm border-border/30">
                <p className="text-sm leading-relaxed italic">{node.imagePrompt}</p>
              </Card>
            </div>
          )}

          {/* Scheduling Info */}
          {node.scheduledDate && (
            <div>
              <h3 className="text-sm font-medium mb-3">Schedule Details</h3>
              <Card className="p-4 bg-card/50 backdrop-blur-sm border-border/30">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      {node.scheduledDate.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      {node.scheduledDate.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Connections */}
          {node.connections.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Connected Content</h3>
              <div className="space-y-2">
                {node.connections.map((connectionId) => (
                  <Card key={connectionId} className="p-3 bg-card/50 backdrop-blur-sm border-border/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-accent rounded-md flex items-center justify-center">
                          <Target className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-sm">Connected Node {connectionId}</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Share2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Separator className="opacity-50" />

          {/* Post Status Message */}
          {postResult && (
            <Card className={`p-3 ${postResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2">
                {postResult.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-sm ${postResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {postResult.message}
                </span>
              </div>
            </Card>
          )}

          <Separator className="opacity-50" />

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <Button 
              className="bg-gradient-primary hover:opacity-90 glow-hover"
              onClick={() => {
                if (onEditNode && node) {
                  onEditNode(node);
                  onOpenChange(false); // Close content modal
                }
              }}
            >
              <Edit className="w-3 h-3 mr-2" />
              Edit Content
            </Button>
            
            <Button 
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-lg shadow-green-500/25 glow-hover border-0"
              onClick={handlePost}
              disabled={isPosting || !node?.content || (node.postedAt && node.postedTo && node.postedTo.length > 0)}
            >
              {isPosting ? (
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              ) : (node.postedAt && node.postedTo && node.postedTo.length > 0) ? (
                <CheckCircle className="w-3 h-3 mr-2" />
              ) : postResult?.success ? (
                <CheckCircle className="w-3 h-3 mr-2" />
              ) : (
                <Send className="w-3 h-3 mr-2" />
              )}
              {isPosting 
                ? 'Posting...' 
                : (node.postedAt && node.postedTo && node.postedTo.length > 0)
                ? 'Already Posted'
                : postResult?.success 
                ? 'Posted!' 
                : 'Post'
              }
            </Button>
            
            <Button variant="outline" className="border-primary/20 hover:border-primary/40 glow-hover">
              <Calendar className="w-3 h-3 mr-2" />
              Schedule
            </Button>
            
            <Button variant="outline" className="border-primary/20 hover:border-primary/40">
              <Download className="w-3 h-3 mr-2" />
              Export
            </Button>
            
            <Button variant="outline" className="border-primary/20 hover:border-primary/40">
              <Share2 className="w-3 h-3 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};