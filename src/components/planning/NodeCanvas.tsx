import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  Eye, 
  Zap, 
  Calendar,
  ArrowRight 
} from 'lucide-react';

interface ContentNode {
  id: string;
  title: string;
  type: 'post' | 'image' | 'story';
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: Date;
  content: string;
  imageUrl?: string;
  connections: string[];
}

interface NodeCanvasProps {
  nodes: ContentNode[];
  onNodeClick: (node: ContentNode) => void;
}

export const NodeCanvas: React.FC<NodeCanvasProps> = ({ nodes, onNodeClick }) => {
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

  const nodePositions = [
    { x: 20, y: 20 },
    { x: 320, y: 80 },
    { x: 180, y: 200 },
  ];

  return (
    <div className="relative w-full h-full p-6 overflow-auto scrollbar-hide">
      {/* Connection Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(191 19% 33%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(191 25% 40%)" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {nodes.map((node, index) => 
          node.connections.map((connectedId) => {
            const connectedIndex = nodes.findIndex(n => n.id === connectedId);
            if (connectedIndex === -1) return null;
            
            const startPos = nodePositions[index];
            const endPos = nodePositions[connectedIndex];
            
            return (
              <line
                key={`${node.id}-${connectedId}`}
                x1={startPos.x + 120}
                y1={startPos.y + 60}
                x2={endPos.x + 120}
                y2={endPos.y + 60}
                stroke="url(#connectionGradient)"
                strokeWidth="2"
                strokeDasharray="5,5"
                className="animate-pulse"
              />
            );
          })
        )}
      </svg>

      {/* Nodes */}
      {nodes.map((node, index) => {
        const TypeIcon = getTypeIcon(node.type);
        const position = nodePositions[index];
        
        return (
          <Card
            key={node.id}
            className="absolute w-60 p-4 bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/50 cursor-pointer transition-all duration-300 hover:scale-105 glow-hover z-10"
            style={{
              left: position.x,
              top: position.y,
            }}
            onClick={() => onNodeClick(node)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <TypeIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{node.title}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {node.content}
            </p>

            <div className="flex items-center justify-between">
              <Badge 
                variant="secondary" 
                className={`text-xs ${getStatusColor(node.status)}`}
              >
                {node.status}
              </Badge>
              
              {node.scheduledDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {node.scheduledDate.toLocaleDateString()}
                </div>
              )}
            </div>

            {node.connections.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/20">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowRight className="w-3 h-3" />
                  <span>Connects to {node.connections.length} item(s)</span>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};