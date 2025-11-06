import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Send,
  Image,
  Type,
  Wand2,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  X,
  Maximize2,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ContentNode } from '@/components/planning/PlanningPanel';
import { NodeAPI } from '@/services/nodeService';
import {
  enhanceImagePromptWithTemplate,
  applyTemplateToImage,
} from '@/utils/templateUtils';
import {
  getRemainingMessages,
  isQuotaExceeded,
  incrementQuota,
  formatTimeUntilReset,
  addPaidMessages,
  getQuotaBreakdown,
  QUOTA_CONSTANTS,
} from '@/utils/quotaUtils';
import { PaymentModal } from './PaymentModal';
import { useToast } from '@/hooks/use-toast';

const cleanField = (s?: string) =>
  (s ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/^\s*(\*{1,}|[-•])\s*/, '')
    .replace(/^\s*["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const stripMarkdownForDisplay = (s: string = '') =>
  s
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/```([\s\S]*?)```/g, '$1')
    .trim();

interface Message {
  id: string;
  title?: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  rawText?: string;
  timestamp: Date;
  contentType?: 'text' | 'image';
  imageUrl?: string;
  imagePrompt?: string;
  captions?: string[];
}

type PlannerNode = {
  day: string;
  title: string;
  caption: string;
  imagePrompt: string;
};

function extractPlannerNodesFromText(raw: string): PlannerNode[] {
  const text = raw.replace(/\r\n/g, '\n');
  const nodes: PlannerNode[] = [];

  // New format: Parse "Post X" blocks with Title, Caption, Image Prompt
  const postBlockRe =
    /(?:^|\n)(?:##\s*)?Post\s+(\d+)\s*\n([\s\S]*?)(?=(?:\n(?:##\s*)?Post\s+\d+)|$)/gi;
  let match;

  while ((match = postBlockRe.exec(text)) !== null) {
    const postNum = match[1];
    const content = match[2].trim();

    // Extract Title, Caption, and Image Prompt
    const titleMatch = content.match(/\*\*Title:\*\*\s*([^\n]+)/i);
    const captionMatch = content.match(/\*\*Caption:\*\*\s*([^\n]+)/i);
    const imagePromptMatch = content.match(/\*\*Image Prompt:\*\*\s*([^\n]+)/i);

    const title = titleMatch ? titleMatch[1].trim() : `Post ${postNum}`;
    const caption = captionMatch ? captionMatch[1].trim() : '';
    const imagePrompt = imagePromptMatch ? imagePromptMatch[1].trim() : '';

    nodes.push({
      day: `Post ${postNum}`,
      title: cleanField(title),
      caption: cleanField(caption),
      imagePrompt: cleanField(imagePrompt),
    });
  }

  // Fallback: Try to parse line-by-line format
  if (nodes.length === 0) {
    const lines = text.split('\n');
    let currentPost: Partial<PlannerNode> = {};
    let postCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for Post header
      const postHeaderMatch = trimmed.match(/^(?:##\s*)?Post\s+(\d+)/i);
      if (postHeaderMatch) {
        // Save previous post if exists
        if (currentPost.day) {
          nodes.push({
            day: currentPost.day,
            title: currentPost.title || `Post ${postCount}`,
            caption: currentPost.caption || '',
            imagePrompt: currentPost.imagePrompt || '',
          });
        }

        // Start new post
        postCount = parseInt(postHeaderMatch[1]);
        currentPost = { day: `Post ${postCount}` };
        continue;
      }

      // Extract title (can be on same line as Post or separate)
      const titleMatch =
        trimmed.match(/^(?:Title:|\*\*Title:\*\*)\s*(.+)/i) ||
        (currentPost.day && !currentPost.title && trimmed.match(/^(.+)$/));
      if (titleMatch && !currentPost.title) {
        currentPost.title = cleanField(titleMatch[1]);
        continue;
      }

      // Extract caption
      const captionMatch = trimmed.match(
        /^(?:Caption:|\*\*Caption:\*\*)\s*(.+)/i
      );
      if (captionMatch) {
        currentPost.caption = cleanField(captionMatch[1]);
        continue;
      }

      // Extract image prompt
      const imagePromptMatch = trimmed.match(
        /^(?:Image Prompt:|\*\*Image Prompt:\*\*)\s*(.+)/i
      );
      if (imagePromptMatch) {
        currentPost.imagePrompt = cleanField(imagePromptMatch[1]);
        continue;
      }
    }

    // Save last post
    if (currentPost.day) {
      nodes.push({
        day: currentPost.day,
        title: currentPost.title || `Post ${postCount}`,
        caption: currentPost.caption || '',
        imagePrompt: currentPost.imagePrompt || '',
      });
    }
  }

  console.info(
    'AIChat: parsed planner blocks ->',
    nodes.map((n) => ({
      day: n.day,
      title: n.title,
      caption: n.caption.substring(0, 50),
      hasImagePrompt: !!n.imagePrompt,
    }))
  );
  return nodes;
}

function mapPlannerNodesToContentNodes(
  plannerNodes: PlannerNode[]
): ContentNode[] {
  const timestamp = Date.now();
  const ids = plannerNodes.map(
    (_, i) => `planner-${timestamp}-${i}-${Math.floor(Math.random() * 10000)}`
  );
  const count = plannerNodes.length;
  const spacing = 320;
  // Position planner nodes more to the left and up
  const startX = 100;
  const topY = 20;
  const bottomY = topY + 180;

  const detectPostType = (title: string, caption: string) => {
    const content = `${title} ${caption}`.toLowerCase();
    console.log(
      `🔍 DETECTING POST TYPE for: "${title}" + "${caption.substring(
        0,
        50
      )}..."`
    );

    // 🔵 PROMOTIONAL: Drive direct action (purchase, signup, visit, conversion)
    if (
      content.match(
        /\b(shop|order|buy|get yours|discount|available now|limited|offer|sale|use code|sign up|join|link in bio|free shipping|diy|recipe|create|make|try|get|start)\b/
      )
    ) {
      console.log(`🎯 DETECTED: promotional`);
      return 'promotional';
    }

    // 🟡 BRANDING: Build brand identity, trust, and values
    if (
      content.match(
        /\b(crafted|behind the scenes|heritage|tradition|quality|meet|farmer|team|values|trust|story of|our process|secret|day in the life|art of|history|unveiling|science|grading|special)\b/
      )
    ) {
      console.log(`🎯 DETECTED: branding`);
      return 'branding';
    }

    // 🟢 ENGAGING: Spark conversation, curiosity, or sharing (default for questions/discussions)
    console.log(`🎯 DETECTED: engaging (default)`);
    return 'engaging';
  };

  return plannerNodes.map((node, index) => {
    const isBottom = index % 2 === 1;
    const x = startX + index * (spacing / 2);
    const y = isBottom ? bottomY : topY;

    let cleanedCaption = (node.caption || '').trim();
    const ipIdx = cleanedCaption.search(
      /(?:\*\*Image Prompt\*\*|Image Prompt)\b[:-]?/i
    );
    if (ipIdx >= 0) {
      cleanedCaption = cleanedCaption.slice(0, ipIdx).trim();
    }
    cleanedCaption = cleanedCaption.replace(/^\*+\s*/, '').trim();

    const postType = detectPostType(node.title, cleanedCaption);

    let titleCandidate = (node.title || '').replace(/\*+/g, '').trim();
    if (!titleCandidate) {
      const firstLine = (
        cleanedCaption.split(/\r?\n/).find((l) => l.trim()) || ''
      ).trim();
      titleCandidate = firstLine || `${node.day} Post`;
    }

    return {
      id: ids[index],
      title: titleCandidate,
      type: 'post',
      status: 'draft',
      scheduledDate: getScheduledDate(index),
      content: cleanedCaption,
      imagePrompt: node.imagePrompt || undefined,
      day: node.day,
      postType,
      connections: index < count - 1 ? [ids[index + 1]] : [],
      imageUrl: undefined,
      position: {
        x,
        y,
      },
    };
  });
}

function getScheduledDate(postIndex: number): Date {
  const today = new Date();
  const newDate = new Date(today);

  if (postIndex === 0) {
    // Post 1 is tomorrow
    newDate.setDate(today.getDate() + 1);
  } else {
    // Each subsequent post is 4-5 days apart at random
    let totalDays = 1; // Start from tomorrow for Post 1
    for (let i = 1; i <= postIndex; i++) {
      const randomDays = Math.floor(Math.random() * 2) + 4; // 4 or 5 days
      totalDays += randomDays;
    }
    newDate.setDate(today.getDate() + totalDays);
  }

  return newDate;
}

interface AIChatProps {
  // optional: the AIChat can be rendered in places that don't need to update the planner
  setPlanningNodes?: (nodes: ContentNode[]) => void;
}

// Resolve a stable per-user storage key for chat history
function getChatStorageKey(): string {
  try {
    if (typeof window === 'undefined') return 'bp_chat_guest';
    let uid = window.localStorage.getItem('userId');
    if (!uid) {
      const authTokens = window.localStorage.getItem('auth_tokens');
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
                  .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              );
              const payload = JSON.parse(json);
              if (payload && payload.sub) {
                uid = payload.sub;
                window.localStorage.setItem('userId', uid);
              }
            }
          }
        } catch (e) {
          console.warn('AIChat: failed to decode id_token for userId', e);
        }
      }
    }
    return `bp_chat_${uid || 'guest'}`;
  } catch {
    return 'bp_chat_guest';
  }
}

export const AIChat: React.FC<AIChatProps> = ({ setPlanningNodes }) => {
  // Initial seed message (only used if no persisted history)
  const seedMessage: Message = {
    id: '1',
    type: 'ai',
    content:
      'Welcome to BrewPost! 🎯 I can help you plan and create amazing content. Try asking me to "plan content structure" or "connect content pieces" to get strategic suggestions for your content flow!',
    timestamp: new Date(),
    contentType: 'text',
  };

  // Load from localStorage once at mount
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const key = getChatStorageKey();
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        // revive Date objects
        return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch (e) {
      console.warn('AIChat: failed to load chat history:', e);
    }
    return [seedMessage];
  });
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();
  const [isRefining, setIsRefining] = useState(false);

  // FIX: initialize toast hook
  const { toast } = useToast();

  // Quota state
  const [remainingMessages, setRemainingMessages] = useState(
    getRemainingMessages()
  );
  const [quotaExceeded, setQuotaExceeded] = useState(isQuotaExceeded());
  const [timeUntilReset, setTimeUntilReset] = useState(formatTimeUntilReset());
  const [quotaBreakdown, setQuotaBreakdown] = useState(getQuotaBreakdown());
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Image zoom state
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Image zoom functions
  const openZoomModal = (imageUrl: string) => {
    setZoomedImage(imageUrl);
    setZoomLevel(1);
    setRotation(0);
    setShowZoomModal(true);
  };

  const closeZoomModal = () => {
    setShowZoomModal(false);
    setZoomedImage('');
    setZoomLevel(1);
    setRotation(0);
  };

  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const rotateImage = () => setRotation((prev) => (prev + 90) % 360);

  const downloadImage = () => {
    if (zoomedImage) {
      const link = document.createElement('a');
      link.href = zoomedImage;
      link.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Update quota state periodically
  useEffect(() => {
    const updateQuotaState = () => {
      setRemainingMessages(getRemainingMessages());
      setQuotaExceeded(isQuotaExceeded());
      setTimeUntilReset(formatTimeUntilReset());
      setQuotaBreakdown(getQuotaBreakdown());
    };

    // Update immediately
    updateQuotaState();

    // Update every second for real-time countdown
    const interval = setInterval(updateQuotaState, 1000);

    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts for zoom modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showZoomModal) return;

      switch (e.key) {
        case 'Escape':
          closeZoomModal();
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          rotateImage();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showZoomModal]);

  const quickPrompts = [
    { icon: Image, text: 'Plan content structure' },
    { icon: Type, text: 'Connect content pieces' },
    { icon: Wand2, text: 'Marketing campaign' },
  ];

  // Check if user specified content category
  const detectContentCategory = (input: string) => {
    const lower = input.toLowerCase();
    if (lower.includes('engaging') || lower.includes('engagement'))
      return 'engaging';
    if (
      lower.includes('promotional') ||
      lower.includes('promotion') ||
      lower.includes('promo')
    )
      return 'promotional';
    if (lower.includes('branding') || lower.includes('brand'))
      return 'branding';
    return null;
  };

  // Clean AI response to keep only the weekly plan
  const cleanAIResponse = (aiResponse: string) => {
    // Find the end of the weekly plan (Sunday) and remove everything after
    const sundayMatch = aiResponse.match(
      /(Sunday[\s\S]*?)(?=\n\n[A-Z][A-Z ]+:|$)/i
    );
    if (sundayMatch) {
      const endIndex =
        aiResponse.indexOf(sundayMatch[0]) + sundayMatch[0].length;
      return aiResponse.substring(0, endIndex).trim();
    }
    return aiResponse;
  };

  // Smart content planning fallback
  const generatePlanningResponse = (userInput: string) => {
    const lowerInput = userInput.toLowerCase();

    if (lowerInput.includes('connect') || lowerInput.includes('link')) {
      return `Great! I can help you connect your content nodes strategically:

**Connection Strategies:**
• Sequential: A → B → C (story progression)
• Hub: Main post connected to supporting content
• Campaign: All nodes linked for unified messaging

Click the link icon on any node to start connecting them. What type of content flow are you planning?`;
    }

    return `I'll create a smart content plan for: "${userInput}"

**How it works:**
• I automatically assign the best post type for each day
• Each post is tailored to your specific topic
• Strategic mix of engaging, promotional, and branding content

Just tell me what you want to create content about!`;
  };

  // NEW: helper to append a message safely
  const appendMessage = (m: Message) => setMessages((prev) => [...prev, m]);

// Persist chat messages to localStorage whenever they change
useEffect(() => {
  try {
    const key = getChatStorageKey();
    const serializable = messages.map((m) => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp }));
    window.localStorage.setItem(key, JSON.stringify(serializable));
  } catch (e) {
    console.warn('AIChat: failed to persist chat history:', e);
  }
}, [messages]);

  // NEW: Prompt Refiner Function (updated implementation)
  const refinePrompt2 = async () => {
    if (!input.trim() || isRefining) return;

    // NOTE: Refinement is treated as a lightweight client-side helper and does NOT
    // consume the user's free message quota. We intentionally avoid incrementing
    // quota here so users can polish prompts without losing messages.
    setIsRefining(true);

    try {
      const prompt = `Refine this user prompt for social media content planning and generation. Return ONLY the improved prompt (one or two sentences), do not include any extra explanation.\n\nUser prompt: "${input.trim()}"\n\nGuidelines:\n- Make it clear, specific and actionable for content creation.\n- Add topical context and suggest a desired outcome (e.g., increase engagement, attract customers).\n- Keep the original intent and tone.`;

      const apiUrl = '/generate';
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Prompt: prompt }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(txt || 'Refine request failed');
      }

      const data: GenerateResponse = await resp.json();
      const refined = (data.text || data.content || '').trim();
      if (refined) {
        setInput(refined);
      } else {
        setInput(`Enhanced: ${input.trim()} - with clearer objectives and a focus on engagement.`);
      }
    } catch (err: unknown) {
      console.error('Prompt refinement failed:', err);
      setInput(`Enhanced: ${input.trim()} - with strategic approach and clearer objectives.`);
    } finally {
      setIsRefining(false);
    }
  };

  // NEW: Prompt Refiner Function
  const refinePrompt = async () => {
    if (!input.trim() || isRefining) return;

    setIsRefining(true);

    try {
      const refinementPrompt = [
        {
          role: 'user',
          content: `Please refine and improve this prompt to make it more clear, specific, and effective for content creation: "${input.trim()}"

Guidelines for refinement:
- Make it more specific and actionable
- Add context if needed
- Improve clarity and remove ambiguity
- Keep the original intent but enhance the details
- Make it suitable for content planning and creation

Return only the refined prompt, nothing else.`,
        },
      ];

      const apiUrl = '/generate';

      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: refinementPrompt }),
      });

      if (!resp.ok) {
        throw new Error('Failed to refine prompt');
      }

      const data = await resp.json();

      if (data.text) {
        // Update the input with the refined prompt
        setInput(data.text.trim());
      } else {
        // Fallback local refinement
        const refined = `Create engaging ${input.trim()} content with clear messaging, strong visual appeal, and strategic call-to-action that drives audience engagement and aligns with brand objectives.`;
        setInput(refined);
      }
    } catch (err: unknown) {
      console.error('Prompt refinement failed:', err);
      // Fallback local refinement
      const refined = `Enhanced: ${input.trim()} - with strategic approach, clear objectives, and engaging presentation.`;
      setInput(refined);
    } finally {
      setIsRefining(false);
    }
  };

  type GenerateResponse = {
    content?: string;
    imageUrl?: string;
    captions?: string[];
    text?: string;
  };

  // later in the component: replace your existing handleSend with this
  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    // Check quota before proceeding
    if (isQuotaExceeded()) {
      // Show payment modal when quota is exceeded
      setShowPaymentModal(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
      contentType: 'text',
    };

    // optimistic append
    appendMessage(userMessage);

    // build messagesForBackend from current local state + the new message
    const MAX_TURNS = 6;
    const allTurns = [...messages, userMessage]; // include new message immediately
    const filteredTurns = allTurns
      .filter((m) => !(m.type === 'ai' && m.id === '1')) // remove static UI welcome
      .filter(
        (m) =>
          (m.type === 'user' || m.type === 'ai') &&
          (!m.contentType || m.contentType === 'text')
      )
      .map((m) => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
    const recent = filteredTurns.slice(
      Math.max(0, filteredTurns.length - MAX_TURNS)
    );
    const messagesForBackend = recent;

    setInput('');
    setIsGenerating(true);

    try {
      const apiUrl = '/generate';

      // Convert messages to a single prompt string for the backend
      const prompt = messagesForBackend
        .map(
          (msg) =>
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        )
        .join('\n\n');

      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Prompt: prompt }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || 'Generate failed');
      }
      const data: GenerateResponse = await resp.json();

      // Increment quota after successful API call
      incrementQuota();

      // Update quota state
      setRemainingMessages(getRemainingMessages());
      setQuotaExceeded(isQuotaExceeded());
      setQuotaBreakdown(getQuotaBreakdown());

      if (data.content || data.text) {
        let raw = data.content || data.text || '';
        // If it's a planner response, clean it
        if (isPlannerMessage(raw)) {
          raw = cleanAIResponse(raw);
        }
        const display = stripMarkdownForDisplay(raw);
        const maybePlanner = extractPlannerNodesFromText(raw);
        appendMessage({
          id: (Date.now() + 1).toString(),
          title: maybePlanner[0]?.title,
          type: 'ai',
          content: display,
          rawText: raw,
          timestamp: new Date(),
          contentType: 'text',
          imagePrompt: maybePlanner[0]?.imagePrompt,
        });
      } else {
        const raw = generatePlanningResponse(userMessage.content);
        const display = stripMarkdownForDisplay(raw);
        const maybePlanner = extractPlannerNodesFromText(raw);
        appendMessage({
          id: (Date.now() + 2).toString(),
          title: maybePlanner[0]?.title,
          type: 'ai',
          content: display,
          rawText: raw,
          timestamp: new Date(),
          contentType: 'text',
          imagePrompt: maybePlanner[0]?.imagePrompt,
        });
      }

      if (data.imageUrl) {
        try {
          const finalImageUrl = await applyTemplateToImage(data.imageUrl);

          appendMessage({
            id: (Date.now() + 3).toString(),
            type: 'ai',
            content:
              'Image generated with template settings — choose a caption below or edit it.',
            timestamp: new Date(),
            contentType: 'image',
            imageUrl: finalImageUrl,
            captions: Array.isArray(data.captions) ? data.captions : [],
          });
        } catch (error) {
          console.error('Template application failed:', error);
          appendMessage({
            id: (Date.now() + 3).toString(),
            type: 'ai',
            content: 'Image generated — choose a caption below or edit it.',
            timestamp: new Date(),
            contentType: 'image',
            imageUrl: data.imageUrl,
            captions: Array.isArray(data.captions) ? data.captions : [],
          });
        }
      }
    } catch (err: unknown) {
      console.error('AIChat generate error', err);
      appendMessage({
        id: (Date.now() + 4).toString(),
        type: 'system',
        content:
          'Sorry, something went wrong generating the reply. Check server logs.',
        timestamp: new Date(),
        contentType: 'text',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const isPlannerMessage = (text: string) => {
    const raw = text || '';
    const normalized = raw.toLowerCase();

    // Flexible header detection for post-based planning
    const hasPlannerHeader =
      /planner\s*mode|content\s+plan|post\s+schedule/.test(normalized);

    const postNumbers = /post\s+\d+/gi;
    const postsFound = (normalized.match(postNumbers) || []).length;

    // Section markers (Title/Caption/Image Prompt) often appear in your plans
    const hasSectionMarkers =
      /(title\s*[:\-])|(\bimage\s+prompt\b)|(\bcaption\s*[:\-])/.test(raw);

    // Last-resort: actually try to parse – if we can extract several nodes, it's a planner
    let parsedCount = 0;
    try {
      parsedCount = extractPlannerNodesFromText(raw).length;
    } catch {}

    return (
      (hasPlannerHeader && postsFound >= 2) || // header + a couple posts
      postsFound >= 3 || // looks like a multi-post plan
      (hasSectionMarkers && parsedCount >= 3) // parses into multiple nodes
    );
  };

  // Insert a caption into input (user can edit & send)
  const handleUseCaption = (caption: string) => setInput(caption);

  // Handle successful payment
  const handlePaymentSuccess = (messages: number) => {
    // Add paid messages to quota
    addPaidMessages(messages);
    
    // Update quota state
    setRemainingMessages(getRemainingMessages());
    setQuotaExceeded(isQuotaExceeded());
    setQuotaBreakdown(getQuotaBreakdown());
    
    // Close payment modal
    setShowPaymentModal(false);
    
    // Show success message
    const successMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: `Payment successful! ${messages} messages have been added to your account. You can now continue using the AI Content Generator.`,
      timestamp: new Date(),
      contentType: 'text',
    };
    appendMessage(successMessage);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-subtle">
      {/* Chat Header */}
      <div className="p-4 border-b border-border/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">AI Content Generator</h2>
          </div>

          {/* Quota Display */}
          <div className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium w-48 min-w-fit">
            <div className="flex items-center">
              <span>Free messages left:</span>
              <span className="ml-1 font-bold">{quotaBreakdown.freeRemaining}</span>
            </div>
            <div className="flex items-center">
              <span>Resets In:</span>
              <span className="ml-1 font-bold">{timeUntilReset}</span>
            </div>
            {quotaBreakdown.paidRemaining > 0 && (
              <div className="flex items-center">
                <span>Purchased messages left:</span>
                <span className="ml-1 font-bold">{quotaBreakdown.paidRemaining}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <Card
              className={`max-w-[80%] p-3 text-white`}
              style={{
                backgroundColor:
                  message.type === 'user' ? '#03624C' : '#2CC295',
              }}
            >
              {message.contentType === 'image' && message.imageUrl ? (
                <div>
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => openZoomModal(message.imageUrl!)}
                  >
                    <img
                      src={message.imageUrl}
                      alt="generated"
                      className="w-full max-h-96 object-contain rounded-md mb-3 transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 rounded-md flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/50 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                        <Maximize2 className="w-4 h-4" />
                        Click to zoom
                      </div>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-2">
                    {message.content}
                  </p>

                  {/* caption suggestions */}
                  {message.captions?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {message.captions.map((c, i) => (
                        <button
                          key={i}
                          className="px-3 py-1 rounded-full bg-gray-800 text-sm text-white hover:opacity-90"
                          onClick={() => handleUseCaption(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs opacity-60">
                      No captions suggested.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  {message.type === 'ai' &&
                    message.contentType === 'text' &&
                    isPlannerMessage(message.rawText ?? message.content) && (
                      <Button
                        size="sm"
                        className="mt-4 text-white shadow-lg transition-colors border border-[#03624C]/50"
                        style={{ backgroundColor: '#03624C' }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = '#2CC295')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = '#03624C')
                        }
                        onClick={() => {
                          const applyToast = toast({
                            title: 'Applying planner',
                            description: 'Adding nodes to the canvas...',
                          });
                    
                          const planner = extractPlannerNodesFromText(
                            message.rawText ?? message.content
                          );
                          const contentNodes = mapPlannerNodesToContentNodes(planner);
                    
                          if (contentNodes.length === 0) {
                            const fallback: ContentNode[] = [
                              {
                                id: Date.now().toString() + '-fallback',
                                title: 'AI Planner Suggestion',
                                type: 'post',
                                status: 'draft',
                                scheduledDate: new Date(),
                                content: message.content.slice(0, 800),
                                connections: [],
                                imageUrl: undefined,
                                position: { x: 60, y: 60 },
                              },
                            ];
                            contentNodes.push(...fallback);
                          }
                    
                          if (typeof setPlanningNodes === 'function') {
                            setPlanningNodes(contentNodes);
                          }
                    
                          const saveToast = toast({
                            title: 'Saving planner',
                            description: 'Persisting nodes to database...',
                          });
                    
                          const replaceInAppSync = async () => {
                            try {
                              const existingNodes = await NodeAPI.list('demo-project-123');
                              const existingEdges = await NodeAPI.listEdges('demo-project-123');
                    
                              await Promise.all(
                                existingEdges.map((edge) =>
                                  NodeAPI.deleteEdge('demo-project-123', edge.edgeId).catch(() => {})
                                )
                              );
                    
                              await Promise.all(
                                existingNodes.map((oldNode) =>
                                  NodeAPI.remove('demo-project-123', oldNode.nodeId).catch(() => {})
                                )
                              );
                    
                              console.log(
                                '✅ All deletions completed. Creating',
                                contentNodes.length,
                                'new nodes...'
                              );
                    
                              // Create all new nodes and track ID mapping
                              const idMapping = new Map();
                              const nodeResults = [];
                              let successCount = 0;
                    
                              for (let i = 0; i < contentNodes.length; i++) {
                                const node = contentNodes[i];
                                try {
                                  const result = await NodeAPI.create({
                                    projectId: 'demo-project-123',
                                    title: node.title,
                                    description: node.content,
                                    x: node.position.x,
                                    y: node.position.y,
                                    status: node.status,
                                    type: node.type,
                                    day: node.day,
                                    imageUrl: node.imageUrl,
                                    imagePrompt: node.imagePrompt,
                                    scheduledDate: node.scheduledDate?.toISOString(),
                                  });
                                  idMapping.set(node.id, result.nodeId);
                                  successCount += 1;
                                } catch (err) {
                                  // continue creating others
                                }
                              }
                    
                              if (idMapping.size > 0 && typeof setPlanningNodes === 'function') {
                                const updatedNodes = contentNodes.map((node) => {
                                  const newId = idMapping.get(node.id) || node.id;
                                  const remappedConnections = Array.isArray(node.connections)
                                    ? node.connections
                                        .map((oldConn) => idMapping.get(oldConn) || oldConn)
                                        .filter(Boolean)
                                    : [];
                                  return { ...node, id: newId, connections: remappedConnections };
                                });
                                setPlanningNodes(updatedNodes);
                              }
                    
                              const edgePromises: Promise<any>[] = [];
                              // Create sequential edges if none present, or use remapped ones
                              const nodesWithNewIds = contentNodes.map(n => ({
                                ...n,
                                id: idMapping.get(n.id) || n.id,
                                connections: Array.isArray(n.connections)
                                  ? n.connections.map(c => idMapping.get(c) || c).filter(Boolean)
                                  : []
                              }));
                              const hasAnyConnections = nodesWithNewIds.some(n => (n.connections?.length ?? 0) > 0);
                              if (hasAnyConnections) {
                                for (const node of nodesWithNewIds) {
                                  const fromId = node.id;
                                  for (const toId of node.connections || []) {
                                    if (!fromId || !toId) continue;
                                    edgePromises.push(NodeAPI.createEdge('demo-project-123', fromId, toId));
                                  }
                                }
                              } else {
                                // Sequentially connect nodes to reflect planner flow
                                for (let i = 0; i < nodesWithNewIds.length - 1; i++) {
                                  const fromId = nodesWithNewIds[i].id;
                                  const toId = nodesWithNewIds[i + 1].id;
                                  if (fromId && toId) {
                                    edgePromises.push(NodeAPI.createEdge('demo-project-123', fromId, toId));
                                  }
                                }
                              }
                              await Promise.allSettled(edgePromises);
                    
                              applyToast.update({
                                title: 'Planner applied',
                                description: 'Nodes added to canvas.',
                              });
                    
                              saveToast.update({
                                title: 'Planner saved',
                                description: `Saved ${successCount} nodes and ${edgePromises.length} connections.`,
                              });
                            } catch (error: any) {
                              const message = error?.response?.status === 401
                                ? 'Unauthorized. Please log in and try again.'
                                : 'Could not persist nodes. Check your connection.';
                              saveToast.update({
                                title: 'Save failed',
                                description: message,
                                variant: 'destructive',
                              });
                            }
                          };
                    
                          replaceInAppSync();
                        }}
                      >
                        📅 Use This Planner
                      </Button>
                    )}
                </>
              )}

              <div className="flex items-center justify-between mt-2">
                <Badge variant="secondary" className="text-xs opacity-70">
                  {message.type === 'ai'
                    ? 'AI'
                    : message.type === 'user'
                    ? 'You'
                    : 'System'}
                </Badge>
                <span className="text-xs opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </Card>
          </div>
        ))}

        {isGenerating && (
          <div className="flex justify-start">
            <Card className="max-w-[80%] p-3 bg-card/50 backdrop-blur-sm border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-pulse"
                  style={{ animationDelay: '0.4s' }}
                ></div>
                <span className="text-sm text-muted-foreground ml-2">
                  Generating content...
                </span>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border/20">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe the content you want to create..."
              className="h-11 min-h-11 max-h-11 resize-none glow-focus border-primary/20 focus:border-primary/40 pr-12 py-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {/* Magic Wand Button for Prompt Refinement */}
            {input.trim() && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-primary/10 group"
                onClick={refinePrompt2}
                disabled={isRefining}
                title="Refine your prompt with AI"
              >
                <Wand2
                  className={`w-4 h-4 text-primary/70 group-hover:text-primary transition-all ${
                    isRefining ? 'animate-spin' : 'group-hover:scale-110'
                  }`}
                />
              </Button>
            )}
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating || quotaExceeded}
            className="text-white shadow-lg transition-colors px-6"
            style={{
              backgroundColor:
                !input.trim() || isGenerating || quotaExceeded
                  ? '#03624C60'
                  : '#03624C',
            }}
            onMouseEnter={(e) => {
              if (!(!input.trim() || isGenerating || quotaExceeded)) {
                e.currentTarget.style.backgroundColor = '#2CC295';
              }
            }}
            onMouseLeave={(e) => {
              if (!(!input.trim() || isGenerating || quotaExceeded)) {
                e.currentTarget.style.backgroundColor = '#03624C';
              }
            }}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Prompt Refinement Indicator */}
        {isRefining && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1 h-1 bg-primary rounded-full animate-pulse"></div>
            <span>AI is refining your prompt...</span>
          </div>
        )}
      </div>

      {/* Image Zoom Modal */}
      <Dialog open={showZoomModal} onOpenChange={setShowZoomModal}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0 animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="relative w-full h-full flex flex-col">
            {/* Header with controls */}
            <DialogHeader className="flex-row items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
              <DialogTitle className="text-white font-medium">
                Image Preview
              </DialogTitle>
              <div className="flex items-center gap-1">
                <div className="bg-black/60 text-white text-xs px-2 py-1 rounded mr-3">
                  {Math.round(zoomLevel * 100)}%
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-all duration-200"
                  onClick={zoomOut}
                  disabled={zoomLevel <= 0.5}
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-all duration-200"
                  onClick={zoomIn}
                  disabled={zoomLevel >= 2}
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-all duration-200"
                  onClick={rotateImage}
                  title="Rotate (R)"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-all duration-200"
                  onClick={downloadImage}
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-white/20 mx-2" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-all duration-200"
                  onClick={closeZoomModal}
                  title="Close (ESC)"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogHeader>

            {/* Image container */}
            <div
              className="flex-1 flex items-center justify-center overflow-hidden select-none"
              onClick={(e) => {
                // Close on backdrop click
                if (e.target === e.currentTarget) {
                  closeZoomModal();
                }
              }}
            >
              {zoomedImage && (
                <div className="relative flex items-center justify-center w-full h-full">
                  <img
                    src={zoomedImage}
                    alt="Zoomed view"
                    className="max-w-none transition-all duration-300 ease-out shadow-2xl"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      maxHeight: zoomLevel <= 1 ? '80vh' : 'none',
                      maxWidth: zoomLevel <= 1 ? '80vw' : 'none',
                      objectFit: 'contain',
                    }}
                    draggable={false}
                  />
                </div>
              )}
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs p-3 rounded-lg backdrop-blur-sm border border-white/10">
              <div className="font-medium mb-1">Keyboard Shortcuts:</div>
              <div className="space-y-1 text-white/80">
                <div>
                  <kbd className="bg-white/20 px-1 rounded">ESC</kbd> Close
                </div>
                <div>
                  <kbd className="bg-white/20 px-1 rounded">+/-</kbd> Zoom
                </div>
                <div>
                  <kbd className="bg-white/20 px-1 rounded">R</kbd> Rotate
                </div>
              </div>
            </div>

            {/* Zoom level indicator */}
            <div className="absolute bottom-4 right-4 bg-black/70 text-white text-sm px-3 py-2 rounded-lg backdrop-blur-sm border border-white/10">
              {Math.round(zoomLevel * 100)}%
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

// ... existing code ...
