import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Target, Eye, Zap } from 'lucide-react';
import { format } from 'date-fns';

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

interface AddNodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNode: (node: Omit<ContentNode, 'id' | 'connections'>) => void;
}

export const AddNodeModal: React.FC<AddNodeModalProps> = ({
  open,
  onOpenChange,
  onAddNode
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'post' | 'image' | 'story'>('post');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published'>('draft');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState('09:00');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newNode = {
      title: title.trim(),
      content: content.trim(),
      type,
      status,
      scheduledDate: status === 'scheduled' ? scheduledDate : undefined,
      imageUrl: undefined,
      position: {
        x: Math.random() * 300 + 50,
        y: Math.random() * 200 + 50
      }
    };

    onAddNode(newNode);
    
    // Reset form
    setTitle('');
    setContent('');
    setType('post');
    setStatus('draft');
    setScheduledDate(undefined);
    setCalendarOpen(false);
    setSelectedTime('09:00');
    onOpenChange(false);
  };

  const getTypeIcon = (nodeType: 'post' | 'image' | 'story') => {
    switch (nodeType) {
      case 'post': return Target;
      case 'image': return Eye;
      case 'story': return Zap;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            Add New Content Node
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter content title"
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your content idea..."
              className="mt-1 min-h-[80px]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(value: any) => setType(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Social Media Post
                    </div>
                  </SelectItem>
                  <SelectItem value="image">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Image/Visual
                    </div>
                  </SelectItem>
                  <SelectItem value="story">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Story/Reel
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {status === 'scheduled' && (
            <div>
              <Label>Schedule Date & Time</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full mt-1 justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? (
                      format(scheduledDate, "PPP 'at' p")
                    ) : (
                      <span>Pick a date and time</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 space-y-3">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={(date) => {
                        if (date) {
                          const [hours, minutes] = selectedTime.split(':');
                          const newDate = new Date(date);
                          newDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                          setScheduledDate(newDate);
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
                            if (scheduledDate) {
                              const newDate = new Date(scheduledDate);
                              newDate.setHours(9, 0, 0, 0);
                              setScheduledDate(newDate);
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
                            if (scheduledDate) {
                              const newDate = new Date(scheduledDate);
                              newDate.setHours(12, 0, 0, 0);
                              setScheduledDate(newDate);
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
                            if (scheduledDate) {
                              const newDate = new Date(scheduledDate);
                              newDate.setHours(18, 0, 0, 0);
                              setScheduledDate(newDate);
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
                          if (scheduledDate) {
                            const [hours, minutes] = e.target.value.split(':');
                            const newDate = new Date(scheduledDate);
                            newDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                            setScheduledDate(newDate);
                          }
                        }}
                        className="mb-3"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setScheduledDate(undefined);
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
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="flex-1 bg-gradient-primary hover:opacity-90"
            >
              Add Node
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};