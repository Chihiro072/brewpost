import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar, Sparkles } from 'lucide-react';
import { AIChat } from '@/components/ai/AIChat';
import { Card } from '@/components/ui/card';

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
}

interface EditNodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: ContentNode | null;
  onSave: (updatedNode: ContentNode) => void;
}

export const EditNodeModal: React.FC<EditNodeModalProps> = ({
  open,
  onOpenChange,
  node,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<ContentNode>>({});
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    if (node) {
      console.log('EditNodeModal useEffect - node:', node.title, 'scheduledDate:', node.scheduledDate);
      setFormData({
        title: node.title,
        type: node.type,
        status: node.status,
        content: node.content,
        scheduledDate: node.scheduledDate,
        imageUrl: node.imageUrl
      });
    }
  }, [node]);

  const handleSave = () => {
    console.log('=== EDIT NODE MODAL SAVE DEBUG ===');
    console.log('EditNodeModal handleSave called');
    console.log('Current formData:', formData);
    console.log('Current formData scheduledDate:', formData.scheduledDate);
    console.log('Original node:', node);
    console.log('Original node scheduledDate:', node?.scheduledDate);
    
    if (!node) {
      console.log('No node found, returning');
      return;
    }
    
    const updatedNode: ContentNode = {
      ...node,
      ...formData,
      title: formData.title || node.title,
      type: formData.type || node.type,
      status: formData.status || node.status,
      content: formData.content || node.content,
      scheduledDate: formData.scheduledDate,
      imageUrl: formData.imageUrl
    };

    console.log('EditNodeModal: Final updatedNode:', updatedNode);
    console.log('EditNodeModal: Final updatedNode scheduledDate:', updatedNode.scheduledDate);
    console.log('=== END EDIT NODE MODAL SAVE DEBUG ===');
    onSave(updatedNode);
    onOpenChange(false);
  };

  const handleAISuggestion = () => {
    setShowAI(true);
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Content Node</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-4 overflow-hidden">
          {/* Main Edit Form */}
          <div className={`space-y-4 ${showAI ? 'w-1/2' : 'w-full'} overflow-y-auto`}>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter content title..."
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
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter your content..."
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Scheduled Date</Label>
              <Input
                id="scheduledDate"
                type="datetime-local"
                value={formData.scheduledDate ? 
                  new Date(formData.scheduledDate.getTime() - formData.scheduledDate.getTimezoneOffset() * 60000)
                    .toISOString().slice(0, 16) : ''
                }
                onChange={(e) => {
                  const newDate = e.target.value ? new Date(e.target.value) : undefined;
                  console.log('Date changed in modal:', e.target.value, 'parsed as:', newDate);
                  setFormData(prev => ({ 
                    ...prev, 
                    scheduledDate: newDate
                  }));
                }}
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
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="bg-gradient-primary">
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                variant="outline" 
                onClick={handleAISuggestion}
                className="ml-auto border-primary/20 hover:border-primary/40"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI Suggestions
              </Button>
            </div>
          </div>

          {/* AI Chat Panel */}
          {showAI && (
            <div className="w-1/2 border-l border-border/20 pl-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">AI Content Assistant</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAI(false)}>
                  ×
                </Button>
              </div>
              <Card className="h-[500px] overflow-hidden">
                <AIChat />
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};