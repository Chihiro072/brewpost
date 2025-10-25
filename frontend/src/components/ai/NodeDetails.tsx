import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, Eye, Target, Zap, Send, Save, Sparkles, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import type { ContentNode } from '@/components/planning/PlanningPanel';
import { enhanceImagePromptWithTemplate, applyTemplateToImage, getTemplateSettings } from '@/utils/templateUtils';
import { scheduleService } from '@/services/scheduleService';

interface NodeDetailsProps {
  node: ContentNode | null;
  nodes?: ContentNode[]; // Add nodes array to show connected node details
  onSaveNode?: (node: ContentNode) => void;
  onPostNode?: (node: ContentNode) => void;
}

export const NodeDetails: React.FC<NodeDetailsProps> = ({ node, nodes = [], onSaveNode, onPostNode }) => {
  console.log('NodeDetails rendering with node:', node?.title);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedNode, setEditedNode] = useState<ContentNode | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  
  React.useEffect(() => {
    if (node) {
      console.log('NodeDetails: node prop changed, updating editedNode:', node);
      setEditedNode({ ...node });
      setIsEditing(false);
    }
  }, [node]);

  // Use the latest node data for display (either from props or editedNode)
  const displayNode = node;
  
  if (!node) {
    return (
      <div className="flex flex-col h-full bg-gradient-subtle">
        <div className="p-6 border-b border-border/20">
          <h2 className="text-xl font-semibold">Node Details</h2>
          <p className="text-sm text-muted-foreground">Select a node to view its details</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Click on a node in the planning canvas to view its details</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: ContentNode['status']) => {
    switch (status) {
      case 'published': return 'bg-success text-success-foreground';
      case 'scheduled': return 'bg-primary text-primary-foreground';
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

  const TypeIcon = getTypeIcon(node.type);

  const handleGeneratePrompt = async () => {
    if (!node || isGeneratingPrompt) return;
    
    setIsGeneratingPrompt(true);
    try {
      const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ?? 'http://localhost:5044';
      
      const response = await fetch(`${BACKEND_URL}/api/generate-enhanced-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: node.title,
          content: node.content,
          postType: node.postType || 'promotional'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate enhanced prompt');
      }
      
      if (data.ok && data.enhancedPrompt) {
        // Update the node with the enhanced prompt
        const updatedNode = {
          ...node,
          imagePrompt: data.enhancedPrompt
        };
        
        if (onSaveNode) {
          onSaveNode(updatedNode);
        }
        
        // Update local state immediately for UI feedback
        setEditedNode(updatedNode);
        
        console.log('Enhanced prompt generated:', data.enhancedPrompt);
      }
    } catch (error) {
      console.error('Error generating enhanced prompt:', error);
      alert('Failed to generate enhanced prompt: ' + error.message);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!node || isGeneratingImage) return;
    
    setIsGeneratingImage(true);
    try {
      const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ?? 'http://localhost:5044';
      
      // Enhance prompt with template settings and stronger color emphasis
      let enhancedPrompt = enhanceImagePromptWithTemplate(node.imagePrompt || node.title || node.content || '');
      
      // Add stronger color emphasis for node generation
      const template = getTemplateSettings();
      if (template?.selectedColor && template.selectedColor !== 'transparent') {
        enhancedPrompt += ` Make sure to prominently feature ${template.selectedColor} color throughout the entire image composition, use it for backgrounds, accents, and key visual elements. The ${template.selectedColor} should be the dominant color theme.`;
      }
      
      const response = await fetch(`${BACKEND_URL}/api/canvas-generate-from-node`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: node.id,
          imagePrompt: enhancedPrompt,
          title: node.title,
          content: node.content
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }
      
      if (data.ok && data.imageUrl) {
        console.log('🎯 [NodeDetails] Image generation successful, starting template processing...');
        console.log('🎯 [NodeDetails] Original image URL:', data.imageUrl);
        
        // Check if template processing is actually needed
        const template = getTemplateSettings();
        console.log('🎯 [NodeDetails] Template settings retrieved:', template);
        
        const needsProcessing = template && (template.logoPreview || template.companyText);
        console.log('🎯 [NodeDetails] Template processing needed?', needsProcessing, {
          hasTemplate: !!template,
          hasLogo: !!template?.logoPreview,
          hasCompanyText: !!template?.companyText,
          logoPreview: template?.logoPreview ? template.logoPreview.substring(0, 50) + '...' : 'none',
          companyText: template?.companyText || 'none'
        });
        
        // Only apply template processing if there's a logo or text to add
        let processedImageUrl = data.imageUrl;
        if (needsProcessing) {
          console.log('🎯 [NodeDetails] Calling applyTemplateToImage...');
          try {
            processedImageUrl = await applyTemplateToImage(data.imageUrl);
            console.log('🎯 [NodeDetails] Template processing completed successfully');
          } catch (templateError) {
            console.error('🎯 [NodeDetails] Template processing failed:', templateError);
            processedImageUrl = data.imageUrl; // Fallback to original
          }
        } else {
          console.log('🎯 [NodeDetails] Skipping template processing - no logo or company text configured');
        }
        
        console.log('🎯 [NodeDetails] Image processing result:', { 
          original: data.imageUrl, 
          processed: processedImageUrl.substring(0, 100) + '...', 
          needsProcessing,
          isDataUrl: processedImageUrl.startsWith('data:'),
          templateApplied: needsProcessing && processedImageUrl !== data.imageUrl
        });
        
        // Add new image to imageUrls array
        const existingImages = node.imageUrls || [];
        const updatedNode = {
          ...node,
          imageUrls: [...existingImages, processedImageUrl],
          imageUrl: processedImageUrl // Keep for backward compatibility
        };
        
        console.log('🎯 [NodeDetails] Saving updated node with new image...');
        if (onSaveNode) {
          onSaveNode(updatedNode);
        }
        
        // Update local state immediately for UI feedback
        setEditedNode(updatedNode);
        
        console.log('🎯 [NodeDetails] Image generated successfully:', processedImageUrl.substring(0, 100) + '...');
        console.log('🎯 [NodeDetails] Total images:', updatedNode.imageUrls.length);
      }
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image: ' + error.message);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-subtle">
      {/* Header */}
      <div className="p-4 border-b border-border/20">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <TypeIcon className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">{node.title}</h2>
              <p className="text-sm text-muted-foreground font-mono">{node.id}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge className={getStatusColor(node.status)}>
              {node.status}
            </Badge>
            <Badge variant="outline">
              {node.type}
            </Badge>
          </div>
        </div>
        {node.day && (
          <Badge variant="secondary" className="w-fit">
            {node.day}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Main Content */}
        <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Content
          </h3>
          {isEditing ? (
            <Textarea
              value={editedNode?.content || ''}
              onChange={(e) => setEditedNode(prev => prev ? { ...prev, content: e.target.value } : null)}
              className="min-h-[120px] text-sm"
              placeholder="Enter content..."
            />
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {node.content || 'No content available'}
            </div>
          )}
        </Card>



        {/* Posted Information */}
        {node.postedAt && node.postedTo && (
          <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Posted
            </h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <div>Posted on: {node.postedAt.toLocaleDateString()} at {node.postedAt.toLocaleTimeString()}</div>
              <div>Platforms: {node.postedTo.join(', ')}</div>
              {node.tweetId && (
                <div>Tweet ID: {node.tweetId}</div>
              )}
            </div>
          </Card>
        )}

        {/* Connections */}
        {node.connections && node.connections.length > 0 && (
          <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
            <h3 className="text-sm font-medium mb-2">Connected Nodes</h3>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {node.connections.length} connection{node.connections.length !== 1 ? 's' : ''}
              </div>
              <div className="space-y-2">
                {node.connections.map((connectedId, index) => {
                  // Find the connected node to show its title
                  const connectedNode = nodes.find(n => n.id === connectedId);
                  return (
                    <div key={connectedId} className="flex items-center gap-2 text-xs p-2 bg-muted/30 rounded border">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">
                          {connectedNode?.title || 'Unknown Node'}
                        </div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {connectedId}
                        </div>
                      </div>
                      {connectedNode && (
                        <Badge variant="outline" className="text-xs">
                          {connectedNode.type}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Title */}
        <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
          <h3 className="text-sm font-medium mb-2">Title</h3>
          {isEditing ? (
            <Input
              value={editedNode?.title || ''}
              onChange={(e) => setEditedNode(prev => prev ? { ...prev, title: e.target.value } : null)}
              placeholder="Enter title..."
            />
          ) : (
            <div className="text-sm text-muted-foreground">{node.title}</div>
          )}
        </Card>

        {/* Status and Type */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
            <h3 className="text-sm font-medium mb-2">Status</h3>
            {isEditing ? (
              <Select
                value={editedNode?.status || 'draft'}
                onValueChange={(value: 'draft' | 'scheduled' | 'published') => 
                  setEditedNode(prev => prev ? { ...prev, status: value } : null)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground capitalize">{node.status}</div>
            )}
          </Card>

          <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
            <h3 className="text-sm font-medium mb-2">Type</h3>
            {isEditing ? (
              <Select
                value={editedNode?.type || 'post'}
                onValueChange={(value: 'post' | 'image' | 'story') => 
                  setEditedNode(prev => prev ? { ...prev, type: value } : null)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground capitalize">{node.type}</div>
            )}
          </Card>
        </div>

        {/* Day and Post Type */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
            <h3 className="text-sm font-medium mb-2">Day</h3>
            {isEditing ? (
              <Input
                value={editedNode?.day || ''}
                onChange={(e) => setEditedNode(prev => prev ? { ...prev, day: e.target.value } : null)}
                placeholder="e.g., Monday, Tuesday..."
              />
            ) : (
              <div className="text-sm text-muted-foreground">{node.day || 'No day specified'}</div>
            )}
          </Card>

          <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
            <h3 className="text-sm font-medium mb-2">Post Type</h3>
            {isEditing ? (
              <Select
                value={editedNode?.postType || 'branding'}
                onValueChange={(value: 'engaging' | 'promotional' | 'branding') => 
                  setEditedNode(prev => prev ? { ...prev, postType: value } : null)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engaging">🟢 Engaging</SelectItem>
                  <SelectItem value="promotional">🔵 Promotional</SelectItem>
                  <SelectItem value="branding">🟡 Branding</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground capitalize">
                {node.postType === 'engaging' && '🟢 Engaging'}
                {node.postType === 'promotional' && '🔵 Promotional'}
                {node.postType === 'branding' && '🟡 Branding'}
                {!node.postType && 'Not specified'}
              </div>
            )}
          </Card>
        </div>

        {/* Template Color Palette */}
        <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
          <h3 className="text-sm font-medium mb-2">Template Color</h3>
          <div className="text-xs text-muted-foreground mb-2">
            Current template color for image generation:
          </div>
          {(() => {
            const template = getTemplateSettings();
            const color = template?.selectedColor;
            
            if (!color || color === 'transparent') {
              return (
                <div className="text-sm text-muted-foreground">No color selected</div>
              );
            }
            
            return (
              <div className="w-8 h-8 rounded border border-border/20 shadow-sm"
                style={{ backgroundColor: color }}
              />
            );
          })()}
        </Card>

        {/* Image URL */}
        <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Image URL</h3>
            {!isEditing && (node.imagePrompt || node.title || node.content) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className="h-7 px-2 text-xs"
              >
                {isGeneratingImage ? (
                  <>
                    <div className="w-3 h-3 border border-primary/20 border-t-primary rounded-full animate-spin mr-1" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Generate
                  </>
                )}
              </Button>
            )}
          </div>
          {isEditing ? (
            <Input
              value={editedNode?.imageUrl || ''}
              onChange={(e) => setEditedNode(prev => prev ? { ...prev, imageUrl: e.target.value } : null)}
              placeholder="https://example.com/image.jpg"
            />
          ) : (
            <div className="space-y-2">
              {(node.imageUrl || node.imageUrls) ? (() => {
                // Combine all images into one array for display
                const allImages = [];
                if (node.imageUrls && node.imageUrls.length > 0) {
                  allImages.push(...node.imageUrls);
                }
                if (node.imageUrl && !allImages.includes(node.imageUrl)) {
                  allImages.push(node.imageUrl);
                }
                
                return (
                  <>
                    <div className="text-xs text-muted-foreground">
                      Generated Images ({allImages.length}) - Click to select:
                    </div>
                    <div className="overflow-x-auto">
                      <div className="flex gap-2 pb-2" style={{ minWidth: 'fit-content' }}>
                        {allImages.map((imageUrl, index) => (
                          <Dialog key={`${imageUrl}-${index}`}>
                            <div 
                              className={`relative group cursor-pointer flex-shrink-0 ${
                                (editedNode?.imageUrl || node.imageUrl) === imageUrl ? 'ring-2 ring-primary' : ''
                              }`}
                              onClick={() => {
                                const updatedNode = { ...node, imageUrl: imageUrl };
                                setEditedNode(updatedNode);
                                if (onSaveNode) {
                                  onSaveNode(updatedNode);
                                }
                              }}
                            >
                              <img 
                                src={imageUrl} 
                                alt={`Generated content ${index + 1}`} 
                                className="w-[140px] h-[140px] object-cover rounded border border-border/20 hover:opacity-80 transition-opacity shadow-sm"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                                {index + 1}
                              </div>
                              {(editedNode?.imageUrl || node.imageUrl) === imageUrl && (
                                <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-1 rounded">
                                  ✓
                                </div>
                              )}
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="absolute bottom-1 right-1 h-6 w-6 p-0 bg-black/70 hover:bg-black/90 text-white border-white/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              </DialogTrigger>
                            </div>
                            <DialogContent className="max-w-4xl w-full p-0 bg-black/90">
                              <DialogTitle className="sr-only">Full Size Image View</DialogTitle>
                              <div className="relative">
                                <img 
                                  src={imageUrl} 
                                  alt={`Generated content ${index + 1} - Full size`} 
                                  className="w-full h-auto max-h-[90vh] object-contain"
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })() : (
                <div className="text-sm text-muted-foreground">No images generated</div>
              )}
            </div>
          )}
        </Card>

        {/* Image Prompt */}
        <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Image Prompt</h3>
            {!isEditing && (node.title || node.content) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGeneratePrompt}
                disabled={isGeneratingPrompt}
                className="h-7 px-2 text-xs"
              >
                {isGeneratingPrompt ? (
                  <>
                    <div className="w-3 h-3 border border-primary/20 border-t-primary rounded-full animate-spin mr-1" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Enhance
                  </>
                )}
              </Button>
            )}
          </div>
          {isEditing ? (
            <Textarea
              value={editedNode?.imagePrompt || ''}
              onChange={(e) => setEditedNode(prev => prev ? { ...prev, imagePrompt: e.target.value } : null)}
              className="min-h-[80px] text-sm"
              placeholder="Enter image prompt..."
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              {(editedNode?.imagePrompt || node.imagePrompt) || 'No image prompt'}
            </div>
          )}
        </Card>

        {/* Scheduled Date */}
        <Card className="p-4 bg-card/50 backdrop-blur-sm border-border/50">
          <h3 className="font-medium mb-3">Scheduled Date</h3>
          {isEditing ? (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {editedNode?.scheduledDate ? (
                    format(editedNode.scheduledDate, "PPP 'at' p")
                  ) : (
                    <span>Pick a date and time</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 space-y-3">
                  <CalendarComponent
                    mode="single"
                    selected={editedNode?.scheduledDate}
                    onSelect={(date) => {
                      if (date) {
                        const [hours, minutes] = selectedTime.split(':');
                        const newDate = new Date(date);
                        newDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                        console.log('NodeDetails: Calendar date selected:', date, 'with time:', selectedTime, 'result:', newDate);
                        setEditedNode(prev => prev ? { ...prev, scheduledDate: newDate } : null);
                      }
                    }}
                    initialFocus
                  />
                  <div className="border-t pt-3">
                    <label className="text-sm font-medium mb-2 block">Time</label>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTime('09:00');
                          if (editedNode?.scheduledDate) {
                            const newDate = new Date(editedNode.scheduledDate);
                            newDate.setHours(9, 0, 0, 0);
                            setEditedNode(prev => prev ? { ...prev, scheduledDate: newDate } : null);
                          }
                        }}
                        className={selectedTime === '09:00' ? 'bg-primary text-primary-foreground' : ''}
                      >
                        9:00 AM
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTime('12:00');
                          if (editedNode?.scheduledDate) {
                            const newDate = new Date(editedNode.scheduledDate);
                            newDate.setHours(12, 0, 0, 0);
                            setEditedNode(prev => prev ? { ...prev, scheduledDate: newDate } : null);
                          }
                        }}
                        className={selectedTime === '12:00' ? 'bg-primary text-primary-foreground' : ''}
                      >
                        12:00 PM
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTime('18:00');
                          if (editedNode?.scheduledDate) {
                            const newDate = new Date(editedNode.scheduledDate);
                            newDate.setHours(18, 0, 0, 0);
                            setEditedNode(prev => prev ? { ...prev, scheduledDate: newDate } : null);
                          }
                        }}
                        className={selectedTime === '18:00' ? 'bg-primary text-primary-foreground' : ''}
                      >
                        6:00 PM
                      </Button>
                    </div>
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => {
                        setSelectedTime(e.target.value);
                        if (editedNode?.scheduledDate) {
                          const [hours, minutes] = e.target.value.split(':');
                          const newDate = new Date(editedNode.scheduledDate);
                          newDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                          setEditedNode(prev => prev ? { ...prev, scheduledDate: newDate } : null);
                        }
                      }}
                      className="mb-3"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditedNode(prev => prev ? { ...prev, scheduledDate: undefined } : null);
                          setCalendarOpen(false);
                        }}
                        className="flex-1"
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setCalendarOpen(false)}
                        className="flex-1"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="text-sm text-muted-foreground">
              {node.scheduledDate ? node.scheduledDate.toLocaleString() : 'No scheduled date'}
            </div>
          )}
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="border-t border-border/20 p-3 bg-card/50">
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                onClick={() => {
                  if (editedNode && onSaveNode) {
                    console.log('=== NODE DETAILS SAVE DEBUG ===');
                    console.log('NodeDetails: Save Changes clicked');
                    console.log('Original node:', node);
                    console.log('Original node scheduledDate:', node.scheduledDate);
                    console.log('Edited node:', editedNode);
                    console.log('Edited node scheduledDate:', editedNode.scheduledDate);
                    console.log('=== END NODE DETAILS SAVE DEBUG ===');
                    onSaveNode(editedNode);
                    setIsEditing(false);
                  }
                }}
                className="bg-gradient-primary hover:opacity-90 flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditedNode({ ...node });
                  setIsEditing(false);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="border-primary/20 hover:border-primary/40 flex-1"
              >
                Edit Node
              </Button>
              {onPostNode && (
                <Button
                  onClick={async () => {
                    if (!node.scheduledDate) {
                      alert('Please set a scheduled date first by editing the node.');
                      return;
                    }
                    
                    try {
                      // Schedule this individual node through AppSync
                      console.log('Scheduling individual node:', {
                        id: node.id,
                        title: node.title,
                        scheduledDate: node.scheduledDate?.toISOString(),
                        imageUrl: node.imageUrl,
                        imageUrls: node.imageUrls
                      });
                      
                      const result = await scheduleService.createSchedules([{
                        id: node.id,
                        nodeId: node.id,
                        projectId: 'demo-project-123',
                        title: node.title,
                        description: node.content,
                        type: node.type,
                        imageUrl: node.imageUrl,
                        imageUrls: node.imageUrls,
                        scheduledDate: node.scheduledDate.toISOString(),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                      }]);
                      
                      console.log('Schedule result:', result);
                      
                      if (result.ok) {
                        // Update node status to scheduled
                        const updatedNode = {
                          ...node,
                          status: 'scheduled' as const
                        };
                        onPostNode(updatedNode);
                      } else {
                        alert('Failed to schedule node. Please try again.');
                      }
                    } catch (error) {
                      console.error('Error scheduling node:', error);
                      alert('Failed to schedule node: ' + error.message);
                    }
                  }}
                  className="text-white shadow-lg transition-colors flex-1"
                  style={{backgroundColor: '#03624C'}}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2CC295'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#03624C'}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Schedule Now
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};