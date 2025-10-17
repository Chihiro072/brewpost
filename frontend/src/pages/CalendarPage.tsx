import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarView } from '@/components/calendar/CalendarView';

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
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch schedules from backend
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const { scheduleService } = await import('@/services/scheduleService');
        const data = await scheduleService.listSchedules();

        if (data.ok && Array.isArray(data.schedules)) {
          const parsed = data.schedules.map((s: any) => ({
            id: s.scheduleId || s.id,
            title: s.title || 'Untitled',
            type: (s.type || 'post') as 'post' | 'image' | 'story',
            status: (s.status || 'scheduled') as 'draft' | 'scheduled' | 'published',
            scheduledDate: s.scheduledDate ? new Date(s.scheduledDate) : undefined,
            content: s.content || '',
            imageUrl: s.imageUrl,
            connections: [],
            position: { x: 0, y: 0 }
          }));
          setNodes(parsed);
        } else {
          console.error("Unexpected API response:", data);
        }
      } catch (err) {
        console.error("Failed to fetch schedules:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, []);

  const handleUpdateNode = async (updatedNode: ContentNode) => {
    setNodes(prev =>
      prev.map(n => (n.id === updatedNode.id ? updatedNode : n))
    );

    try {
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/schedules/update/${updatedNode.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...updatedNode,
            scheduledDate: updatedNode.scheduledDate?.toISOString(), // ✅ send string to backend
          }),
        }
      );
    } catch (err) {
      console.error("Failed to update schedule:", err);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));

    try {
      const { scheduleService } = await import('@/services/scheduleService');
      const result = await scheduleService.deleteSchedule(nodeId);
      
      if (!result.ok) {
        console.error("Failed to delete schedule:", result.error);
        // Revert the UI change if delete failed
        const fetchSchedules = async () => {
          const data = await scheduleService.listSchedules();
          if (data.ok && Array.isArray(data.schedules)) {
            const parsed = data.schedules.map((s: any) => ({
              id: s.scheduleId || s.id,
              title: s.title || 'Untitled',
              type: (s.type || 'post') as 'post' | 'image' | 'story',
              status: (s.status || 'scheduled') as 'draft' | 'scheduled' | 'published',
              scheduledDate: s.scheduledDate ? new Date(s.scheduledDate) : undefined,
              content: s.content || '',
              imageUrl: s.imageUrl,
              connections: [],
              position: { x: 0, y: 0 }
            }));
            setNodes(parsed);
          }
        };
        fetchSchedules();
      }
    } catch (err) {
      console.error("Failed to delete schedule:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="p-4">
        <Button
          variant="outline"
          onClick={() => navigate("/app")}
          className="mb-4 border-primary/20 hover:border-primary/40"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Planning
        </Button>

        {loading ? (
          <p className="text-gray-500">Loading schedules...</p>
        ) : (
          <CalendarView
            scheduledNodes={nodes.length > 0 ? nodes : undefined}
            onClose={() => navigate("/app")}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            editable={true}
          />
        )}
      </div>
    </div>
  );
};
