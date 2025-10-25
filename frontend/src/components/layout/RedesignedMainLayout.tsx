import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AIChat } from '@/components/ai/AIChat';
import { NodeDetails } from '@/components/ai/NodeDetails';
import { DraggableNodeCanvas } from '@/components/planning/DraggableNodeCanvas';
import { CircleCanvas } from '@/components/canvas/CircleCanvas';
import { ComponentSidebar } from '@/components/canvas/ComponentSidebar';
import { TemplatePopup } from '@/components/template/TemplatePopup';
import { AddNodeModal } from '@/components/modals/AddNodeModal';
import { ScheduleConfirmationModal } from '@/components/modals/ScheduleConfirmationModal';
import { CalendarModal } from '@/components/modals/CalendarModal';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import type { GeneratedComponent } from '@/services/aiService';
import { 
  Sparkles, 
  Calendar, 
  Plus, 
  LogOut, 
  X,
  Clock,
  Image as ImageIcon,
  FileText,
  Layers
} from 'lucide-react';
import type { ContentNode } from '@/components/planning/PlanningPanel';

interface RedesignedMainLayoutProps {
  children?: React.ReactNode;
}

type SelectedCanvasComponent = {
  id: string;
  name: string;
  category: string;
  color: string;
  position: { x: number; y: number };
};

type CampaignComponentLocal = {
  id: string;
  type: 'online_trend' | 'campaign_type' | 'promotion_type';
  title: string;
  description: string;
  data?: unknown;
  relevanceScore: number;
  category: string;
  keywords: string[];
  impact: 'high' | 'medium' | 'low';
  color?: string;
};

export const RedesignedMainLayout: React.FC<RedesignedMainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<ContentNode | null>(null);
  
  // Sidebar states
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'content' | 'image' | 'analysis'>('content');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScheduleConfirmation, setShowScheduleConfirmation] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [isTemplatePopupOpen, setIsTemplatePopupOpen] = useState(false);
  
  // Canvas states
  const [selectedCanvasComponents, setSelectedCanvasComponents] = useState<SelectedCanvasComponent[]>([]);
  const [aiComponents, setAiComponents] = useState<GeneratedComponent[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState<boolean | string>(false);
  
  // Selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  
  const prevNodeIdRef = useRef<string | null>(null);

  // Demo fallback components
  const DEMO_COMPONENTS = [
    { id: 'demo-2', type: 'online_trend', title: 'Social Media Buzz', description: 'Latest social media trends and engagement', relevanceScore: 92, category: 'Online trend data', keywords: ['social','engagement','viral'], impact: 'high', color: '#0EA5E9' },
    { id: 'demo-1', type: 'promotion_type', title: 'Buy 1 Get 1', description: 'Classic BOGO promotion for limited time', relevanceScore: 85, category: 'Promotion Type', keywords: ['bogo','buy one get one','promotion'], impact: 'high', color: '#D97706' },
    { id: 'demo-3', type: 'campaign_type', title: 'Seasonal Campaign', description: 'Autumn-themed promotional campaign', relevanceScore: 78, category: 'Campaign Type', keywords: ['autumn','seasonal','promotion'], impact: 'medium', color: '#FB7185' },
  ];

  const PROMOTION_DEMOS = [
    { id: 'promo-demo-1', type: 'promotion_type', title: 'Buy 1 Get 1', description: 'BOGO — buy one get one free for same item', relevanceScore: 88, category: 'Promotion Type', keywords: ['bogo','buy one get one'], impact: 'high', color: '#06B6D4' },
    { id: 'promo-demo-2', type: 'promotion_type', title: '20% Off', description: 'Flat 20% off the entire purchase', relevanceScore: 82, category: 'Promotion Type', keywords: ['20% off','discount'], impact: 'medium', color: '#F59E0B' },
    { id: 'promo-demo-3', type: 'promotion_type', title: '50% Off Second Item', description: 'Buy one, get 50% off the second item', relevanceScore: 86, category: 'Promotion Type', keywords: ['50% off','second item','discount'], impact: 'high', color: '#10B981' },
  ];

  // Load nodes from AppSync
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const { NodeAPI } = await import('@/services/nodeService');
        const apiNodes = await NodeAPI.list('demo-project-123');
        
        const detectPostType = (title: string, content: string): 'engaging' | 'promotional' | 'branding' => {
          const text = `${title} ${content}`.toLowerCase();
          if (text.match(/\b(shop|order|buy|get yours|discount|available now|limited|offer|sale|use code|sign up|join|link in bio|free shipping|diy|recipe|create|make|try|get|start)\b/)) {
            return 'promotional';
          }
          if (text.match(/\b(crafted|behind the scenes|heritage|tradition|quality|meet|farmer|team|values|trust|story of|our process|secret|day in the life|art of|history|unveiling|science|grading|special)\b/)) {
            return 'branding';
          }
          return 'engaging';
        };
        
        const normalizeType = (t: unknown): 'post' | 'image' | 'story' => {
          if (!t) return 'post';
          const s = String(t).toLowerCase();
          if (s === 'image') return 'image';
          if (s === 'story') return 'story';
          return 'post';
        };
        
        const normalizeStatus = (s: unknown): 'draft' | 'scheduled' | 'published' => {
          if (!s) return 'draft';
          const v = String(s).toLowerCase();
          if (v === 'published') return 'published';
          if (v === 'scheduled') return 'scheduled';
          return 'draft';
        };

        const transformedNodes = apiNodes.map(x => {
          // Use imageUrls directly from the API response, or fall back to imageUrl
          let imageUrls: string[] | undefined = undefined;
          
          if (x.imageUrls && Array.isArray(x.imageUrls) && x.imageUrls.length > 0) {
            imageUrls = x.imageUrls;
          } else if (x.imageUrl) {
            imageUrls = [x.imageUrl];
          }

          return {
            id: x.nodeId,
            title: x.title,
            type: normalizeType(x.type),
            status: normalizeStatus(x.status),
            scheduledDate: x.scheduledDate ? new Date(x.scheduledDate) : undefined,
            content: x.description ?? '',
            imageUrl: x.imageUrl ?? undefined,
            imageUrls: imageUrls,
            imagePrompt: x.imagePrompt ?? undefined,
            day: x.day ?? undefined,
            postType: detectPostType(x.title, x.description ?? ''),
            connections: [],
            position: { x: x.x ?? 0, y: x.y ?? 0 },
            postedAt: x.createdAt ? new Date(x.createdAt) : undefined
          };
        });
        
        // Load edges and populate connections
        try {
          const { NodeAPI: EdgeAPI } = await import('@/services/nodeService');
          const edges = await EdgeAPI.listEdges('demo-project-123');
          
          const nodesWithConnections = transformedNodes.map(node => ({
            ...node,
            connections: edges.filter(edge => edge.from === node.id).map(edge => edge.to)
          }));
          
          setNodes(nodesWithConnections);
        } catch (edgeError) {
          console.warn('Failed to load edges:', edgeError);
          setNodes(transformedNodes);
        }
      } catch (error) {
        console.warn('Failed to load from AppSync, starting with empty nodes:', error);
        setNodes([]);
      }
    };
    loadNodes();
  }, []);

  // Handle node saving
  const handleSaveNode = async (updatedNode: ContentNode) => {
    setNodes(prevNodes => 
      prevNodes.map(node => 
        node.id === updatedNode.id ? updatedNode : node
      )
    );
    
    if (selectedNode && selectedNode.id === updatedNode.id) {
      setSelectedNode(updatedNode);
    }
    
    try {
      const { NodeAPI } = await import('@/services/nodeService');
      // Handle multiple images - store the latest as imageUrl and all in imageUrls array
      let imageUrlToStore = updatedNode.imageUrl;
      if (updatedNode.imageUrls && updatedNode.imageUrls.length > 0) {
        // Store the most recent image as imageUrl for backward compatibility
        imageUrlToStore = updatedNode.imageUrls[updatedNode.imageUrls.length - 1];
        console.log('handleSaveNode: storing multiple images:', updatedNode.imageUrls.length);
      }

      const updateData = {
        projectId: 'demo-project-123',
        nodeId: updatedNode.id,
        title: updatedNode.title,
        description: updatedNode.content,
        status: updatedNode.status,
        type: updatedNode.type,
        day: updatedNode.day,
        x: updatedNode.position?.x || 0,
        y: updatedNode.position?.y || 0,
        imageUrl: imageUrlToStore,
        imageUrls: updatedNode.imageUrls || null,
        imagePrompt: updatedNode.imagePrompt,
        ...(updatedNode.scheduledDate ? { scheduledDate: updatedNode.scheduledDate.toISOString() } : {}),
      };

      await NodeAPI.update(updateData as any);
      console.log('Node updated successfully');
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  };

  // Handle node posting
  const handlePostNode = (node: ContentNode) => {
    if (node.status === 'published') {
      const updatedNode = {
        ...node,
        postedAt: new Date(),
        postedTo: [...(node.postedTo || [])]
      };
      handleSaveNode(updatedNode);
    } else {
      setNodes(prev => prev.map(n => (n.id === node.id ? { ...n, ...node } : n)));
      if (selectedNode && selectedNode.id === node.id) {
        setSelectedNode({ ...selectedNode, ...node });
      }
    }
  };

  // Handle node double click - opens left sidebar with details
  const handleNodeDoubleClick = (node: ContentNode) => {
    setSelectedNode(node);
    setShowLeftSidebar(true);
  };

  // Handle node adding
  const handleAddNode = async (nodeData: Partial<ContentNode>) => {
    const newNode: ContentNode = {
      id: `node-${Date.now()}`,
      title: nodeData.title || 'New Node',
      type: nodeData.type || 'post',
      status: nodeData.status || 'draft',
      content: nodeData.content || '',
      connections: [],
      position: nodeData.position || { 
        x: Math.random() * 300 + 50, 
        y: Math.random() * 200 + 50 
      },
      scheduledDate: nodeData.scheduledDate,
      imageUrl: nodeData.imageUrl,
      imageUrls: nodeData.imageUrls || [],
      imagePrompt: nodeData.imagePrompt,
      postType: 'engaging'
    };

    // Add node to state first for immediate UI feedback
    setNodes(prev => [...prev, newNode]);
    
    try {
      const { NodeAPI } = await import('@/services/nodeService');
      
      // Handle multiple images for new node
      let imageUrlToStore = newNode.imageUrl;
      
      if (newNode.imageUrls && newNode.imageUrls.length > 0) {
        imageUrlToStore = newNode.imageUrls[newNode.imageUrls.length - 1];
      }
      
      const createRequest = {
        projectId: 'demo-project-123',
        nodeId: newNode.id,
        title: newNode.title,
        description: newNode.content,
        status: newNode.status,
        type: newNode.type,
        x: newNode.position.x,
        y: newNode.position.y,
        imageUrl: imageUrlToStore,
        imageUrls: newNode.imageUrls || null,
        imagePrompt: newNode.imagePrompt,
        ...(newNode.scheduledDate ? { scheduledDate: newNode.scheduledDate.toISOString() } : {}),
      };

      console.log('Creating node with data:', createRequest);
      const createdNode = await NodeAPI.create(createRequest);
      console.log('Node created successfully:', createdNode);
      
      // Update the node with any data returned from the server
      if (createdNode) {
        setNodes(prev => prev.map(node => 
          node.id === newNode.id ? { ...node, ...createdNode } : node
        ));
      }
    } catch (error) {
      console.error('Failed to create node:', error);
      // Show user-friendly error message
      alert('Failed to create node. Please try again.');
      // Remove the node from state if creation failed
      setNodes(prev => prev.filter(node => node.id !== newNode.id));
    }
    
    setShowAddModal(false);
  };

  // Handle schedule all
  const handleScheduleAll = () => {
    setShowScheduleConfirmation(true);
  };

  // Handle confirm schedule
  const handleConfirmSchedule = async (scheduledNodes: ContentNode[]) => {
    try {
      const { scheduleService } = await import('@/services/scheduleService');
      await scheduleService.createSchedules(scheduledNodes);
      
      // Update nodes status to scheduled
      setNodes(prev => prev.map(node => {
        const scheduledNode = scheduledNodes.find(sn => sn.id === node.id);
        return scheduledNode ? { ...node, status: 'scheduled' as const } : node;
      }));
      
      setShowScheduleConfirmation(false);
    } catch (error) {
      console.error('Failed to schedule nodes:', error);
    }
  };



  // Fetch AI components for selected node
  useEffect(() => {
    let canceled = false;
    const load = async () => {
      if (!selectedNode) {
        prevNodeIdRef.current = null;
        return setAiComponents(null);
      }
      
      if (selectedNode && prevNodeIdRef.current === selectedNode.id && aiComponents !== null) {
        return;
      }
      
      setAiLoading(true);
      setIsGenerating(`Generating AI components for "${selectedNode.title}"...`);
      
      try {
        const svc = await import('@/services/aiService');
        if (prevNodeIdRef.current !== selectedNode.id) {
          svc.clearComponentCache(selectedNode.id);
        }
        
        // Show progress updates during the long AI operation
        const progressMessages = [
          `Analyzing content for "${selectedNode.title}"...`,
          `Generating trend data components...`,
          `Creating campaign strategies...`,
          `Finalizing promotional offers...`
        ];
        
        let messageIndex = 0;
        const progressInterval = setInterval(() => {
          if (messageIndex < progressMessages.length - 1) {
            messageIndex++;
            if (!canceled) {
              setIsGenerating(progressMessages[messageIndex]);
            }
          }
        }, 8000); // Update every 8 seconds
        
        const comps = await svc.fetchComponentsForNode(selectedNode);
        
        clearInterval(progressInterval);
        
        if (!canceled) {
          setAiComponents(comps && comps.length ? comps : []);
          setIsGenerating(false);
        }
      } catch (err) {
        console.warn('Failed to load AI components', err);
        if (!canceled) {
          setAiComponents([]);
          setIsGenerating(false);
        }
      } finally {
        if (!canceled) {
          setAiLoading(false);
        }
      }
    };
    load();
    prevNodeIdRef.current = selectedNode ? selectedNode.id : null;
    return () => { canceled = true; };
  }, [selectedNode, aiComponents]);

  // Handle tab styling for active states
  useEffect(() => {
    const updateTabStyles = () => {
      const tabs = document.querySelectorAll('[data-active-style]');
      tabs.forEach(tab => {
        const isActive = tab.getAttribute('data-state') === 'active';
        if (isActive) {
          (tab as HTMLElement).style.backgroundColor = '#03624C';
        } else {
          (tab as HTMLElement).style.backgroundColor = 'transparent';
        }
      });
    };
    
    // Update immediately and set up observer
    updateTabStyles();
    const observer = new MutationObserver(updateTabStyles);
    const tabsList = document.querySelector('[role="tablist"]');
    if (tabsList) {
      observer.observe(tabsList, { attributes: true, subtree: true });
    }
    
    return () => observer.disconnect();
  }, [activeRightTab]);

  // Map AI components
  const sourceComponents = aiComponents !== null ? aiComponents : DEMO_COMPONENTS;
  const activeGeneratedComponents = sourceComponents.map((c: GeneratedComponent | typeof DEMO_COMPONENTS[number]) => ({
    id: c.id,
    type: (c.type === 'online_trend' || c.type === 'campaign_type' || c.type === 'promotion_type') ? c.type : 'campaign_type',
    title: c.title ?? c.id,
    description: c.description ?? '',
    relevanceScore: c.relevanceScore ?? 50,
    category: c.category ?? 'Suggested',
    keywords: c.keywords ?? [],
    impact: (c.impact as 'low' | 'medium' | 'high') ?? 'medium'
  }));

  const hasPromotion = activeGeneratedComponents.some(c => c.type === 'promotion_type');
  const finalGeneratedComponents = hasPromotion ? activeGeneratedComponents : [...activeGeneratedComponents, ...PROMOTION_DEMOS];
  const canvasComponents = aiLoading ? [] : finalGeneratedComponents;

  const handleLogout = () => {
    navigate('/');
  };

  const handleCalendarPage = () => {
    navigate('/calendar');
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl relative z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="BrewPost" className="w-10 h-10" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                BrewPost
              </h1>
              <p className="text-xs text-muted-foreground">AI Content Generator</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-destructive/20 hover:border-destructive/40 hover:bg-destructive/10 text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-80px)] relative">
        {/* Left Sidebar - Details Popup */}
        {showLeftSidebar && (
          <div className="absolute left-4 top-4 bottom-4 w-96 backdrop-blur-xl rounded-2xl shadow-2xl z-40 transition-all duration-300 ease-in-out border border-[#03624C]/50" style={{backgroundColor: 'rgba(3, 34, 33, 0.95)'}}>
            <div className="h-full flex flex-col rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#03624C]/50" style={{borderBottomColor: 'rgba(3, 98, 76, 0.5)'}}>
                <h3 className="font-semibold text-base text-white">All the details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLeftSidebar(false)}
                  className="hover:text-[#2CC295] text-[#00DF81]/70"
                  style={{backgroundColor: 'transparent'}}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(3, 98, 76, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <NodeDetails 
                  node={selectedNode}
                  nodes={nodes}
                  onSaveNode={handleSaveNode}
                  onPostNode={handlePostNode}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Canvas Area */}
        <div 
          className="flex-1 h-full relative transition-all duration-300 ease-in-out"
          style={{
            background: `
              radial-gradient(circle, rgba(3, 98, 76, 1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
            backgroundColor: 'rgba(0, 15, 49, 0.05)'
          }}
        >
          <DraggableNodeCanvas
            nodes={nodes}
            onNodeUpdate={setNodes}
            onNodeClick={handleNodeDoubleClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            selectedNodeIds={selectedNodeIds}
            onSelectionChange={setSelectedNodeIds}
            onAddNode={() => {
              const newNode = {
                id: Date.now().toString(),
                title: 'New Post',
                type: 'post' as const,
                status: 'draft' as const,
                content: 'Enter your content here...',
                connections: [],
                position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 }
              };
              setNodes([...nodes, newNode]);
            }}
            onDeleteNode={async (nodeId: string) => {
              // Remove from UI immediately
              setNodes(nodes.filter(node => node.id !== nodeId));
              
              // If this was the selected node, clear the selection
              if (selectedNode && selectedNode.id === nodeId) {
                setSelectedNode(null);
                setShowLeftSidebar(false);
              }
              
              // Remove from database
              try {
                const { NodeAPI } = await import('@/services/nodeService');
                await NodeAPI.remove('demo-project-123', nodeId);
                console.log('Node deleted successfully from database');
              } catch (error) {
                console.error('Failed to delete node from database:', error);
                // Optionally, you could show a toast notification or revert the UI change
              }
            }}
            onCanvasClick={() => {}}
          />

          {/* Bottom Action Bar */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
            <div className="flex items-center gap-4 backdrop-blur-xl border border-[#03624C]/50 rounded-2xl px-6 py-3 shadow-2xl" style={{backgroundColor: 'rgba(3, 34, 33, 0.95)'}}>
              <Button
                onClick={handleScheduleAll}
                className="text-white shadow-lg transition-colors hover:opacity-90"
                style={{backgroundColor: '#03624C'}}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2CC295'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#03624C'}
                disabled={nodes.length === 0}
              >
                <Clock className="w-4 h-4 mr-2" />
                Schedule all
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowCalendarModal(true)}
                className="border-[#03624C]/50 text-[#00DF81] transition-colors"
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
                <Calendar className="w-4 h-4" />
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowAddModal(true)}
                className="border-[#03624C]/50 rounded-full w-10 h-10 p-0 text-[#00DF81] transition-colors"
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
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - AI Popup */}
        {showRightSidebar && (
          <div className="absolute right-4 top-4 bottom-4 w-96 backdrop-blur-xl rounded-2xl shadow-2xl z-40 transition-all duration-300 ease-in-out border border-[#03624C]/50" style={{backgroundColor: 'rgba(3, 34, 33, 0.95)'}}>
            <div className="h-full flex flex-col rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#03624C]/50" style={{borderBottomColor: 'rgba(3, 98, 76, 0.5)'}}>
                <Tabs value={activeRightTab} onValueChange={(value) => setActiveRightTab(value as 'content' | 'image' | 'analysis')} className="flex-1">
                  <div className="flex items-center justify-between">
                    <TabsList className="grid w-full grid-cols-3 max-w-[300px] border border-[#03624C]/30" style={{backgroundColor: 'rgba(0, 15, 49, 0.5)'}}>
                      <TabsTrigger 
                        value="content" 
                        className="text-sm text-[#00DF81]/70 data-[state=active]:text-white transition-colors"
                        style={{'--tw-bg-opacity': '1'}}
                        onMouseEnter={(e) => {
                          if (!e.currentTarget.getAttribute('data-state')?.includes('active')) {
                            e.currentTarget.style.backgroundColor = 'rgba(3, 98, 76, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!e.currentTarget.getAttribute('data-state')?.includes('active')) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                        data-active-style={{backgroundColor: '#03624C'}}
                      >
                        Content
                      </TabsTrigger>
                      <TabsTrigger 
                        value="image" 
                        className="text-sm text-[#00DF81]/70 data-[state=active]:text-white transition-colors"
                        style={{'--tw-bg-opacity': '1'}}
                        onMouseEnter={(e) => {
                          if (!e.currentTarget.getAttribute('data-state')?.includes('active')) {
                            e.currentTarget.style.backgroundColor = 'rgba(3, 98, 76, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!e.currentTarget.getAttribute('data-state')?.includes('active')) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                        data-active-style={{backgroundColor: '#03624C'}}
                      >
                        Image
                      </TabsTrigger>
                      <TabsTrigger 
                        value="analysis" 
                        className="text-sm text-[#00DF81]/70 data-[state=active]:text-white transition-colors"
                        style={{'--tw-bg-opacity': '1'}}
                        onMouseEnter={(e) => {
                          if (!e.currentTarget.getAttribute('data-state')?.includes('active')) {
                            e.currentTarget.style.backgroundColor = 'rgba(3, 98, 76, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!e.currentTarget.getAttribute('data-state')?.includes('active')) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                        data-active-style={{backgroundColor: '#03624C'}}
                      >
                        Analysis
                      </TabsTrigger>
                    </TabsList>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRightSidebar(false)}
                      className="hover:text-[#2CC295] text-[#00DF81]/70 ml-2"
                      style={{backgroundColor: 'transparent'}}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(3, 98, 76, 0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Tabs>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <Tabs value={activeRightTab} className="h-full">
                  <TabsContent value="content" className="h-full m-0">
                    <div className="h-full">
                      <AIChat setPlanningNodes={setNodes} />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="image" className="h-full m-0">
                    <div className="h-full relative">
                      <CircleCanvas 
                        selectedComponents={selectedCanvasComponents}
                        isGenerating={isGenerating}
                        selectedNode={selectedNode}
                        onSaveNode={handleSaveNode}
                        onGenerate={(status) => {
                          // Handle preview mode
                          if (status.startsWith('PREVIEW:')) {
                            const imageUrl = status.replace('PREVIEW:', '');
                            // Show image preview modal
                            const modal = document.createElement('div');
                            modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm';
                            modal.innerHTML = `
                              <div class="relative max-w-4xl max-h-[90vh] p-4">
                                <img src="${imageUrl}" alt="Generated Image Preview" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                                <button class="absolute top-2 right-2 w-8 h-8 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-colors" onclick="this.parentElement.parentElement.remove()">
                                  ×
                                </button>
                              </div>
                            `;
                            modal.onclick = (e) => {
                              if (e.target === modal) modal.remove();
                            };
                            document.body.appendChild(modal);
                            return;
                          }
                          setIsGenerating(status);
                        }}
                        onAddComponent={(component) => {
                          const newComponent: SelectedCanvasComponent = {
                            id: component.id,
                            name: (component.name ?? component.id) as string,
                            category: component.category ?? 'Suggested',
                            color: component.color ?? '#60A5FA',
                            position: { x: 0, y: 0 }
                          };
                          setSelectedCanvasComponents(prev => {
                            if (prev.find(c => c.id === component.id)) {
                              return prev;
                            }
                            return [...prev, newComponent];
                          });
                        }}
                        onRemoveComponent={(id) => {
                          setSelectedCanvasComponents(prev => prev.filter(c => c.id !== id));
                        }}
                        generatedComponents={canvasComponents as unknown as CampaignComponentLocal[]}
                      />
                      
                      {/* Template Button */}
                      <div className="absolute top-4 right-4">
                        <Button
                          onClick={() => setIsTemplatePopupOpen(true)}
                          className="shadow-lg text-white transition-colors"
                          style={{backgroundColor: '#03624C'}}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2CC295'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#03624C'}
                          size="sm"
                        >
                          <Layers className="w-4 h-4 mr-2" />
                          Template
                        </Button>
                      </div>
                      
                      {/* Component Sidebar at bottom */}
                      <div className="absolute bottom-0 left-0 right-0">
                        <ComponentSidebar 
                          onAddComponent={(component) => {
                            const newComponent = {
                              id: component.id,
                              name: component.name,
                              category: component.category,
                              color: component.color,
                              position: { x: 0, y: 0 }
                            };
                            setSelectedCanvasComponents(prev => {
                              if (prev.find(c => c.id === component.id)) {
                                return prev;
                              }
                              return [...prev, newComponent];
                            });
                          }}
                          onRemoveFromCanvas={(id) => {
                            setSelectedCanvasComponents(prev => prev.filter(c => c.id !== id));
                          }}
                          generatedComponents={finalGeneratedComponents as unknown as CampaignComponentLocal[]}
                          isLoadingAi={aiLoading}
                          generationProgress={isGenerating}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="analysis" className="h-full m-0">
                    <div className="h-full">
                      <AnalysisPanel selectedNode={selectedNode} />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}

        {/* AI Toggle Button - Bottom Right */}
        {!showRightSidebar && (
          <div className="fixed bottom-6 right-6 z-30">
            <Button
              onClick={() => setShowRightSidebar(true)}
              className="shadow-2xl rounded-full w-16 h-16 p-0 transition-colors"
              style={{backgroundColor: '#03624C'}}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2CC295'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#03624C'}
            >
              <Sparkles className="w-12 h-12 text-white" />
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddNodeModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onAddNode={handleAddNode}
      />

      <ScheduleConfirmationModal
        open={showScheduleConfirmation}
        onOpenChange={setShowScheduleConfirmation}
        nodes={nodes.filter(node => node.scheduledDate && node.status !== 'published' && !node.postedAt)}
        onConfirm={handleConfirmSchedule}
      />

      <CalendarModal
        open={showCalendarModal}
        onOpenChange={setShowCalendarModal}
        scheduledNodes={nodes.filter(node => node.status === 'scheduled')}
        editable={true}
        onEditNode={handleSaveNode}
        onDeleteNode={(nodeId) => {
          // Remove from nodes state immediately for instant UI update
          setNodes(prev => prev.filter(node => node.id !== nodeId));
        }}
      />

      <TemplatePopup 
        isOpen={isTemplatePopupOpen}
        onClose={() => setIsTemplatePopupOpen(false)}
      />
    </div>
  );
};