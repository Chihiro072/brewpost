import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import PlannerSidebar from '@/components/planning/PlannerSidebar';
import type { GeneratedComponent } from '@/services/aiService';
import {
  Sparkles,
  Calendar,
  Plus,
  LogOut,
  User,
  Settings,
  X,
  Clock,
  Save,
  Image as ImageIcon,
  FileText,
  Layers,
} from 'lucide-react';
import type { ContentNode } from '@/components/planning/PlanningPanel';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import { usersAPI } from '@/services/apiService';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { plannerService } from '@/services/plannerService';

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

export const RedesignedMainLayout: React.FC<RedesignedMainLayoutProps> = ({
  children,
}) => {
  const navigate = useNavigate();
  const { plan } = useSubscription();
  const { t } = useLanguage();
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<ContentNode | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  // Sidebar states
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<
    'content' | 'image' | 'analysis'
  >('content');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScheduleConfirmation, setShowScheduleConfirmation] =
    useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [isTemplatePopupOpen, setIsTemplatePopupOpen] = useState(false);

  // Canvas states
  const [selectedCanvasComponents, setSelectedCanvasComponents] = useState<
    SelectedCanvasComponent[]
  >([]);
  const [aiComponents, setAiComponents] = useState<GeneratedComponent[] | null>(
    null
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState<boolean | string>(false);

  // Selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  const prevNodeIdRef = useRef<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('Guest');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const profile = await usersAPI.getProfile();
        const name =
          (
            (profile.firstName || '').trim() +
            ' ' +
            (profile.lastName || '').trim()
          ).trim() ||
          profile.displayName ||
          profile.username ||
          profile.email ||
          'Guest';
        if (isMounted) setDisplayName(name);
      } catch (err) {
        // Fallback to previous localStorage/JWT logic on error
        try {
          const storedName =
            typeof window !== 'undefined'
              ? window.localStorage.getItem('userName')
              : null;
          if (storedName) {
            if (isMounted) setDisplayName(storedName);
            return;
          }
          let name =
            (typeof window !== 'undefined'
              ? window.localStorage.getItem('userId')
              : null) || 'Guest';
          const authTokens =
            typeof window !== 'undefined'
              ? window.localStorage.getItem('auth_tokens')
              : null;
          if (authTokens) {
            try {
              const toks = JSON.parse(authTokens);
              const idToken = toks?.id_token;
              if (idToken && typeof idToken === 'string') {
                const parts = idToken.split('.');
                if (parts.length >= 2) {
                  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                  const json = decodeURIComponent(
                    atob(b64)
                      .split('')
                      .map(
                        (c) =>
                          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                      )
                      .join('')
                  );
                  const payload = JSON.parse(json);
                  name =
                    payload?.name ||
                    payload?.email ||
                    payload?.preferred_username ||
                    name;
                }
              }
            } catch {}
          }
          if (isMounted) setDisplayName(name);
        } catch {}
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Demo fallback components
  const DEMO_COMPONENTS = [
    {
      id: 'demo-2',
      type: 'online_trend',
      title: 'Social Media Buzz',
      description: 'Latest social media trends and engagement',
      relevanceScore: 92,
      category: 'Online trend data',
      keywords: ['social', 'engagement', 'viral'],
      impact: 'high',
      color: '#0EA5E9',
    },
    {
      id: 'demo-1',
      type: 'promotion_type',
      title: 'Buy 1 Get 1',
      description: 'Classic BOGO promotion for limited time',
      relevanceScore: 85,
      category: 'Promotion Type',
      keywords: ['bogo', 'buy one get one', 'promotion'],
      impact: 'high',
      color: '#D97706',
    },
    {
      id: 'demo-3',
      type: 'campaign_type',
      title: 'Seasonal Campaign',
      description: 'Autumn-themed promotional campaign',
      relevanceScore: 78,
      category: 'Campaign Type',
      keywords: ['autumn', 'seasonal', 'promotion'],
      impact: 'medium',
      color: '#FB7185',
    },
  ];

  const PROMOTION_DEMOS = [
    {
      id: 'promo-demo-1',
      type: 'promotion_type',
      title: 'Buy 1 Get 1',
      description: 'BOGO — buy one get one free for same item',
      relevanceScore: 88,
      category: 'Promotion Type',
      keywords: ['bogo', 'buy one get one'],
      impact: 'high',
      color: '#06B6D4',
    },
    {
      id: 'promo-demo-2',
      type: 'promotion_type',
      title: '20% Off',
      description: 'Flat 20% off the entire purchase',
      relevanceScore: 82,
      category: 'Promotion Type',
      keywords: ['20% off', 'discount'],
      impact: 'medium',
      color: '#F59E0B',
    },
    {
      id: 'promo-demo-3',
      type: 'promotion_type',
      title: '50% Off Second Item',
      description: 'Buy one, get 50% off the second item',
      relevanceScore: 86,
      category: 'Promotion Type',
      keywords: ['50% off', 'second item', 'discount'],
      impact: 'high',
      color: '#10B981',
    },
  ];

  // Resolve per-user storage key for planner nodes
  const getPlannerStorageKey = (): string => {
    try {
      const userId = window.localStorage.getItem('userId');
      return `bp_planner_${userId || 'guest'}`;
    } catch {
      return 'bp_planner_guest';
    }
  };

  // Load nodes with localStorage fallback, then merge fresh AppSync data
  useEffect(() => {
    const loadNodes = async () => {
      // First: localStorage for fast refresh persistence
      try {
        const key = getPlannerStorageKey();
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as any[];
          const revived = parsed.map((n) => ({
            ...n,
            scheduledDate: n.scheduledDate
              ? new Date(n.scheduledDate)
              : undefined,
            postedAt: n.postedAt ? new Date(n.postedAt) : undefined,
          }));
          setNodes(revived);
        }
      } catch (e) {
        console.warn('Planner: failed to load local nodes, continuing:', e);
      }

      // Then: fetch latest from AppSync and merge over local
      try {
        const { NodeAPI } = await import('@/services/nodeService');
        const apiNodes = await NodeAPI.list('demo-project-123');

        const detectPostType = (
          title: string,
          content: string
        ): 'engaging' | 'promotional' | 'branding' => {
          const text = `${title} ${content}`.toLowerCase();
          if (
            text.match(
              /\b(shop|order|buy|get yours|discount|available now|limited|offer|sale|use code|sign up|join|link in bio|free shipping|diy|recipe|create|make|try|get|start)\b/
            )
          ) {
            return 'promotional';
          }
          if (
            text.match(
              /\b(crafted|behind the scenes|heritage|tradition|quality|meet|farmer|team|values|trust|story of|our process|secret|day in the life|art of|history|unveiling|science|grading|special)\b/
            )
          ) {
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

        const normalizeStatus = (
          s: unknown
        ): 'draft' | 'scheduled' | 'published' => {
          if (!s) return 'draft';
          const v = String(s).toLowerCase();
          if (v === 'published') return 'published';
          if (v === 'scheduled') return 'scheduled';
          return 'draft';
        };

        const transformedNodes = apiNodes.map((x) => {
          let imageUrls: string[] | undefined = undefined;
          if (
            x.imageUrls &&
            Array.isArray(x.imageUrls) &&
            x.imageUrls.length > 0
          ) {
            imageUrls = x.imageUrls;
          } else if (x.imageUrl) {
            imageUrls = [x.imageUrl];
          }

          return {
            id: x.nodeId,
            title: x.title,
            type: normalizeType(x.type),
            status: normalizeStatus(x.status),
            scheduledDate: x.scheduledDate
              ? new Date(x.scheduledDate)
              : undefined,
            content: x.description ?? '',
            imageUrl: x.imageUrl ?? undefined,
            imageUrls: imageUrls,
            imagePrompt: x.imagePrompt ?? undefined,
            day: x.day ?? undefined,
            postType: detectPostType(x.title, x.description ?? ''),
            connections: Array.isArray((x as any).connections)
              ? (x as any).connections
              : [],
            position: { x: x.x ?? 0, y: x.y ?? 0 },
            postedAt: x.createdAt ? new Date(x.createdAt) : undefined,
            selectedImageUrl: (x as any).selectedImageUrl ?? undefined,
          };
        });

        // Load edges and populate connections
        try {
          const { NodeAPI: EdgeAPI } = await import('@/services/nodeService');
          const edges = await EdgeAPI.listEdges('demo-project-123');

          const nodesWithConnections = transformedNodes.map((node) => ({
            ...node,
            connections: Array.from(
              new Set([
                ...(Array.isArray(node.connections) ? node.connections : []),
                ...edges
                  .filter((edge) => edge.from === node.id)
                  .map((edge) => edge.to),
              ])
            ),
          }));

          // Merge server data over any local nodes to preserve recent local changes
          setNodes((prev) => {
            const byId = new Map(prev.map((p) => [p.id, p]));
            const merged = nodesWithConnections.map((s) => {
              const local = byId.get(s.id);
              if (!local) return s;
              return {
                ...s,
                position: local.position || s.position,
                status: local.status || s.status,
                scheduledDate: local.scheduledDate ?? s.scheduledDate,
                content: local.content ?? s.content,
              };
            });
            return merged;
          });
        } catch (edgeError) {
          console.warn('Failed to load edges:', edgeError);
          setNodes(transformedNodes);
        }
      } catch (error) {
        console.warn(
          'Failed to load from AppSync, starting with local only:',
          error
        );
        setNodes((prev) => (Array.isArray(prev) ? prev : []));
      }
    };
    loadNodes();
  }, []);

  // Persist nodes to localStorage whenever they change
  useEffect(() => {
    try {
      const key = getPlannerStorageKey();
      const toSave = nodes.map((n) => ({
        ...n,
        scheduledDate: n.scheduledDate
          ? n.scheduledDate.toISOString()
          : undefined,
        postedAt: n.postedAt ? n.postedAt.toISOString() : undefined,
      }));
      window.localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Planner: failed to persist nodes:', e);
    }
  }, [nodes]);

  // Handle node saving
  const handleSaveNode = async (updatedNode: ContentNode) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => (node.id === updatedNode.id ? updatedNode : node))
    );

    if (selectedNode && selectedNode.id === updatedNode.id) {
      setSelectedNode(updatedNode);
    }

    try {
      const { NodeAPI } = await import('@/services/nodeService');
      const { assetsAPI } = await import('@/services/apiService');

      // Handle multiple images - prefer selectedImageUrl, then imageUrl, then latest from imageUrls
      let imageUrlToStore =
        updatedNode.selectedImageUrl || updatedNode.imageUrl;
      if (
        !imageUrlToStore &&
        updatedNode.imageUrls &&
        updatedNode.imageUrls.length > 0
      ) {
        imageUrlToStore =
          updatedNode.imageUrls[updatedNode.imageUrls.length - 1];
        console.log(
          'handleSaveNode: storing latest image from imageUrls:',
          updatedNode.imageUrls.length
        );
      }

      // If the image is a data URL, upload it to assets and use the returned URL
      const needsUpload =
        imageUrlToStore && imageUrlToStore.startsWith('data:');
      if (needsUpload) {
        try {
          console.log('[handleSaveNode] Uploading data URL to assets');
          const dataUrl = imageUrlToStore as string;
          const [header, base64] = dataUrl.split(',');
          const mimeMatch = header.match(/data:(.*?);base64/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: mimeType });
          const filename = `node-${updatedNode.id}-${Date.now()}.png`;
          const file = new File([blob], filename, { type: mimeType });
          const asset = await assetsAPI.uploadAsset(file);
          if (asset?.filePath || asset?.fileUrl) {
            const storedUrl = (asset.fileUrl || asset.filePath) as string;
            imageUrlToStore = storedUrl;
            // Replace the last image in imageUrls with the stored URL, or append
            const imgs = Array.isArray(updatedNode.imageUrls)
              ? [...updatedNode.imageUrls]
              : [];
            if (imgs.length) {
              imgs[imgs.length - 1] = storedUrl;
            } else {
              imgs.push(storedUrl);
            }
            updatedNode = {
              ...updatedNode,
              imageUrl: storedUrl,
              selectedImageUrl: storedUrl,
              imageUrls: imgs,
            };
          }
        } catch (e) {
          console.warn(
            '[handleSaveNode] Failed to upload data URL, proceeding with original',
            e
          );
        }
      }

      // Determine if the node ID is a proper GUID; if not, create it first
      const isGuid = /^[0-9a-fA-F-]{36}$/.test(updatedNode.id);
      if (!isGuid) {
        console.warn(
          '[handleSaveNode] Detected temporary ID, creating node before update:',
          updatedNode.id
        );
        const createData = {
          projectId: 'demo-project-123',
          title: updatedNode.title,
          description: updatedNode.content,
          status: updatedNode.status,
          type: updatedNode.type,
          x: updatedNode.position?.x || 0,
          y: updatedNode.position?.y || 0,
          imageUrl: imageUrlToStore,
          imageUrls: updatedNode.imageUrls || null,
          imagePrompt: updatedNode.imagePrompt,
          postType: updatedNode.postType,
          selectedImageUrl: updatedNode.selectedImageUrl || imageUrlToStore,
          ...(updatedNode.scheduledDate
            ? { scheduledDate: updatedNode.scheduledDate.toISOString() }
            : {}),
        };
        console.log('[handleSaveNode] Creating node with payload:', createData);
        const created = await NodeAPI.create(createData as any);
        if (created) {
          console.log(
            '[handleSaveNode] Node created. Replacing temporary ID with GUID:',
            created.id
          );
          setNodes((prev) =>
            prev.map((n) =>
              n.id === updatedNode.id ? { ...updatedNode, ...created } : n
            )
          );
          if (selectedNode && selectedNode.id === updatedNode.id) {
            setSelectedNode({ ...updatedNode, ...created });
          }
        }
        return; // Creation already persisted the current data
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
        connections: updatedNode.connections || [],
        ...(updatedNode.scheduledDate
          ? { scheduledDate: updatedNode.scheduledDate.toISOString() }
          : {}),
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
        postedTo: [...(node.postedTo || [])],
      };
      handleSaveNode(updatedNode);
    } else {
      setNodes((prev) =>
        prev.map((n) => (n.id === node.id ? { ...n, ...node } : n))
      );
      if (selectedNode && selectedNode.id === node.id) {
        setSelectedNode({ ...selectedNode, ...node });
      }
    }
  };

  // Persist connections immediately when user connects/disconnects nodes on canvas
  const createOrDeleteEdge = async (from: string, to: string) => {
    try {
      const isGuid = (id: string) => /^[0-9a-fA-F-]{36}$/.test(id);
      if (!isGuid(from) || !isGuid(to)) {
        console.warn(
          '[createOrDeleteEdge] Skipping persistence for temporary IDs:',
          { from, to }
        );
        // Optimistically update UI only
        setNodes((prev) =>
          prev.map((node) => {
            if (node.id === from) {
              const exists = node.connections.includes(to);
              const connections = exists
                ? node.connections.filter((id) => id !== to)
                : [...node.connections, to];
              return { ...node, connections };
            }
            return node;
          })
        );
        return;
      }

      const fromNode = nodes.find((n) => n.id === from);
      const exists = fromNode?.connections.includes(to);

      // Optimistic UI update
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id === from) {
            const connections = exists
              ? node.connections.filter((id) => id !== to)
              : [...(node.connections || []), to];
            return { ...node, connections };
          }
          return node;
        })
      );

      const { NodeAPI } = await import('@/services/nodeService');
      if (exists) {
        await NodeAPI.deleteEdge('demo-project-123', `${from}->${to}`);
        console.log('[createOrDeleteEdge] Edge deleted:', `${from}->${to}`);
      } else {
        await NodeAPI.createEdge('demo-project-123', from, to);
        console.log('[createOrDeleteEdge] Edge created:', `${from}->${to}`);
      }
    } catch (error) {
      console.error('[createOrDeleteEdge] Failed to toggle edge:', error);
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
        y: Math.random() * 200 + 50,
      },
      scheduledDate: nodeData.scheduledDate,
      imageUrl: nodeData.imageUrl,
      imageUrls: nodeData.imageUrls || [],
      imagePrompt: nodeData.imagePrompt,
      postType: nodeData.postType || 'engaging',
      selectedImageUrl: nodeData.selectedImageUrl || nodeData.imageUrl,
    };

    // Add node to state first for immediate UI feedback
    setNodes((prev) => [...prev, newNode]);

    try {
      const { NodeAPI } = await import('@/services/nodeService');

      // Handle multiple images for new node - prefer selectedImageUrl
      let imageUrlToStore = newNode.selectedImageUrl || newNode.imageUrl;
      if (
        !imageUrlToStore &&
        newNode.imageUrls &&
        newNode.imageUrls.length > 0
      ) {
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
        postType: newNode.postType,
        selectedImageUrl: newNode.selectedImageUrl || imageUrlToStore,
        ...(newNode.scheduledDate
          ? { scheduledDate: newNode.scheduledDate.toISOString() }
          : {}),
      };

      console.log('Creating node with data:', createRequest);
      const createdNode = await NodeAPI.create(createRequest);
      console.log('Node created successfully:', createdNode);

      // Update the node with any data returned from the server
      if (createdNode) {
        setNodes((prev) =>
          prev.map((node) =>
            node.id === newNode.id ? { ...node, ...createdNode } : node
          )
        );
      }
    } catch (error) {
      console.error('Failed to create node:', error);
      // Keep optimistic node so you can still see it and edit/move it
      // Mark it as draft and unsynced; user can retry later from UI
      setNodes((prev) =>
        prev.map((node) =>
          node.id === newNode.id ? { ...node, status: 'draft' } : node
        )
      );
      alert(
        'Network error creating node. The node is kept locally; you can continue editing and retry later.'
      );
    }

    setShowAddModal(false);
  };

  // Handle schedule all
  const handleScheduleAll = () => {
    setShowScheduleConfirmation(true);
  };

  // Handle confirm schedule
  const handleConfirmSchedule = async (scheduledNodes?: ContentNode[]) => {
    try {
      const { scheduleService } = await import('@/services/scheduleService');
      const nodesToSchedule =
        scheduledNodes ||
        nodes.filter((n) => n.scheduledDate && n.status !== 'published');

      // Convert ContentNode[] to Partial<NodeDTO>[] format expected by scheduleService
      const dtoNodes = nodesToSchedule.map((n) => ({
        id: n.id,
        title: n.title,
        description: n.content,
        scheduledDate: n.scheduledDate?.toISOString(),
        status: n.status,
        type: n.type,
      }));

      const result = await scheduleService.createSchedules(dtoNodes);
      // Notify user of result
      try {
        const { toast } = await import('@/hooks/use-toast');
        const count = Array.isArray(result)
          ? result.length
          : typeof result === 'number'
          ? result
          : undefined;
        if (count && count > 0) {
          toast({
            title: 'Scheduled',
            description: `Scheduled ${count} nodes`,
          });
        } else {
          toast({
            title: 'Scheduled',
            description: 'Scheduled nodes successfully',
          });
        }
      } catch (e) {
        // ignore toast errors
      }

      // Update nodes status to scheduled
      setNodes((prev) =>
        prev.map((node) => {
          const scheduledNode = nodesToSchedule?.find(
            (sn) => sn.id === node.id
          );
          return scheduledNode
            ? { ...node, status: 'scheduled' as const }
            : node;
        })
      );

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

      if (
        selectedNode &&
        prevNodeIdRef.current === selectedNode.id &&
        aiComponents !== null
      ) {
        return;
      }

      setAiLoading(true);
      setIsGenerating(
        `Generating AI components for "${selectedNode.title}"...`
      );

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
          `Finalizing promotional offers...`,
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
    return () => {
      canceled = true;
    };
  }, [selectedNode, aiComponents]);

  // Handle tab styling for active states
  useEffect(() => {
    const updateTabStyles = () => {
      const tabs = document.querySelectorAll('[data-active-style]');
      tabs.forEach((tab) => {
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
  const sourceComponents =
    aiComponents !== null ? aiComponents : DEMO_COMPONENTS;
  const activeGeneratedComponents = sourceComponents.map(
    (c: GeneratedComponent | (typeof DEMO_COMPONENTS)[number]) => ({
      id: c.id,
      type:
        c.type === 'online_trend' ||
        c.type === 'campaign_type' ||
        c.type === 'promotion_type'
          ? c.type
          : 'campaign_type',
      title: c.title ?? c.id,
      description: c.description ?? '',
      relevanceScore: c.relevanceScore ?? 50,
      category: c.category ?? 'Suggested',
      keywords: c.keywords ?? [],
      impact: (c.impact as 'low' | 'medium' | 'high') ?? 'medium',
    })
  );

  const hasPromotion = activeGeneratedComponents.some(
    (c) => c.type === 'promotion_type'
  );
  const finalGeneratedComponents = hasPromotion
    ? activeGeneratedComponents
    : [...activeGeneratedComponents, ...PROMOTION_DEMOS];
  const canvasComponents = aiLoading ? [] : finalGeneratedComponents;

  const handleLogout = () => {
    try {
      const userId = window.localStorage.getItem('userId') || 'guest';
      window.localStorage.removeItem(`bp_chat_${userId}`);
      window.localStorage.removeItem(`bp_planner_${userId}`);
      window.localStorage.removeItem('auth_tokens');
    } catch {}
    navigate('/');
  };

  const handleCalendarPage = () => {
    navigate('/calendar');
  };

  const queryClient = useQueryClient();
  const savePlannerMutation = useMutation({
    mutationKey: ['planner-save'],
    mutationFn: async ({ plannerData, setClean }: { plannerData: { title?: string; nodes: ContentNode[] }, setClean: () => void }) => {
      const title = plannerData.title ?? `Draft ${new Date().toLocaleDateString()}`;
      if (!currentPlanId) {
        const id = await plannerService.createFromNodes(title, plannerData.nodes);
        setCurrentPlanId(id);
        return id;
      } else {
        await plannerService.updatePlan(currentPlanId, title);
        return currentPlanId;
      }
    },
    onMutate: async (variables) => {
      const tempId = crypto && 'randomUUID' in crypto ? crypto.randomUUID() : `temp-${Date.now()}`;
      const title = variables?.plannerData?.title ?? `Draft ${new Date().toLocaleDateString()}`;
      const count = variables?.plannerData?.nodes?.length ?? 0;
      const previous = queryClient.getQueryData<any>(['planners']);
      queryClient.setQueryData(['planners'], (old: any) => {
        const existing = Array.isArray(old) ? old : [];
        return [
          { id: tempId, title, createdAt: new Date().toISOString(), postCount: count },
          ...existing,
        ];
      });
      return { previous, tempId };
    },
    onSuccess: (id, variables) => {
      const usedTitle = variables?.plannerData?.title ?? `Draft ${new Date().toLocaleDateString()}`;
      queryClient.setQueryData(['planners'], (old: any) => {
        const existing = Array.isArray(old) ? old : [];
        const replaced = existing.map((p: any, idx: number) => {
          if (idx === 0 && p.id && String(p.id).startsWith('temp-')) {
            return { id: String(id), title: usedTitle, createdAt: new Date().toISOString(), postCount: variables?.plannerData?.nodes?.length ?? 0 };
          }
          return p;
        });
        if (!replaced.find((p: any) => String(p.id) === String(id))) {
          return [{ id: String(id), title: usedTitle, createdAt: new Date().toISOString(), postCount: variables?.plannerData?.nodes?.length ?? 0 }, ...existing];
        }
        return replaced;
      });
      queryClient.invalidateQueries({ queryKey: ['planners'] });
      variables?.setClean?.();
      toast({ title: 'Draft saved' });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['planners'], context.previous);
      }
    },
  });

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl relative z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="BrewPost"
              className="w-10 h-10 dark:filter dark:invert dark:brightness-0 dark:saturate-0"
            />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                BrewPost
              </h1>
              <p className="text-xs text-muted-foreground">
                AI Content Generator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Account hover popup replacing direct logout button */}
            <HoverCard openDelay={50} closeDelay={100}>
              <HoverCardTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-destructive/20 hover:border-destructive/40 hover:bg-destructive/10 text-destructive"
                  aria-label="Profile"
                >
                  <User className="w-4 h-4" />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent className="w-64">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <User className="w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{displayName}</span>
                      {plan && (
                        <span className="text-[10px] text-emerald-400 mt-0.5 block">
                          {plan.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-border/40" />
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => navigate('/settings')}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                    <Button
                      variant="destructive"
                      className="justify-start"
                      onClick={handleLogout}
                    >
                      Logout
                    </Button>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-80px)] relative">
        {/* Left Sidebar - Details Popup */}
        {showLeftSidebar && (
          <div
            className="absolute left-4 top-4 bottom-4 w-96 backdrop-blur-xl rounded-2xl shadow-2xl z-40 transition-all duration-300 ease-in-out border border-[#03624C]/50"
            style={{ backgroundColor: 'rgba(3, 34, 33, 0.95)' }}
          >
            <div className="h-full flex flex-col rounded-2xl overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-2 border-b border-[#03624C]/50"
                style={{ borderBottomColor: 'rgba(3, 98, 76, 0.5)' }}
              >
                <h3 className="font-semibold text-base text-white">
                  {t('details.all')}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLeftSidebar(false)}
                  className="hover:text-[#2CC295] text-[#00DF81]/70"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      'rgba(3, 98, 76, 0.3)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
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
            backgroundColor: 'rgba(0, 15, 49, 0.05)',
          }}
        >
          <DraggableNodeCanvas
            nodes={nodes}
            onNodeUpdate={(updated) => {
              setNodes(updated);
              setIsDirty(true);
            }}
            onNodeClick={handleNodeDoubleClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            selectedNodeIds={selectedNodeIds}
            onSelectionChange={setSelectedNodeIds}
            createOrDeleteEdge={createOrDeleteEdge}
            onAddNode={() => {
              const newNode = {
                id: Date.now().toString(),
                title: 'New Post',
                type: 'post' as const,
                status: 'draft' as const,
                content: 'Enter your content here...',
                connections: [],
                position: {
                  x: Math.random() * 400 + 100,
                  y: Math.random() * 300 + 100,
                },
              };
              setNodes([...nodes, newNode]);
              setIsDirty(true);
            }}
            onDeleteNode={async (nodeId: string) => {
              // Optimistically remove the node and clean up connections in UI
              setNodes((prev) =>
                prev
                  .filter((node) => node.id !== nodeId)
                  .map((node) => ({
                    ...node,
                    connections: Array.isArray(node.connections)
                      ? node.connections.filter((id) => id !== nodeId)
                      : [],
                  }))
              );
              setIsDirty(true);

              // If this was the selected node, clear the selection
              if (selectedNode && selectedNode.id === nodeId) {
                setSelectedNode(null);
                setShowLeftSidebar(false);
              }

              try {
                const { NodeAPI } = await import('@/services/nodeService');

                // Persist: remove edges pointing to the deleted node
                const nodesWithConn = nodes.filter(
                  (n) =>
                    Array.isArray(n.connections) &&
                    n.connections.includes(nodeId)
                );
                await Promise.all(
                  nodesWithConn.map(async (n) => {
                    const isGuid =
                      /^[0-9a-fA-F-]{36}$/.test(n.id) &&
                      /^[0-9a-fA-F-]{36}$/.test(nodeId);
                    if (isGuid) {
                      const edgeId = `${n.id}->${nodeId}`;
                      await NodeAPI.deleteEdge('demo-project-123', edgeId);
                    }
                  })
                );

                // Finally, remove the node itself from database
                await NodeAPI.remove('demo-project-123', nodeId);
                console.log('Node deleted and connections cleaned up');
              } catch (error) {
                console.error(
                  'Failed to delete node or clean up connections:',
                  error
                );
              }
            }}
            onEditNode={undefined}
            onCanvasClick={undefined}
          />

          {/* Bottom Action Bar */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
          <div
            className="flex items-center gap-4 backdrop-blur-xl border border-[#03624C]/50 rounded-2xl px-6 py-3 shadow-2xl"
            style={{ backgroundColor: 'rgba(3, 34, 33, 0.95)' }}
          >
            <PlannerSidebar onLoadPlanner={(nodes) => { setNodes(nodes); setIsDirty(false); }} />
            <Button
              onClick={handleScheduleAll}
              className="text-white shadow-lg transition-colors hover:opacity-90"
              style={{ backgroundColor: '#03624C' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = '#2CC295')
              }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = '#03624C')
                }
                disabled={nodes.length === 0}
              >
                <Clock className="w-4 h-4 mr-2" />
                {t('actions.schedule_all')}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (currentPlanId && !isDirty) {
                    toast({ title: 'The planner has been saved.' });
                    return;
                  }
                  savePlannerMutation.mutate({
                    plannerData: { nodes },
                    setClean: () => setIsDirty(false),
                  });
                }}
                className="border-cyan-400 text-cyan-400 hover:bg-cyan-500/10"
                style={{ backgroundColor: 'transparent' }}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowCalendarModal(true)}
                className="border-[#03624C]/50 text-[#00DF81] transition-colors"
                style={{ backgroundColor: 'rgba(0, 15, 49, 0.5)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(3, 98, 76, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(44, 194, 149, 0.7)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(0, 15, 49, 0.5)';
                  e.currentTarget.style.borderColor = 'rgba(3, 98, 76, 0.5)';
                }}
              >
                <Calendar className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowAddModal(true)}
                className="border-[#03624C]/50 rounded-full w-10 h-10 p-0 text-[#00DF81] transition-colors"
                style={{ backgroundColor: 'rgba(0, 15, 49, 0.5)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(3, 98, 76, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(44, 194, 149, 0.7)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(0, 15, 49, 0.5)';
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
          <div
            className="absolute right-4 top-4 bottom-4 w-96 backdrop-blur-xl rounded-2xl shadow-2xl z-40 transition-all duration-300 ease-in-out border border-[#03624C]/50"
            style={{ backgroundColor: 'rgba(3, 34, 33, 0.95)' }}
          >
            <div className="h-full flex flex-col rounded-2xl overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-2 border-b border-[#03624C]/50"
                style={{ borderBottomColor: 'rgba(3, 98, 76, 0.5)' }}
              >
                <Tabs
                  value={activeRightTab}
                  onValueChange={(value) =>
                    setActiveRightTab(value as 'content' | 'image' | 'analysis')
                  }
                  className="flex-1"
                >
                  <div className="flex items-center justify-between">
                    <TabsList
                      className="grid w-full grid-cols-3 max-w-[300px] border border-[#03624C]/30"
                      style={{ backgroundColor: 'rgba(0, 15, 49, 0.5)' }}
                    >
                      <TabsTrigger
                        value="content"
                        className="text-sm text-[#00DF81]/70 data-[state=active]:text-white transition-colors"
                        style={{ '--tw-bg-opacity': '1' }}
                        onMouseEnter={(e) => {
                          if (
                            !e.currentTarget
                              .getAttribute('data-state')
                              ?.includes('active')
                          ) {
                            e.currentTarget.style.backgroundColor =
                              'rgba(3, 98, 76, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (
                            !e.currentTarget
                              .getAttribute('data-state')
                              ?.includes('active')
                          ) {
                            e.currentTarget.style.backgroundColor =
                              'transparent';
                          }
                        }}
                        data-active-style={{ backgroundColor: '#03624C' }}
                      >
                        {t('tabs.content')}
                      </TabsTrigger>
                      <TabsTrigger
                        value="image"
                        className="text-sm text-[#00DF81]/70 data-[state=active]:text-white transition-colors"
                        style={{ '--tw-bg-opacity': '1' }}
                        onMouseEnter={(e) => {
                          if (
                            !e.currentTarget
                              .getAttribute('data-state')
                              ?.includes('active')
                          ) {
                            e.currentTarget.style.backgroundColor =
                              'rgba(3, 98, 76, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (
                            !e.currentTarget
                              .getAttribute('data-state')
                              ?.includes('active')
                          ) {
                            e.currentTarget.style.backgroundColor =
                              'transparent';
                          }
                        }}
                        data-active-style={{ backgroundColor: '#03624C' }}
                      >
                        {t('tabs.image')}
                      </TabsTrigger>
                      <TabsTrigger
                        value="analysis"
                        className="text-sm text-[#00DF81]/70 data-[state=active]:text-white transition-colors"
                        style={{ '--tw-bg-opacity': '1' }}
                        onMouseEnter={(e) => {
                          if (
                            !e.currentTarget
                              .getAttribute('data-state')
                              ?.includes('active')
                          ) {
                            e.currentTarget.style.backgroundColor =
                              'rgba(3, 98, 76, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (
                            !e.currentTarget
                              .getAttribute('data-state')
                              ?.includes('active')
                          ) {
                            e.currentTarget.style.backgroundColor =
                              'transparent';
                          }
                        }}
                        data-active-style={{ backgroundColor: '#03624C' }}
                      >
                        {t('tabs.analysis')}
                      </TabsTrigger>
                    </TabsList>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRightSidebar(false)}
                      className="hover:text-[#2CC295] text-[#00DF81]/70 ml-2"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          'rgba(3, 98, 76, 0.3)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
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
                      <AIChat setPlanningNodes={(n) => { setNodes(n); setIsDirty(true); }} />
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
                            modal.className =
                              'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm';
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
                            position: { x: 0, y: 0 },
                          };
                          setSelectedCanvasComponents((prev) => {
                            if (prev.find((c) => c.id === component.id)) {
                              return prev;
                            }
                            return [...prev, newComponent];
                          });
                        }}
                        onRemoveComponent={(id) => {
                          setSelectedCanvasComponents((prev) =>
                            prev.filter((c) => c.id !== id)
                          );
                        }}
                        generatedComponents={
                          canvasComponents as unknown as CampaignComponentLocal[]
                        }
                      />

                      {/* Template Button */}
                      <div className="absolute top-4 right-4">
                        <Button
                          onClick={() => setIsTemplatePopupOpen(true)}
                          className="shadow-lg text-white transition-colors"
                          style={{ backgroundColor: '#03624C' }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = '#2CC295')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = '#03624C')
                          }
                          size="sm"
                        >
                          <Layers className="w-4 h-4 mr-2" />
                          {t('actions.template')}
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
                              position: { x: 0, y: 0 },
                            };
                            setSelectedCanvasComponents((prev) => {
                              if (prev.find((c) => c.id === component.id)) {
                                return prev;
                              }
                              return [...prev, newComponent];
                            });
                          }}
                          onRemoveFromCanvas={(id) => {
                            setSelectedCanvasComponents((prev) =>
                              prev.filter((c) => c.id !== id)
                            );
                          }}
                          generatedComponents={
                            finalGeneratedComponents as unknown as CampaignComponentLocal[]
                          }
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
              style={{ backgroundColor: '#03624C' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = '#2CC295')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = '#03624C')
              }
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
        nodes={nodes.filter(
          (node) =>
            node.scheduledDate && node.status !== 'published' && !node.postedAt
        )}
        onConfirm={handleConfirmSchedule}
      />

      <CalendarModal
        open={showCalendarModal}
        onOpenChange={setShowCalendarModal}
        scheduledNodes={nodes.filter((node) => node.status === 'scheduled')}
        editable={true}
        onEditNode={handleSaveNode}
        onDeleteNode={(nodeId) => {
          // Remove from nodes state immediately for instant UI update
          setNodes((prev) => prev.filter((node) => node.id !== nodeId));
        }}
      />

      <TemplatePopup
        isOpen={isTemplatePopupOpen}
        onClose={() => setIsTemplatePopupOpen(false)}
      />
    </div>
  );
};
