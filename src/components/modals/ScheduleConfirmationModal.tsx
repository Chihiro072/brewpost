import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar, Clock, Target, Eye, Zap, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { NodeAPI } from '@/services/nodeService';

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

interface ScheduleConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: ContentNode[];
  onConfirm: (freshNodes?: ContentNode[]) => void;
}

export const ScheduleConfirmationModal: React.FC<ScheduleConfirmationModalProps> = ({
  open,
  onOpenChange,
  nodes,
  onConfirm
}) => {
  const [freshNodes, setFreshNodes] = useState<ContentNode[]>([]);
  const [loading, setLoading] = useState(false);
  const projectId = 'demo-project-123';

  // Fetch fresh node data from table 1 when modal opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      NodeAPI.list(projectId)
        .then(nodeData => {
          // Convert NodeDTO to ContentNode and filter for schedulable nodes
          const convertedNodes: ContentNode[] = nodeData
            .filter(n => n.scheduledDate && n.status !== 'published')
            .map(n => ({
              id: n.nodeId,
              title: n.title,
              type: (n.type as any) || 'post',
              status: (n.status as any) || 'draft',
              scheduledDate: n.scheduledDate ? new Date(n.scheduledDate) : undefined,
              content: n.description || '',
              imageUrl: n.imageUrl || undefined,
              connections: [],
              position: { x: n.x || 0, y: n.y || 0 }
            }));
          
          setFreshNodes(convertedNodes);
          console.log('Fresh nodes from table 1:', convertedNodes.map(n => ({ 
            title: n.title, 
            scheduledDate: n.scheduledDate 
          })));
        })
        .catch(error => {
          console.error('Failed to fetch fresh nodes:', error);
          // Fallback to passed nodes if fetch fails
          setFreshNodes(nodes);
        })
        .finally(() => setLoading(false));
    }
  }, [open, projectId]);

  // Use fresh nodes from table 1, fallback to passed nodes
  const displayNodes = freshNodes.length > 0 ? freshNodes : nodes;

  const getTypeIcon = (type: ContentNode['type']) => {
    switch (type) {
      case 'post': return Target;
      case 'image': return Eye;
      case 'story': return Zap;
      default: return Target;
    }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-md border-[#03624C]/50" 
        style={{backgroundColor: 'rgba(3, 34, 33, 0.95)', backdropFilter: 'blur(12px)'}}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Calendar className="w-5 h-5" style={{color: '#00DF81'}} />
            Schedule All Content
            {loading && <RefreshCw className="w-4 h-4 animate-spin" style={{color: '#2CC295'}} />}
          </DialogTitle>
          <DialogDescription className="text-[#00DF81]/70">
            The following {displayNodes.length} content items will be scheduled:
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading fresh data from table 1...</span>
            </div>
          ) : (
            displayNodes.map((node, index) => {
              const IconComponent = getTypeIcon(node.type);
              const scheduledDate = node.scheduledDate!;
              
              return (
                <Card key={node.id} className="p-3 bg-card/50 border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-full bg-primary/10">
                        <IconComponent className="w-3 h-3 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{node.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium">{format(scheduledDate, 'MMM dd')}</p>
                      <p className="text-xs text-muted-foreground">{format(scheduledDate, 'EEE')}</p>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-[#03624C]/50 text-[#00DF81] transition-colors hover:bg-[#03624C]/20 hover:border-[#2CC295]/70"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => onConfirm(displayNodes)} 
            disabled={loading || displayNodes.length === 0}
            className="text-white shadow-lg transition-colors"
            style={{backgroundColor: loading || displayNodes.length === 0 ? '#03624C60' : '#03624C'}}
            onMouseEnter={(e) => {
              if (!(loading || displayNodes.length === 0)) {
                e.currentTarget.style.backgroundColor = '#2CC295';
              }
            }}
            onMouseLeave={(e) => {
              if (!(loading || displayNodes.length === 0)) {
                e.currentTarget.style.backgroundColor = '#03624C';
              }
            }}
          >
            <Clock className="w-4 h-4 mr-2" />
            Schedule All ({displayNodes.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};