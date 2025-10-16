import React, { useState } from 'react';
import { scheduleService } from '@/services/scheduleService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarEventModal } from '@/components/modals/CalendarEventModal';
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
} from 'lucide-react';

interface ScheduledContent {
  id: string;
  title: string;
  type: 'post' | 'image' | 'story';
  time: string;
  status: 'scheduled' | 'published';
}

export interface ContentNode {
  id: string;
  title: string;
  type: 'post' | 'image' | 'story';
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: Date;
  content: string;
  imageUrl?: string;
  connections: string[];
  position: { x: number; y: number };
  postedAt?: Date;
  postedTo?: string[];
  tweetId?: string;
  linkedInId?: string;
}

interface CalendarViewProps {
  scheduledNodes?: ContentNode[];
  onClose: () => void;
  onUpdateNode?: (updatedNode: ContentNode) => void;
  onDeleteNode?: (nodeId: string) => void;
  editable?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  scheduledNodes = [], 
  onClose, 
  onUpdateNode, 
  onDeleteNode,
  editable = false
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<ContentNode | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [fetchedNodes, setFetchedNodes] = useState<ContentNode[]>([]);
  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ?? 'https://brewpost.duckdns.org';

  // If no nodes provided from parent, fetch from backend (DynamoDB/AppSync-backed schedules)
  React.useEffect(() => {
    if (Array.isArray(scheduledNodes) && scheduledNodes.length > 0) return;
    let mounted = true;
    (async () => {
      try {
        // Try to include userId for per-user fetch; read from localStorage if your app stores it there.
        let storedUserId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') : null;

        // NEW: if userId missing, try to decode id_token from stored auth_tokens (Callback stores auth_tokens)
        if (!storedUserId) {
          try {
            const authTokens = typeof window !== 'undefined' ? window.localStorage.getItem('auth_tokens') : null;
            if (authTokens) {
              const toks = JSON.parse(authTokens);
              const idToken = toks?.id_token;
              if (idToken && typeof idToken === 'string') {
                const parts = idToken.split('.');
                if (parts.length >= 2) {
                  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                  const json = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                  const payload = JSON.parse(json);
                  if (payload && payload.sub) {
                    storedUserId = payload.sub;
                    // persist for future loads
                    window.localStorage.setItem('userId', payload.sub);
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Failed to derive userId from auth_tokens:', e);
          }
        }

        const userQuery = storedUserId ? `?userId=${encodeURIComponent(storedUserId)}` : '';
        const headers: Record<string,string> = {};
        if (storedUserId) headers['x-user-id'] = storedUserId;
        
        console.log('Calendar fetch - storedUserId:', storedUserId);
        console.log('Calendar fetch - userQuery:', userQuery);
        console.log('Calendar fetch - headers:', headers);
        
        if (!storedUserId) {
          // Helpful debug hint — recommend setting localStorage.userId for per-user fetching
          console.info('No userId available locally; server may require session auth.');
        }

        // NOTE: include credentials so server session cookies are sent when using session-based auth
        const data = await scheduleService.listSchedules();



        if (!data.ok) {
          console.error("Unexpected schedule list response:", data);

          // NEW: handle missing_userid by prompting user to sign in (redirect to backend login)
          if (data.error === 'missing_userid') {
            const goLogin = confirm('You must sign in to view your schedules. Redirect to the sign-in page now?');
            if (goLogin) {
              // Use server login endpoint so session flow works
              window.location.href = `${BACKEND_URL}/login`;
              return;
            } else {
              if (mounted) setFetchedNodes([]);
              return;
            }
          }

          // If we received an unexpected_function_response include its detail stringified
          if (data.error === 'unexpected_function_response') {
            console.warn('Per-user schedules fetch returned unexpected shape detail:', data.detail);
            alert('Failed to load schedules: per-user function returned unexpected data. Check console for "schedules/list" logs and paste the "detail" here for help.');
            if (mounted) setFetchedNodes([]);
            return;
          }

          // If server forwarded the per-user function response but shape was unexpected, show detail
          if (data.error === 'unexpected_function_response') {
            console.warn('Per-user schedules fetch returned unexpected shape:', data.detail);
            alert('Failed to load schedules: per-user function returned unexpected data. Check browser console for the function response detail.');
            if (mounted) setFetchedNodes([]);
            return;
          }

          // NEW: detect DynamoDB Scan auth error and surface actionable message
          const detail = String(data.detail || '');
          if (/dynamodb:Scan/i.test(detail) || /DynamoDBScanAuthorizationError/i.test(data.error) || /DynamoDB authorization error/i.test(data.error)) {
            // Friendly UI/alert so user knows why calendar is empty
            alert('Failed to load schedules: server is missing DynamoDB read (Scan) permission or per-user fetch is not configured. Attach read permissions or configure the per-user Lambda. See aws/schedules-scan-policy.json for an example policy.');
            if (mounted) setFetchedNodes([]);
            return;
          }

          // Handle per-user function unexpected responses
          if (data.error === 'unexpected_function_response' || data.error === 'function_url_error' || data.error === 'missing_userid') {
            console.warn('Per-user schedules fetch returned:', data);
            alert('Failed to fetch per-user schedules. Check console logs and ensure your userId is provided (localStorage.userId) or session is active.');
            if (mounted) setFetchedNodes([]);
            return;
          }

          // fallback: log and continue with empty list
          if (mounted) setFetchedNodes([]);
          return;
        }

        if (data.ok && Array.isArray(data.schedules) && mounted) {
          console.log('Fetched schedules from backend:', data.schedules);
          console.log('First schedule item structure:', data.schedules[0]);
          console.log('First schedule title field:', data.schedules[0]?.title);
          console.log('First schedule raw data:', JSON.stringify(data.schedules[0], null, 2));
          
          const parsed = data.schedules.map((s: any) => {
            return {
              id: s.scheduleId || s.id,
              title: s.title || 'Untitled',
              type: 'post' as const, // Default type since schedules don't store type
              status: s.status || 'scheduled' as const,
              scheduledDate: s.scheduledDate ? new Date(s.scheduledDate) : undefined,
              content: s.content || '',
              imageUrl: s.imageUrl || undefined,
              connections: [],
              position: { x: 0, y: 0 }, // Default position
              userId: s.userId
            };
          });
          console.log('Parsed nodes for calendar:', parsed);
          console.log('First parsed node title:', parsed[0]?.title);
          setFetchedNodes(parsed);
        } else {
          console.error("Unexpected schedule list response:", data);
        }
      } catch (err) {
        console.error("Failed to fetch schedules:", err);
      }
    })();
    return () => { mounted = false; };
  }, [scheduledNodes]);

  // Helper function to format date keys
  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const nodesToRender = scheduledNodes && scheduledNodes.length > 0 ? scheduledNodes : fetchedNodes;
  
  // Convert scheduled nodes to calendar format
  const scheduledContent: Record<string, ScheduledContent[]> = {};
  
  nodesToRender.forEach(node => {
    if (node.scheduledDate) {
      const dateKey = formatDateKey(
        node.scheduledDate.getFullYear(),
        node.scheduledDate.getMonth(),
        node.scheduledDate.getDate()
      );
      if (!scheduledContent[dateKey]) {
        scheduledContent[dateKey] = [];
      }
      scheduledContent[dateKey].push({
        id: node.id,
        title: node.title,
        type: node.type,
        time: node.scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: node.status as 'scheduled' | 'published'
      });
    }
  });

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = getDaysInMonth(currentDate);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-card/95 backdrop-blur-xl border-border/50">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Content Calendar</h2>
            </div>
            <Button variant="outline" onClick={onClose} className="border-primary/20 hover:border-primary/40">
              Close
            </Button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigateMonth('prev')}
              className="border-primary/20 hover:border-primary/40"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <h3 className="text-xl font-semibold">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigateMonth('next')}
              className="border-primary/20 hover:border-primary/40"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {dayNames.map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="p-3"></div>;
              }
              
              const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
              const dayContent = scheduledContent[dateKey] || [];
              const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
              
              return (
                <Card 
                  key={day} 
                  className={`p-2 min-h-[100px] ${isToday ? 'border-primary bg-primary/5' : 'border-border/20'} hover:border-primary/40 transition-colors`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${isToday ? 'text-primary' : ''}`}>
                      {day}
                    </span>
                    {dayContent.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dayContent.length}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {dayContent.slice(0, 2).map(content => {
                      const fullEvent = nodesToRender.find(node => node.id === content.id);
                      return (
                        <div 
                          key={content.id} 
                          className={`p-1 rounded text-xs ${editable ? 'cursor-pointer hover:opacity-80' : ''} transition-opacity ${
                            content.status === 'published' 
                              ? 'bg-success/20 text-success-foreground' 
                              : 'bg-primary/20 text-primary-foreground'
                          }`}
                          onClick={() => {
                            if (editable && fullEvent) {
                              setSelectedEvent(fullEvent);
                              setShowEventModal(true);
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{content.time}</span>
                          </div>
                          <div className="truncate font-medium">
                            {content.title}
                          </div>
                        </div>
                      );
                    })}
                    {dayContent.length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayContent.length - 2} more
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary/20 rounded"></div>
              <span className="text-muted-foreground">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-success/20 rounded"></div>
              <span className="text-muted-foreground">Published</span>
            </div>
          </div>
        </div>
      </Card>

      <CalendarEventModal
        open={showEventModal}
        onOpenChange={setShowEventModal}
        event={selectedEvent}
        onSave={(updatedEvent) => {
          console.log('CalendarView onSave called with:', updatedEvent);
          
          // Update local state immediately for UI responsiveness
          console.log('Updating fetchedNodes state...');
          setFetchedNodes(prev => {
            const updated = prev.map(node => 
              node.id === updatedEvent.id ? updatedEvent : node
            );
            console.log('Updated fetchedNodes:', updated);
            return updated;
          });
          
          // Call parent's update handler
          if (onUpdateNode) {
            console.log('Calling parent onUpdateNode...');
            onUpdateNode(updatedEvent);
          } else {
            console.log('No onUpdateNode handler provided!');
          }
        }}
        onDelete={(eventId) => {
          if (onDeleteNode) {
            onDeleteNode(eventId);
          }
        }}
      />
    </div>
  );
};
