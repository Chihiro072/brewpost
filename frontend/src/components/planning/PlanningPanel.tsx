import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ContentModal } from '@/components/modals/ContentModal';
import { DraggableNodeCanvas } from '@/components/planning/DraggableNodeCanvas';
import { AddNodeModal } from '@/components/modals/AddNodeModal';
import { ScheduleConfirmationModal } from '@/components/modals/ScheduleConfirmationModal';
import { CalendarModal } from '@/components/modals/CalendarModal';
import { EditNodeModal } from '@/components/modals/EditNodeModal';
import { NodeAPI } from '@/services/nodeService';
import { scheduleService } from '@/services/scheduleService';
import { 
  Calendar, 
  Clock, 
  Eye, 
  Plus, 
  ArrowRight,
  Zap,
  Target,
  TrendingUp
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // optional, or use Date.now()
import { useLocation } from 'react-router-dom';

type PlannerNode = {
  day: string;
  title: string;
  caption: string;
  imagePrompt: string;
};

export type ContentNode = {
  id: string;
  title: string;
  type: 'post' | 'image' | 'story';
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: Date;
  content: string;
  imageUrl?: string;
  imageUrls?: string[];
  imagePrompt?: string;
  day?: string;
  postType?: 'engaging' | 'promotional' | 'branding';
  focus?: string;
  connections: string[];
  position: { x: number; y: number };
  postedAt?: Date;
  postedTo?: string[];
  tweetId?: string;
  selectedImageUrl?: string;
};

interface PlanningPanelProps {
  nodes: ContentNode[];
  setNodes: React.Dispatch<React.SetStateAction<ContentNode[]>>;
  onNodeSelect?: (node: ContentNode) => void;
  onNodeDoubleClick?: (node: ContentNode) => void;
  onCanvasClick?: () => void;
}

export interface PlanningPanelRef {
  handleEditNode: (node: ContentNode) => void;
  handleSaveNode: (node: ContentNode) => void;
  handlePostNode: (node: ContentNode) => void;
}

export const PlanningPanel = React.forwardRef<PlanningPanelRef, PlanningPanelProps>(({ nodes, setNodes, onNodeSelect, onNodeDoubleClick, onCanvasClick }, ref) => {
  const navigate = useNavigate();
  const projectId = 'demo-project-123'; // using a more realistic demo project ID
  const [edgesByKey, setEdgesByKey] = useState<Record<string,string>>({}); // "from->to" : edgeId
  const [selectedNode, setSelectedNode] = useState<ContentNode | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScheduleConfirmation, setShowScheduleConfirmation] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNode, setEditingNode] = useState<ContentNode | null>(null);
  const persistPositions = useRef<NodeJS.Timeout | null>(null);

  // Calculate node counts by status
  const getNodeCounts = () => {
    const posted = nodes.filter(node => node.postedAt && node.postedTo && node.postedTo.length > 0).length;
    const published = nodes.filter(node => node.status === 'published' && !(node.postedAt && node.postedTo && node.postedTo.length > 0)).length;
    const scheduled = nodes.filter(node => node.status === 'scheduled').length;
    const drafts = nodes.filter(node => node.status === 'draft').length;
    return { posted, published, scheduled, drafts };
  };

  const { posted, published, scheduled, drafts } = getNodeCounts();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeData = async () => {
      try {
        console.log('Initializing data for project:', projectId);
        
        // MainLayout now handles initial node loading, so PlanningPanel just loads edges
        console.log('PlanningPanel: Using nodes from MainLayout:', nodes.length);

        // Try to load edges (non-blocking)
        try {
          const edges = await NodeAPI.listEdges(projectId);
          console.log('Loaded edges:', edges);
          const edgesArray = Array.isArray(edges) ? edges : [];
          setNodes(curr => curr.map(nd => ({
            ...nd,
            connections: edgesArray.filter(e => e.from === nd.id).map(e => e.to),
          })));
          
          // Update edge map
          setEdgesByKey(Object.fromEntries(edgesArray.map(e => [`${e.from}->${e.to}`, e.edgeId])));
        } catch (edgeError) {
          console.warn('Failed to load edges (continuing without edges):', edgeError);
          // Continue without edges - nodes will still work
        }

        // Set up subscriptions (only if API calls work)
        try {
          unsubscribe = NodeAPI.subscribe(projectId, ({ type, payload }) => {
            console.log('Subscription event:', type, payload);
            setNodes(curr => {
              if (type === 'created') {
                const nd = payload;
                return [...curr, {
                  id: nd.nodeId, title: nd.title, type: 'post', status: nd.status ?? 'draft',
                  content: nd.description ?? '', imageUrl: undefined,
                  connections: [], position: { x: nd.x ?? 0, y: nd.y ?? 0 },
                }];
              }
              if (type === 'updated') {
                return curr.map(n => n.id === payload.nodeId
                  ? { ...n, title: payload.title, content: payload.description ?? '', status: payload.status ?? n.status,
                      position: { x: payload.x ?? n.position.x, y: payload.y ?? n.position.y } }
                  : n);
              }
              if (type === 'deleted') {
                console.log('Subscription received delete event for node:', payload.nodeId);
                // Only remove if the node actually exists (avoid double deletion from optimistic updates)
                return curr.filter(n => n.id !== payload.nodeId)
                           .map(n => ({ ...n, connections: n.connections.filter(c => c !== payload.nodeId) }));
              }
              if (type === 'edge') {
                // simple reconcile of connections
                const e = payload;
                return curr.map(n => n.id === e.from
                  ? { ...n, connections: Array.from(new Set([...n.connections.filter(x => x !== e.to), e.to])) }
                  : n);
              }
              return curr;
            });
          });
        } catch (subscriptionError) {
          console.warn('Failed to set up subscriptions:', subscriptionError);
        }
      } catch (error) {
        console.error('Failed to initialize planning panel:', error);
      }
    };

    initializeData();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [projectId]); // Only re-run if projectId changes

  const handleNodeClick = (node: ContentNode) => {
    // If onNodeSelect is provided, use it to switch to details tab
    if (onNodeSelect) {
      onNodeSelect(node);
    } else {
      // Fallback to modal for backward compatibility
      setSelectedNode(node);
      setShowModal(true);
    }
  };

  const handleNodeDoubleClick = (node: ContentNode) => {
    // If onNodeDoubleClick is provided, use it for canvas mode
    if (onNodeDoubleClick) {
      onNodeDoubleClick(node);
    } else {
      // Fallback to single click behavior
      handleNodeClick(node);
    }
  };

  const handleEditNode = (node: ContentNode) => {
    setEditingNode(node);
    setShowEditModal(true);
  };

  const handlePostNode = async (node: ContentNode) => {
    // Only persist to NodeAPI when actually publishing; for scheduling, update UI only
    if (node.status === 'published') {
      await handleSaveNode(node);
      return;
    }
    // For 'scheduled' or other non-published statuses, update local state only
    setNodes(prev => prev.map(n => (n.id === node.id ? { ...n, ...node } : n)));
  };

  // Expose methods through ref
  React.useImperativeHandle(ref, () => ({
    handleEditNode,
    handleSaveNode,
    handlePostNode
  }));

  const handleSaveNode = async (updatedNode: ContentNode) => {
    console.log('handleSaveNode called with:', updatedNode);
    console.log('Updated node scheduledDate:', updatedNode.scheduledDate);
    
    // Optimistic update - update UI immediately
    setNodes(prevNodes => {
      const updated = prevNodes.map(node => 
        node.id === updatedNode.id ? updatedNode : node
      );
      console.log('Updated nodes array:', updated.map(n => ({ id: n.id, scheduledDate: n.scheduledDate })));
      return updated;
    });
    
    try {
      const updateData = {
        projectId,
        nodeId: updatedNode.id,
        title: updatedNode.title,
        description: updatedNode.content,
        status: updatedNode.status,
        type: updatedNode.type,
        day: updatedNode.day,
        imageUrl: updatedNode.imageUrl,
        imageUrls: updatedNode.imageUrls,
        imagePrompt: updatedNode.imagePrompt,
        selectedImageUrl: updatedNode.selectedImageUrl,
        scheduledDate: updatedNode.scheduledDate?.toISOString(),
      };
      console.log('Sending update to NodeAPI:', updateData);
      
      await NodeAPI.update(updateData);
      console.log('Node updated successfully');
      
      // If the node was posted, also log the posting information
      if (updatedNode.postedAt && updatedNode.postedTo) {
        console.log('Content posted successfully:', {
          nodeId: updatedNode.id,
          postedAt: updatedNode.postedAt,
          postedTo: updatedNode.postedTo,
          tweetId: updatedNode.tweetId
        });
      }
    } catch (error) {
      console.error('Failed to update node:', error);
      // Could revert the optimistic update here if needed
    }
  };

  const handleNodeUpdate = (updated: ContentNode[]) => {
    // Update UI immediately for smooth dragging
    setNodes(updated);
    
    // Debounce AWS position updates with shorter delay
    if (persistPositions.current) clearTimeout(persistPositions.current);
    persistPositions.current = setTimeout(() => {
      // Save all node positions (no change detection)
      updated.forEach(n => {
        NodeAPI.update({ 
          projectId, 
          nodeId: n.id, 
          x: n.position.x, 
          y: n.position.y 
        }).catch(error => {
          // Silently handle position update errors during dragging
          console.warn(`Position update failed for node ${n.id}:`, error.message || 'Unknown error');
        });
      });
    }, 200); // Reduced debounce delay for more responsive saving
  };

  const handleAddNode = async (nodeData: Omit<ContentNode,'id'|'connections'>) => {
    // Optimistic update - add to UI immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticNode: ContentNode = {
      ...nodeData,
      id: tempId,
      connections: []
    };
    
    setNodes(prevNodes => [...prevNodes, optimisticNode]);
    
    try {
      const res = await NodeAPI.create({
        projectId,
        title: nodeData.title,
        description: nodeData.content,
        x: nodeData.position?.x ?? 0,
        y: nodeData.position?.y ?? 0,
        status: nodeData.status,
        type: nodeData.type,
        day: nodeData.day,
        imageUrl: nodeData.imageUrl,
        imageUrls: nodeData.imageUrls,
        imagePrompt: nodeData.imagePrompt,
        selectedImageUrl: nodeData.selectedImageUrl,
        scheduledDate: nodeData.scheduledDate?.toISOString(),
        contentId: undefined,
      });
      
      // Replace the optimistic node with the real one from AWS
      setNodes(prevNodes => 
        prevNodes.map(node => 
          node.id === tempId 
            ? {
                id: res.nodeId,
                title: res.title,
                type: (res.type as any) ?? 'post',
                status: (res.status as any) ?? 'draft',
                content: res.description ?? '',
                imageUrl: res.imageUrl ?? undefined,
                imageUrls: res.imageUrls ?? undefined,
                imagePrompt: res.imagePrompt ?? undefined,
                selectedImageUrl: res.selectedImageUrl ?? undefined,
                day: res.day ?? undefined,
                connections: [],
                position: { x: res.x ?? 0, y: res.y ?? 0 },
                scheduledDate: res.scheduledDate ? new Date(res.scheduledDate) : undefined
              }
            : node
        )
      );
      
      console.log('Node created successfully:', res);
    } catch (error) {
      console.error('Failed to create node:', error);
      // Remove the optimistic node if creation failed
      setNodes(prevNodes => prevNodes.filter(node => node.id !== tempId));
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    console.log('handleDeleteNode called with nodeId:', nodeId);
    
    // Optimistic update - remove from UI immediately
    const previousNodes = nodes;
    const optimisticNodes = nodes.filter(node => node.id !== nodeId);
    setNodes(optimisticNodes);
    console.log('Node removed from UI immediately, calling API...');
    
    try {
      await NodeAPI.remove(projectId, nodeId);
      console.log('Node deleted successfully from server');
      // Keep the optimistic update - ensure node stays deleted
      setNodes(currentNodes => currentNodes.filter(node => node.id !== nodeId));
    } catch (error) {
      console.error('Failed to delete node from server:', error);
      // Only revert if there was a real server error (not GraphQL response issues)
      if (error && typeof error === 'object' && 'networkError' in error) {
        console.warn('Network error - restoring node to UI');
        setNodes(previousNodes);
      } else {
        console.log('Node was likely deleted on server despite GraphQL response issues - keeping UI updated');
        // Ensure the node stays deleted even if GraphQL has issues
        setNodes(currentNodes => currentNodes.filter(node => node.id !== nodeId));
      }
    }
  };

  const createOrDeleteEdge = async (from: string, to: string) => {
    const key = `${from}->${to}`;
    const reverseKey = `${to}->${from}`;
    const existing = edgesByKey[key];
    const existingReverse = edgesByKey[reverseKey];
    
    // Check if connection already exists in either direction
    const fromNode = nodes.find(n => n.id === from);
    const connectionExists = fromNode?.connections.includes(to);
    
    if (existing || connectionExists) {
      // Remove existing connection
      const edgeIdToDelete = existing || existingReverse;
      
      // Optimistic removal
      setEdgesByKey(m => {
        const { [key]: _, [reverseKey]: __, ...rest } = m;
        return rest;
      });
      setNodes(prevNodes => prevNodes.map(node => 
        node.id === from 
          ? { ...node, connections: node.connections.filter(c => c !== to) }
          : node.id === to
          ? { ...node, connections: node.connections.filter(c => c !== from) }
          : node
      ));
      
      try {
        if (edgeIdToDelete && !edgeIdToDelete.startsWith('temp-')) {
          await NodeAPI.deleteEdge(projectId, edgeIdToDelete);
        }
        console.log('Edge deleted successfully');
      } catch (error) {
        console.error('Failed to delete edge:', error);
        // Revert optimistic update
        if (existing) setEdgesByKey(m => ({ ...m, [key]: existing }));
        if (existingReverse) setEdgesByKey(m => ({ ...m, [reverseKey]: existingReverse }));
        setNodes(prevNodes => prevNodes.map(node => 
          node.id === from 
            ? { ...node, connections: Array.from(new Set([...node.connections, to])) }
            : node.id === to
            ? { ...node, connections: Array.from(new Set([...node.connections, from])) }
            : node
        ));
      }
    } else {
      // Create new bidirectional connection
      const tempEdgeId = `temp-edge-${Date.now()}`;
      setEdgesByKey(m => ({ ...m, [key]: tempEdgeId }));
      setNodes(prevNodes => prevNodes.map(node => 
        node.id === from 
          ? { ...node, connections: Array.from(new Set([...node.connections, to])) }
          : node.id === to
          ? { ...node, connections: Array.from(new Set([...node.connections, from])) }
          : node
      ));
      
      try {
        const e = await NodeAPI.createEdge(projectId, from, to);
        setEdgesByKey(m => ({ ...m, [key]: e.edgeId }));
        console.log('Edge created successfully');
      } catch (error) {
        console.error('Failed to create edge:', error);
        // Revert optimistic update
        setEdgesByKey(m => { const { [key]: _, ...rest } = m; return rest; });
        setNodes(prevNodes => 
          prevNodes.map(node => 
            node.id === from 
              ? { ...node, connections: node.connections.filter(c => c !== to) }
              : node.id === to
              ? { ...node, connections: node.connections.filter(c => c !== from) }
              : node
          )
        );
      }
    }
  };

  // Ensure frontend has a usable backend URL at runtime
  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ?? 'http://localhost:5044';

  // Open the schedule confirmation modal
  const handleScheduleAll = () => {
    setShowScheduleConfirmation(true);
  };

  // Confirm scheduling: send to backend which writes to DynamoDB and notifies SNS (to create EventBridge one-shot schedules)
  const handleConfirmSchedule = async (freshNodes?: ContentNode[]) => {
    console.log('=== HANDLE CONFIRM SCHEDULE DEBUG ===');
    
    // Use fresh nodes from table 1 if provided, otherwise fallback to local state
    const nodesToSchedule = freshNodes || nodes;
    console.log('Using nodes from:', freshNodes ? 'table 1 (fresh)' : 'local state (fallback)');
    console.log('Nodes count:', nodesToSchedule.length);
    
    nodesToSchedule.forEach(n => {
      console.log(`Node: ${n.title}`);
      console.log(`  status: ${n.status}`);
      console.log(`  scheduledDate:`, n.scheduledDate);
      console.log(`  scheduledDate ISO:`, n.scheduledDate?.toISOString());
      console.log(`  postedAt:`, n.postedAt);
      console.log(`  will be included:`, !!(n.scheduledDate && n.status !== 'published' && !n.postedAt));
    });
    console.log('=== END HANDLE CONFIRM SCHEDULE DEBUG ===');
    
    // Use fresh data from table 1 to ensure we have the correct scheduled dates
    const payloadNodes = nodesToSchedule
      .filter(node => node.scheduledDate && node.status !== 'published' && !node.postedAt)
      .map((node) => {
        return {
          id: node.id,
          title: node.title,
          type: node.type || 'post',
          content: node.content || '',
          imageUrl: node.imageUrl || null,
          imageUrls: node.imageUrls || null,
          scheduledDate: node.scheduledDate?.toISOString(),
        };
      });

    // DEBUG: always log payload sent from client
    console.log('Scheduling payloadNodes (count):', payloadNodes.length, payloadNodes.slice(0, 3));

    try {
      const doPost = async (nodesToSend: any[]) => {
        try {
          // Get user ID from localStorage (set during authentication)
          const userId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') : null;
          
          // Prepare headers with user ID
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (userId) {
            headers['x-user-id'] = userId;
          }

          const result = await scheduleService.createSchedules(nodesToSend);
          return { ok: result.ok, status: result.ok ? 200 : 500, data: result };

        } catch (fetchErr) {
          console.error("Network/Fetch failed:", fetchErr);
          return { ok: false, status: 0, data: { error: "network_error", detail: String(fetchErr) } };
        }
      };

      const resObj = await doPost(payloadNodes);

      // Special handling: backend returned 500 with lambda_success_no_items or returned 200 with warning lambda_ok_but_no_items
      const errData = resObj.data || {};
      const serverError = errData.error || errData.warning || null;

      if (!resObj.ok) {
        console.error("Backend returned non-200:", errData);

        // if Lambda reported "success but no items" surface detailed diagnostics and allow copying to clipboard
        if (errData.error === 'lambda_success_no_items') {
          const msg = `Scheduling failed: Lambda reported success but returned no scheduled items.\n\nnodes_count_sent: ${errData.nodes_count_sent ?? payloadNodes.length}\n\nServer message: ${errData.detail ?? JSON.stringify(errData)}`;
          console.error('lambda_success_no_items details:', errData.lambdaResponse || errData);

          // show concise alert, then offer to copy raw debug payloads to clipboard
          alert(msg + '\n\nPress OK to copy server lambdaResponse and request payload to clipboard for inspection.');
          try {
            const toCopy = {
              nodes_count_sent: errData.nodes_count_sent ?? payloadNodes.length,
              clientPayloadPreview: payloadNodes.slice(0, 10),
              lambdaResponse: errData.lambdaResponse ?? errData
            };
            await navigator.clipboard.writeText(JSON.stringify(toCopy, null, 2));
            alert('Copied debug data to clipboard. Inspect in a text editor or paste into CloudWatch search for correlation.');
          } catch (copyErr) {
            console.warn('Clipboard copy failed:', copyErr);
            alert('Failed to copy to clipboard. Check console for details.');
          }

          setShowScheduleConfirmation(false);
          return;
        }

        // also handle server warning path where backend returned 200 with warning (lambda_ok_but_no_items)
        if (errData.warning === 'lambda_ok_but_no_items') {
          console.warn('Backend returned lambda_ok_but_no_items:', errData.lambdaResponse || errData);
          alert('Backend returned a warning: Lambda returned ok but no scheduled items. Check Lambda logs and env. Lambda response has been logged to console.');
          console.log('lambda_ok_but_no_items payload:', { nodes_count_sent: errData.nodes_count_sent ?? payloadNodes.length, lambdaResponse: errData.lambdaResponse ?? errData });
          setShowScheduleConfirmation(false);
          return;
        }

        // Special-case DynamoDB auth error returned by server
        if (errData.error === 'DynamoDB authorization error' || (errData.detail && errData.detail.hint)) {
          const hint = errData.detail?.hint || errData.detail || JSON.stringify(errData);
          alert(`Scheduling failed: ${errData.error || 'server_error'}\n\n${hint}\n\nFix IAM permissions (dynamodb:PutItem) for the server identity and retry.`);
          setShowScheduleConfirmation(false);
          return;
        }

        // Generic non-OK
        alert(`Scheduling failed (server returned ${resObj.status}). See console/server logs for details.`);
        setShowScheduleConfirmation(false);
        return;
      }

      // resObj.ok === true -> proceed
      const data = resObj.data;

      // If backend responded with partial failures, surface them to the user and offer retry
      if (data.partial) {
        console.warn("Partial schedule failures:", data.errors);
        const failedEntries = data.errors || [];
        const idsFailed = failedEntries.map((e: any) => e.id).filter(Boolean);
        const reasons = failedEntries.map((e: any) => `${e.id}: ${e.reason || e.error || 'unknown'}`).join("\n");
        // show reasons & ask to retry
        const retry = confirm(`Some schedules failed:\n\n${reasons}\n\nRetry failed items now?`);
        if (retry && idsFailed.length > 0) {
          const nodesToRetry = payloadNodes.filter((p: any) => idsFailed.includes(p.id));
          const retryRes = await doPost(nodesToRetry);
          if (!retryRes.ok) {
            console.error("Retry POST failed:", retryRes);
            alert(`Retry failed (server ${retryRes.status}). Check server logs.`);
            setShowScheduleConfirmation(false);
            return;
          }
          const retryData = retryRes.data;
          // merge retryData into data (overwrite entries)
          const mergedScheduled = (data.scheduled || []).filter((s: any) => !idsFailed.includes(s.id)).concat(retryData.scheduled || []);
          data.scheduled = mergedScheduled;
          if (retryData.partial) {
            alert(`Retry completed with ${retryData.errors?.length ?? 0} failures. Check logs for details.`);
          } else {
            alert('Retry completed successfully for previously failed items.');
          }
        } else {
          alert(`Some schedules failed: ${idsFailed.join(', ')}. See console/server logs for details.`);
        }
      }

      // Build map using id or scheduleId from backend
      const scheduledMap = new Map<string, any>();
      (data.scheduled || []).forEach((s: any) => {
        const key = s.id || s.scheduleId;
        if (key) scheduledMap.set(key, s);
      });

      const updatedNodes = nodes.map(n => {
        const sched = scheduledMap.get(n.id);
        if (sched && sched.status === 'scheduled') {
          return {
            ...n,
            status: 'scheduled' as const,
            // Keep the existing scheduledDate from local state since it's already correct
            scheduledDate: n.scheduledDate,
          };
        }
        return n;
      });

      setNodes(updatedNodes);
      setShowScheduleConfirmation(false);
      navigate('/calendar', { state: { nodes: updatedNodes, editable: true } });
    } catch (err) {
      console.error('handleConfirmSchedule failed:', err);
      alert('Failed to schedule nodes. Check server logs and ensure SNS/Dynamo/Scheduler permissions are correct.');
      setShowScheduleConfirmation(false);
    }
  };

  const handleCalendarView = () => {
    setShowCalendarModal(true);
  };

  const getStatusColor = (status: ContentNode['status']) => {
    switch (status) {
      case 'published': return 'bg-success';
      case 'scheduled': return 'bg-gradient-primary';
      case 'draft': return 'bg-muted';
      default: return 'bg-muted';
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

  return (
    <div className="h-full flex flex-col bg-gradient-subtle">
      {/* Planning Header */}
      <div className="p-6 border-b border-border/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Content Planning
            </h2>
            <p className="text-sm text-muted-foreground">
              Connect and schedule your content flow
            </p>
          </div>
          <Button 
            size="sm" 
            className="bg-gradient-secondary hover:opacity-90 glow-hover"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Node
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <Card className="px-3 py-2 bg-card/50 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-muted-foreground">Posted: {posted}</span>
            </div>
          </Card>
          <Card className="px-3 py-2 bg-card/50 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span className="text-xs text-muted-foreground">Published: {published}</span>
            </div>
          </Card>
          <Card className="px-3 py-2 bg-card/50 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-xs text-muted-foreground">Scheduled: {scheduled}</span>
            </div>
          </Card>
          <Card className="px-3 py-2 bg-card/50 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
              <span className="text-xs text-muted-foreground">Drafts: {drafts}</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Node Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <DraggableNodeCanvas 
          nodes={nodes} 
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeUpdate={handleNodeUpdate}
          onAddNode={() => setShowAddModal(true)}
          onDeleteNode={handleDeleteNode}
          onEditNode={handleEditNode}
          createOrDeleteEdge={createOrDeleteEdge}
          onCanvasClick={onCanvasClick}
        />
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-border/20 bg-card/20 backdrop-blur-sm">
        <div className="flex gap-2">
           <Button 
             variant="outline" 
             size="sm" 
             className="flex-1 border-primary/20 hover:border-primary/40"
             onClick={handleCalendarView}
           >
            <Calendar className="w-3 h-3 mr-2" />
            Calendar View
          </Button>
          <Button 
            variant="outline" 
             size="sm" 
             className="flex-1 border-primary/20 hover:border-primary/40"
             onClick={handleScheduleAll}
             data-schedule-all
           >
            <Clock className="w-3 h-3 mr-2" />
            Schedule All
          </Button>
        </div>
      </div>

      {/* Content Modal */}
      <ContentModal
        node={selectedNode}
        open={showModal}
        onOpenChange={setShowModal}
        onEditNode={handleEditNode}
      />

      {/* Add Node Modal */}
      <AddNodeModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onAddNode={handleAddNode}
      />

      {/* Schedule Confirmation Modal */}
      <ScheduleConfirmationModal
        open={showScheduleConfirmation}
        onOpenChange={setShowScheduleConfirmation}
        nodes={nodes.filter(node => node.scheduledDate && node.status !== 'published' && !node.postedAt)} // Exclude published and posted nodes
        onConfirm={handleConfirmSchedule}
      />

      {/* Calendar Preview Modal */}
      <CalendarModal
        open={showCalendarModal}
        onOpenChange={setShowCalendarModal}
        scheduledNodes={nodes.filter(node => node.status === 'scheduled')} // Show only scheduled nodes
        editable={true}
        onEditNode={handleEditNode}
      />

      {/* Edit Node Modal */}
      <EditNodeModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        node={editingNode}
        onSave={handleSaveNode}
      />
    </div>
  );
});

PlanningPanel.displayName = 'PlanningPanel';
