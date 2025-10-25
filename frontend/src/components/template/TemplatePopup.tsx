import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Check, Palette } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface TemplatePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

type LogoPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';



export const TemplatePopup: React.FC<TemplatePopupProps> = ({ isOpen, onClose }) => {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<LogoPosition>('top-left');
  const [selectedColor, setSelectedColor] = useState<string>('#3b82f6');
  const [useColorTemplate, setUseColorTemplate] = useState<boolean>(true);
  const [companyText, setCompanyText] = useState<string>('');
  const [textColor, setTextColor] = useState<string>('#000000');
  const [textSize, setTextSize] = useState<number>(24);
  const [textPosition, setTextPosition] = useState<'above' | 'below' | 'left' | 'right'>('below');
  const [textAlignment, setTextAlignment] = useState<'left' | 'center' | 'right'>('center');

  // Load from localStorage on component mount
  useEffect(() => {
    const savedTemplate = localStorage.getItem('brewpost-template');
    if (savedTemplate) {
      const template = JSON.parse(savedTemplate);
      if (template.logoPreview) setLogoPreview(template.logoPreview);
      if (template.selectedPosition) setSelectedPosition(template.selectedPosition);
      if (template.selectedColor) {
        setSelectedColor(template.selectedColor === 'transparent' ? '#3b82f6' : template.selectedColor);
        setUseColorTemplate(template.selectedColor !== 'transparent');
      }
      if (template.companyText) setCompanyText(template.companyText);
      if (template.textColor) setTextColor(template.textColor);
      if (template.textSize) setTextSize(template.textSize);
      if (template.textPosition) setTextPosition(template.textPosition);
      if (template.textAlignment) setTextAlignment(template.textAlignment);
    }
  }, []);

  // Save to localStorage whenever values change
  useEffect(() => {
    const templateData = {
      logoPreview,
      selectedPosition,
      selectedColor: useColorTemplate ? selectedColor : 'transparent',
      companyText,
      textColor,
      textSize,
      textPosition,
      textAlignment
    };
    localStorage.setItem('brewpost-template', JSON.stringify(templateData));
  }, [logoPreview, selectedPosition, selectedColor, useColorTemplate, companyText, textColor, textSize, textPosition, textAlignment]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const positions: { id: LogoPosition; label: string; style: string }[] = [
    { id: 'top-left', label: 'Top Left', style: 'top-2 left-2' },
    { id: 'top-center', label: 'Top Center', style: 'top-2 left-1/2 -translate-x-1/2' },
    { id: 'top-right', label: 'Top Right', style: 'top-2 right-2' },
    { id: 'bottom-left', label: 'Bottom Left', style: 'bottom-2 left-2' },
    { id: 'bottom-center', label: 'Bottom Center', style: 'bottom-2 left-1/2 -translate-x-1/2' },
    { id: 'bottom-right', label: 'Bottom Right', style: 'bottom-2 right-2' },
  ];

  const handleSave = () => {
    // Template data is already being saved to localStorage via useEffect
    // Just show success message and close
    console.log('Template saved:', { 
      logoPreview, 
      selectedPosition, 
      selectedColor: useColorTemplate ? selectedColor : 'transparent',
      companyText,
      textColor,
      textSize,
      textPosition,
      textAlignment
    });
    
    // Show success message with toast
    toast.success('Template saved successfully! Your template will be applied to all future generated images.', {
      duration: 4000,
      style: {
        background: 'rgba(3, 98, 76, 0.95)',
        color: '#00DF81',
        border: '1px solid rgba(44, 194, 149, 0.3)',
      },
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] flex flex-col border-[#03624C]/50" 
        style={{backgroundColor: 'rgba(3, 34, 33, 0.95)', backdropFilter: 'blur(12px)'}}
      >
        <DialogHeader>
          <DialogTitle className="text-white">Create Template</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 overflow-y-auto flex-1 pr-2">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label htmlFor="logo-upload" className="text-[#00DF81]">Upload Logo</Label>
            <div className="flex items-center gap-4">
              <Input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="flex-1"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => document.getElementById('logo-upload')?.click()}
                className="border-[#03624C]/50 text-[#00DF81] transition-colors hover:bg-[#03624C]/20 hover:border-[#2CC295]/70"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            </div>
            {logoPreview && (
              <div className="mt-2 relative inline-block group">
                <img src={logoPreview} alt="Logo preview" className="w-16 h-16 object-contain border rounded" />
                <button
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Position Selection */}
          <div className="space-y-3">
            <Label className="text-[#00DF81]">Logo Position</Label>
            <div className="relative w-full h-48 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg">
              {positions.map((position) => (
                <button
                  key={position.id}
                  onClick={() => setSelectedPosition(position.id)}
                  className={`absolute w-8 h-8 rounded-full border-2 transition-all ${position.style}`}
                  style={{
                    backgroundColor: selectedPosition === position.id ? '#03624C' : 'white',
                    borderColor: selectedPosition === position.id ? '#03624C' : '#9CA3AF',
                    transform: selectedPosition === position.id ? 'scale(1.1)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedPosition !== position.id) {
                      e.currentTarget.style.borderColor = '#2CC295';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedPosition !== position.id) {
                      e.currentTarget.style.borderColor = '#9CA3AF';
                    }
                  }}
                  title={position.label}
                />
              ))}
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Logo position preview"
                  className={`absolute w-12 h-12 object-contain ${
                    positions.find(p => p.id === selectedPosition)?.style
                  }`}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Selected: {positions.find(p => p.id === selectedPosition)?.label}
            </p>
          </div>

          {/* Company Text */}
          <div className="space-y-3">
            <Label className="text-[#00DF81]">Company Text</Label>
            <Input
              value={companyText}
              onChange={(e) => setCompanyText(e.target.value)}
              placeholder="Enter company name or text"
            />
            {companyText && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="text-color" className="text-sm text-[#00DF81]">Text Color</Label>
                  <input
                    id="text-color"
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-full h-8 rounded border border-gray-300 cursor-pointer mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="text-size" className="text-sm text-[#00DF81]">Size</Label>
                  <Input
                    id="text-size"
                    type="number"
                    value={textSize}
                    onChange={(e) => setTextSize(Number(e.target.value))}
                    min="12"
                    max="72"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm text-[#00DF81]">Position</Label>
                  <Select value={textPosition} onValueChange={setTextPosition}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above Logo</SelectItem>
                      <SelectItem value="below">Below Logo</SelectItem>
                      <SelectItem value="left">Left of Logo</SelectItem>
                      <SelectItem value="right">Right of Logo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-[#00DF81]">Alignment</Label>
                  <Select value={textAlignment} onValueChange={setTextAlignment}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Template Color */}
          <div className="space-y-3">
            <Label className="text-[#00DF81]">Template Color</Label>
            <div className="flex items-center space-x-2 mb-3">
              <Checkbox
                id="use-color"
                checked={useColorTemplate}
                onCheckedChange={setUseColorTemplate}
              />
              <Label htmlFor="use-color" className="text-sm text-[#00DF81]">Use color template</Label>
            </div>
            {useColorTemplate && (
              <div className="flex items-center gap-3">
                <Label htmlFor="custom-color" className="text-sm text-[#00DF81]">Color:</Label>
                <input
                  id="custom-color"
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="border-[#03624C]/50 text-[#00DF81] transition-colors hover:bg-[#03624C]/20 hover:border-[#2CC295]/70"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              className="text-white shadow-lg transition-colors"
              style={{backgroundColor: '#03624C'}}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2CC295'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#03624C'}
            >
              Save Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};