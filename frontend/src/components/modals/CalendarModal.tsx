import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarView } from '@/components/calendar/CalendarView';
import { scheduleService } from '@/services/scheduleService';

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

interface CalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduledNodes: ContentNode[];
  editable?: boolean;
  onEditNode?: (node: ContentNode) => void;
  onDeleteNode?: (nodeId: string) => void;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  open,
  onOpenChange,
  scheduledNodes,
  editable = true,
  onEditNode,
  onDeleteNode
}) => {
  const handleDeleteNode = async (nodeId: string) => {
    try {
      await scheduleService.deleteSchedule(nodeId);
      // Notify parent to refresh the nodes
      if (onDeleteNode) {
        onDeleteNode(nodeId);
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const handleUpdateNode = async (updatedNode: ContentNode) => {
    console.log('CalendarModal handleUpdateNode called with:', updatedNode);
    try {
      // Update Node table via AppSync
      const { NodeAPI } = await import('@/services/nodeService');
      console.log('Updating Node table...');
      await NodeAPI.update({
        projectId: 'demo-project-123',
        nodeId: updatedNode.id,
        title: updatedNode.title,
        description: updatedNode.content,
        status: updatedNode.status,
        type: updatedNode.type,
        x: updatedNode.position?.x || 0,
        y: updatedNode.position?.y || 0,
        imageUrl: updatedNode.imageUrl,
        ...(updatedNode.scheduledDate ? { scheduledDate: updatedNode.scheduledDate.toISOString() } : {}),
      });
      console.log('Node table updated successfully');
      
      // Update Schedule table via scheduleService
      console.log('Updating Schedule table...');
      await scheduleService.updateSchedule(updatedNode);
      console.log('Schedule table updated successfully');
      
      // Also call parent's onEditNode if provided
      if (onEditNode) {
        console.log('Calling parent onEditNode...');
        onEditNode(updatedNode);
      }
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Calendar Preview</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto">
          <CalendarView 
            scheduledNodes={scheduledNodes}
            onClose={() => onOpenChange(false)}
            editable={editable}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};