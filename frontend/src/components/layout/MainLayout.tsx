import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AIChat } from '@/components/ai/AIChat';
import { NodeDetails } from '@/components/ai/NodeDetails';
import { PlanningPanel, type PlanningPanelRef } from '@/components/planning/PlanningPanel';
import type { GeneratedComponent } from '@/services/aiService';
import { CircleCanvas } from '@/components/canvas/CircleCanvas';
import { ComponentSidebar } from '@/components/canvas/ComponentSidebar';
import { TemplatePopup } from '@/components/template/TemplatePopup';
import { Sparkles, Calendar, Network, LogOut, FileText, X } from 'lucide-react';
import type { ContentNode } from '@/components/planning/PlanningPanel';

interface MainLayoutProps {
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const [showCalendar, setShowCalendar] = useState(false);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [activeTab, setActiveTab] = useState('ai');
  const [selectedNode, setSelectedNode] = useState<ContentNode | null>(null);
  const [viewMode, setViewMode] = useState<'nodes' | 'canvas'>('nodes'); // New state for view mode
  const [canvasNodeId, setCanvasNodeId] = useState<string | null>(null); // Store node ID for canvas mode
  const [selectedCanvasComponents, setSelectedCanvasComponents] = useState<SelectedCanvasComponent[]>([]); // State for canvas components
  const [aiComponents, setAiComponents] = useState<GeneratedComponent[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState<boolean | string>(false); // State for generation status
  const [isTemplatePopupOpen, setIsTemplatePopupOpen] = useState(false);
  const planningPanelRef = useRef<PlanningPanelRef>(null);
  const prevNodeIdRef = useRef<string | null>(null);

  // Resolve per-user storage key for planner nodes
  const getPlannerStorageKey = (): string => {
    try {
      const userId = window.localStorage.getItem('userId');
      return `bp_planner_${userId || 'guest'}`;
    } catch {
      return 'bp_planner_guest';
    }
  };

  // Load nodes from AppSync with localStorage fallback for persistence across refreshes
  useEffect(() => {
    const loadNodes = async () => {
      // First try to load from localStorage to make refresh fast/persistent
      try {
        const key = getPlannerStorageKey();
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as any[];
          const revived: ContentNode[] = parsed.map((n) => ({
            ...n,
            scheduledDate: n.scheduledDate ? new Date(n.scheduledDate) : undefined,
            postedAt: n.postedAt ? new Date(n.postedAt) : undefined,
          }));
          setNodes(revived);
        }
      } catch (e) {
        console.warn('Planner: failed to load local nodes, continuing:', e);
      }

      // Then attempt to load fresh data from AppSync and merge/override
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

        const transformedNodes = apiNodes.map(x => ({
          id: x.nodeId,
          title: x.title,
          type: normalizeType(x.type),
          status: normalizeStatus(x.status),
          scheduledDate: x.scheduledDate ? new Date(x.scheduledDate) : undefined,
          content: x.description ?? '',
          imageUrl: x.imageUrl ?? undefined,
          imageUrls: x.imageUrls ?? undefined,
          imagePrompt: x.imagePrompt ?? undefined,
          day: x.day ?? undefined,
          postType: detectPostType(x.title, x.description ?? ''),
          connections: Array.isArray((x as any).connections) ? (x as any).connections : [],
          position: { x: x.x ?? 0, y: x.y ?? 0 },
          postedAt: x.createdAt ? new Date(x.createdAt) : undefined,
          selectedImageUrl: (x as any).selectedImageUrl ?? undefined,
        }));
        
        // Load edges and populate connections
        try {
          const { NodeAPI: EdgeAPI } = await import('@/services/nodeService');
          const edges = await EdgeAPI.listEdges('demo-project-123');
          console.log('Loaded edges:', edges.length);
          
          // Add connections to nodes based on edges
          const nodesWithConnections = transformedNodes.map(node => ({
            ...node,
            connections: Array.from(new Set([
              ...node.connections,
              ...edges.filter(edge => edge.from === node.id).map(edge => edge.to)
            ]))
          }));
          
          // Merge server data over local fallback to keep latest positions/status
          setNodes(prev => {
            // Map by id for quick merge
            const byId = new Map(prev.map(p => [p.id, p]));
            const merged = nodesWithConnections.map(s => {
              const local = byId.get(s.id);
              if (!local) return s;
              return {
                ...s,
                // Preserve local position if user moved nodes recently before server data loaded
                position: local.position || s.position,
              };
            });
            return merged;
          });
        } catch (edgeError) {
          console.warn('Failed to load edges:', edgeError);
          setNodes(transformedNodes);
        }
      } catch (error) {
        console.warn('Failed to load from AppSync, falling back to local only:', error);
        // If localStorage already set nodes, keep them; otherwise ensure array
        setNodes(prev => Array.isArray(prev) ? prev : []);
      }
    };
    loadNodes();
  }, []);

  // Persist nodes to localStorage whenever they change
  useEffect(() => {
    try {
      const key = getPlannerStorageKey();
      const toSave = nodes.map(n => ({
        ...n,
        scheduledDate: n.scheduledDate ? n.scheduledDate.toISOString() : undefined,
        postedAt: n.postedAt ? n.postedAt.toISOString() : undefined,
      }));
      window.localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Planner: failed to persist nodes:', e);
    }
  }, [nodes]);

  // Shared save function that works in both modes
  const handleSaveNode = async (updatedNode: ContentNode) => {
    console.log('=== MAIN LAYOUT HANDLE SAVE NODE DEBUG ===');
    console.log('MainLayout handleSaveNode called with:', updatedNode);
    console.log('Current viewMode:', viewMode);
    console.log('Updated node scheduledDate:', updatedNode.scheduledDate);
    console.log('Updated node scheduledDate ISO:', updatedNode.scheduledDate?.toISOString());
    
    if (viewMode === 'nodes' && planningPanelRef.current?.handleSaveNode) {
      // Use PlanningPanel's save function in nodes mode
      console.log('Using PlanningPanel handleSaveNode');
      await planningPanelRef.current.handleSaveNode(updatedNode);
      return;
    }

    // Direct save in canvas mode
    console.log('Using direct save in canvas mode');
    console.log('Canvas mode: handleSaveNode called with:', updatedNode);
    
    // Update nodes state immediately - use debugSetNodes to sync with PlanningPanel
    debugSetNodes(prevNodes => {
      const updated = prevNodes.map(node => 
        node.id === updatedNode.id ? updatedNode : node
      );
      console.log('Canvas mode: Updated nodes state with new scheduledDate:', updated.find(n => n.id === updatedNode.id)?.scheduledDate);
      return updated;
    });
    
    // Also update selectedNode directly if it's the same node
    if (selectedNode && selectedNode.id === updatedNode.id) {
      setSelectedNode(updatedNode);
    }
    
    // Persist to backend in canvas mode as well
    try {
      const { NodeAPI } = await import('@/services/nodeService');
      let imageUrlToStore = updatedNode.selectedImageUrl || updatedNode.imageUrl;
      if (!imageUrlToStore && updatedNode.imageUrls && updatedNode.imageUrls.length > 0) {
        imageUrlToStore = updatedNode.imageUrls[updatedNode.imageUrls.length - 1];
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
        postType: updatedNode.postType,
        selectedImageUrl: updatedNode.selectedImageUrl || imageUrlToStore,
        ...(updatedNode.scheduledDate ? { scheduledDate: updatedNode.scheduledDate.toISOString() } : {}),
      };

      console.log('Canvas mode: Persisting to backend with:', updateData);
      await NodeAPI.update(updateData);
      console.log('Canvas mode: Node updated successfully');
    } catch (err) {
      console.error('Canvas mode: Failed to persist node:', err);
    }
  };

  // Shared post function that works in both modes
  const handlePostNode = (node: ContentNode) => {
    if (viewMode === 'nodes' && planningPanelRef.current?.handlePostNode) {
      planningPanelRef.current.handlePostNode(node);
    } else {
      // Handle posting in canvas mode
      if (node.status === 'published') {
        // Persist only when truly publishing
        const updatedNode = {
          ...node,
          postedAt: new Date(),
          postedTo: [...(node.postedTo || [])]
        };
        handleSaveNode(updatedNode);
      } else {
        // For scheduling or other non-published statuses, update local state only
        debugSetNodes(prev => prev.map(n => (n.id === node.id ? { ...n, ...node } : n)));
        if (selectedNode && selectedNode.id === node.id) {
          setSelectedNode({ ...selectedNode, ...node });
        }
      }
    }
  };

  const handleCanvasClick = () => {
    // Remove canvas switching on background click
    // Canvas mode only accessible via node selection or manual toggle
  };

  type SelectedCanvasComponent = {
    id: string;
    name: string;
    category: string;
    color: string;
    position: { x: number; y: number };
  };

  // Local CampaignComponent type to align with CircleCanvas / ComponentSidebar expectations
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

  // Demo fallback components (kept small here, identical structure to previous hardcoded demos)
  const DEMO_COMPONENTS = [
    { id: 'demo-2', type: 'online_trend', title: 'Social Media Buzz', description: 'Latest social media trends and engagement', relevanceScore: 92, category: 'Online trend data', keywords: ['social','engagement','viral'], impact: 'high', color: '#0EA5E9' },
    { id: 'demo-1', type: 'promotion_type', title: 'Buy 1 Get 1', description: 'Classic BOGO promotion for limited time', relevanceScore: 85, category: 'Promotion Type', keywords: ['bogo','buy one get one','promotion'], impact: 'high', color: '#D97706' },
    { id: 'demo-3', type: 'campaign_type', title: 'Seasonal Campaign', description: 'Autumn-themed promotional campaign', relevanceScore: 78, category: 'Campaign Type', keywords: ['autumn','seasonal','promotion'], impact: 'medium', color: '#FB7185' },
  ];

  // Small set of promotion fallbacks to show if AI returns no promotion_type items
  const PROMOTION_DEMOS = [
    { id: 'promo-demo-1', type: 'promotion_type', title: 'Buy 1 Get 1', description: 'BOGO — buy one get one free for same item', relevanceScore: 88, category: 'Promotion Type', keywords: ['bogo','buy one get one'], impact: 'high', color: '#06B6D4' },
    { id: 'promo-demo-2', type: 'promotion_type', title: '20% Off', description: 'Flat 20% off the entire purchase', relevanceScore: 82, category: 'Promotion Type', keywords: ['20% off','discount'], impact: 'medium', color: '#F59E0B' },
    { id: 'promo-demo-3', type: 'promotion_type', title: '50% Off Second Item', description: 'Buy one, get 50% off the second item', relevanceScore: 86, category: 'Promotion Type', keywords: ['50% off','second item','discount'], impact: 'high', color: '#10B981' },
  ];

  // Fetch AI components for selected node
  useEffect(() => {
    let canceled = false;
    const load = async () => {
      if (!selectedNode) {
        prevNodeIdRef.current = null;
        return setAiComponents(null);
      }
      // If the selected node id hasn't changed and we already have components, keep them
      if (selectedNode && prevNodeIdRef.current === selectedNode.id && aiComponents !== null) {
        // nothing to do — components already present for this node
        return;
      }
      setAiLoading(true);
      try {
        const svc = await import('@/services/aiService');
        // Clear cache for this node only if the node id changed
        try {
          if (prevNodeIdRef.current !== selectedNode.id) {
            svc.clearComponentCache(selectedNode.id);
          }
        } catch (e) { console.debug('[MainLayout] clearComponentCache failed', e); }
        const comps = await svc.fetchComponentsForNode(selectedNode);
        console.log('[MainLayout] fetched aiComponents count for node', selectedNode.id, comps?.length ?? 0);
        if (!canceled) setAiComponents(comps && comps.length ? comps : []);
      } catch (err) {
        console.warn('Failed to load AI components', err);
        if (!canceled) setAiComponents([]);
      } finally {
        if (!canceled) setAiLoading(false);
      }
    };
    load();
    prevNodeIdRef.current = selectedNode ? selectedNode.id : null;
    return () => { canceled = true; };
  }, [selectedNode, aiComponents]);

  // Map AI components (or demo fallback) to the CampaignComponent shape expected by CircleCanvas and ComponentSidebar
  // Use DEMO_COMPONENTS only when aiComponents is null (not yet loaded). If aiComponents is an empty array
  // we respect that the AI returned no suggestions.
  const sourceComponents = aiComponents !== null ? aiComponents : DEMO_COMPONENTS;
  const activeGeneratedComponents = (sourceComponents).map((c: GeneratedComponent | typeof DEMO_COMPONENTS[number]) => ({
    id: c.id,
  type: (c.type === 'online_trend' || c.type === 'campaign_type' || c.type === 'promotion_type') ? c.type : 'campaign_type',
    title: c.title ?? c.id,
    description: c.description ?? '',
    relevanceScore: c.relevanceScore ?? 50,
    category: c.category ?? 'Suggested',
    keywords: c.keywords ?? [],
    impact: (c.impact as 'low' | 'medium' | 'high') ?? 'medium'
  }));

  // If there are no promotion_type items returned by AI, include the PROMOTION_DEMOS so UI shows promotions
  const hasPromotion = activeGeneratedComponents.some(c => c.type === 'promotion_type')
  const finalGeneratedComponents = hasPromotion ? activeGeneratedComponents : [...activeGeneratedComponents, ...PROMOTION_DEMOS]

    // Don't show demo components in the canvas while AI is actively loading. When ai is loading,
    // pass an empty array so the canvas shows a neutral state while the sidebar shows its loader.
  const canvasComponents = aiLoading ? [] : finalGeneratedComponents;

  const handleCalendarPage = () => {
    navigate('/calendar');
  };

  const handleLogout = () => {
    try {
      // Clear persisted chat and planner nodes for this user on logout
      const userId = window.localStorage.getItem('userId') || 'guest';
      window.localStorage.removeItem(`bp_chat_${userId}`);
      window.localStorage.removeItem(`bp_planner_${userId}`);
      window.localStorage.removeItem('auth_tokens');
    } catch {}
    navigate('/');
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
            {/* View Toggle Button */}
            <div className="flex items-center bg-card border border-border/30 rounded-lg p-1 glow-hover">
              <button
                onClick={() => {
                  setViewMode('nodes');
                  if (canvasNodeId) {
                    setCanvasNodeId(null); // Clear canvas node when switching to nodes mode
                  }
                }}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'nodes'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Nodes
              </button>
              <button
                onClick={() => {
                  setViewMode('canvas');
                  setCanvasNodeId(null); // Clear canvas node ID when manually switching
                }}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'canvas'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Canvas
              </button>
            </div>
            

            <Button 
              size="sm" 
              className="bg-gradient-primary hover:opacity-90 glow-hover"
              onClick={() => setIsTemplatePopupOpen(true)}
            >
              <FileText className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button 
              size="sm" 
              className="bg-gradient-primary hover:opacity-90 glow-hover"
              onClick={handleCalendarPage}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </Button>

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
        {/* Left Sidebar with Tabs - Main Area (always 30% width) */}
        <div className="w-[30%] transition-all duration-500 ease-in-out opacity-100">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b border-border/20 px-6 pt-4 pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai" className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4" />
                  AI Generator
                </TabsTrigger>
                <TabsTrigger value="details" className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4" />
                  {selectedNode ? (selectedNode.title.length > 12 ? selectedNode.title.slice(0, 12) + '...' : selectedNode.title) : 'Details'}
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTab === 'ai' && (
                <div className="h-full">
                  <AIChat setPlanningNodes={debugSetNodes} />
                </div>
              )}
              {activeTab === 'details' && (
                <div className="h-full">
                  <NodeDetails 
                    node={selectedNode}
                    nodes={nodes}
                    onSaveNode={handleSaveNode}
                    onPostNode={handlePostNode}
                  />
                </div>
              )}
            </div>
          </Tabs>
        </div>

        {/* Right Side - Planning Panel in nodes mode, empty in canvas mode */}
        <div className="w-[70%] h-[calc(100vh-80px)] transition-all duration-500 ease-in-out">
          {viewMode === 'nodes' ? (
            <div className="h-full bg-card border-l border-border/50 backdrop-blur-xl">
              <PlanningPanel 
                nodes={nodes} 
                setNodes={debugSetNodes} 
                onNodeSelect={handleNodeSelect}
                onNodeDoubleClick={handleNodeDoubleClick}
                onCanvasClick={handleCanvasClick}
                ref={planningPanelRef}
              />
            </div>
          ) : (
            <div className="h-full bg-gradient-subtle relative">
              <CircleCanvas 
                selectedComponents={selectedCanvasComponents}
                isGenerating={isGenerating}
                selectedNode={selectedNode}
                onSaveNode={handleSaveNode}
                onGenerate={(status) => {
                  console.log('Generate status:', status);
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
                    color: component.color ?? '#0EA5E9',
                    position: { x: Math.random() * 300 + 50, y: Math.random() * 200 + 50 },
                  };
                  setSelectedCanvasComponents(prev => [...prev, newComponent]);
                }}
              />
              <ComponentSidebar 
                components={canvasComponents as unknown as CampaignComponentLocal[]}
                onAddComponent={(component) => {
                  const newComponent: SelectedCanvasComponent = {
                    id: component.id,
                    name: component.title,
                    category: component.category,
                    color: component.color ?? '#0EA5E9',
                    position: { x: Math.random() * 300 + 50, y: Math.random() * 200 + 50 },
                  };
                  setSelectedCanvasComponents(prev => [...prev, newComponent]);
                }}
                onClear={() => setSelectedCanvasComponents([])}
              />
            </div>
          )}
        </div>
      </div>

      {/* Template Popup */}
      {isTemplatePopupOpen && (
        <TemplatePopup onClose={() => setIsTemplatePopupOpen(false)} />
      )}
    </div>
  );
};
