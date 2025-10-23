"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Minus, Sparkles } from "lucide-react"
import { ComponentSidebar } from "./ComponentSidebar"
import { enhanceImagePromptWithTemplate, applyTemplateToImage, applyComponentsToImage, getTemplateSettings } from '@/utils/templateUtils'
import { useState, useRef, useEffect } from 'react'

interface SelectedComponent {
  id: string
  name: string
  category: string
  color: string
  position: { x: number; y: number }
}

interface CampaignComponent {
  id: string
  type: "online_trend" | "campaign_type" | "promotion_type"
  title: string
  description: string
  data?: unknown
  relevanceScore: number
  category: string
  keywords: string[]
  impact: "high" | "medium" | "low"
}

interface Component {
  id: string
  name: string
  title?: string
  category: string
  color: string
}

interface CircleCanvasProps {
  selectedComponents?: SelectedComponent[]
  onRemoveComponent?: (id: string) => void
  isGenerating?: boolean | string
  onGenerate?: (status: string) => void
  showPreview?: boolean
  onForecastAnalysisClick?: () => void
  generatedComponents?: CampaignComponent[]
  onAddComponent?: (component: Component) => void
  selectedNode?: {
    id: string
    title?: string
    content?: string
    imagePrompt?: string
    imageUrl?: string
    imageUrls?: string[]
    scheduledDate?: Date | string
  }
  onSaveNode?: (node: { id: string; imageUrl?: string; imageUrls?: string[]; scheduledDate?: Date | string; title?: string; content?: string }) => void // Add support for saving node updates
}

export function CircleCanvas({
  selectedComponents: propSelectedComponents = [],
  onRemoveComponent = () => {},
  isGenerating = false,
  onGenerate = () => {},
  showPreview = false,
  onForecastAnalysisClick,
  generatedComponents = [],
  onAddComponent = () => {},
  selectedNode,
  onSaveNode = () => {},
}: CircleCanvasProps) {
  // Use props instead of local state for selectedComponents
  const selectedComponents = propSelectedComponents;

  const handleAddComponent = (component: Component) => {
    onAddComponent(component);
  };

  const handleRemoveComponent = (id: string) => {
    onRemoveComponent(id);
  };
  
  // Add custom CSS for abstract spinning animations during generation
  const customStyles = `
    @keyframes orbit-spin {
      from { transform: translate(-50%, -50%) rotate(0deg) translateX(20px) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(360deg) translateX(20px) rotate(-360deg); }
    }
    @keyframes wobble-spin {
      0%, 100% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
      25% { transform: translate(-50%, -50%) rotate(90deg) scale(1.1); }
      50% { transform: translate(-50%, -50%) rotate(180deg) scale(0.95); }
      75% { transform: translate(-50%, -50%) rotate(270deg) scale(1.05); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes morph {
      0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
      20% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
      40% { border-radius: 50% 60% 30% 60% / 30% 60% 70% 40%; }
      60% { border-radius: 60% 30% 60% 40% / 40% 70% 60% 50%; }
      80% { border-radius: 40% 70% 60% 50% / 60% 40% 30% 70%; }
    }
    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes liquid-float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out;
    }
    .animate-morph {
      animation: morph 4s ease-in-out infinite;
    }
    .animate-spin-slow {
      animation: spin-slow 8s linear infinite;
    }
    .animate-liquid-float {
      animation: liquid-float 3s ease-in-out infinite;
    }
    .animate-float {
      animation: float 3s ease-in-out infinite;
    }
    .gradient-cyan-teal {
      background: linear-gradient(135deg, #78FFD6, #3BC6FF);
    }
    .gradient-teal-blue {
      background: linear-gradient(135deg, #6EF3FF, #00D4FF);
    }
    .gradient-blue-cyan {
      background: linear-gradient(135deg, #3BC6FF, #78FFD6);
    }
  `
  
  const handleGenerateFromNode = async (components: SelectedComponent[] = []) => {
    if (!selectedNode) return;

    console.log('🔥 Generate from node clicked!', selectedNode.title);
    onGenerate("GENERATING");

    try {
      const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ?? 'http://localhost:5044';

      // Combine node-level image prompt with selected component names for richer guidance
      const compNames = (components || []).map(c => c.name).join(', ');
      const basePrompt = selectedNode.imagePrompt || selectedNode.title || selectedNode.content || '';
      const combinedPrompt = compNames ? `${basePrompt}. Include visual elements: ${compNames}` : basePrompt;

      // Enhance prompt with template settings (if user has a template configured) before sending
      let promptToSend = combinedPrompt;
      try {
        promptToSend = enhanceImagePromptWithTemplate(combinedPrompt);
        // If template has a dominant color, emphasize it
        const tpl = getTemplateSettings();
        if (tpl?.selectedColor && tpl.selectedColor !== 'transparent') {
          promptToSend += ` Make sure to prominently feature ${tpl.selectedColor} color throughout the entire image composition, use it for backgrounds, accents, and key visual elements.`;
        }
      } catch (e) {
        console.debug('Failed to enhance prompt with template', e);
        promptToSend = combinedPrompt;
      }

      const response = await fetch(`${BACKEND_URL}/api/canvas-generate-from-node`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: selectedNode.id,
          imagePrompt: promptToSend,
          title: selectedNode.title,
          content: selectedNode.content,
          components: components.map(c => ({ id: c.id, name: c.name, title: (c as unknown as { title?: string }).title, category: c.category, type: (c as unknown as { type?: string }).type, color: c.color }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      if (data.ok && data.imageUrl) {
        console.log('✅ Node image generation completed successfully:', data.imageUrl);
        // Apply template overlay on client if configured (mirrors NodeDetails behavior)
        let processedImageUrl = data.imageUrl;
        try {
          processedImageUrl = await applyTemplateToImage(data.imageUrl);
        } catch (e) {
          console.warn('Failed to apply template to generated image, using original URL', e);
        }

        // Apply UI components (e.g., promotion badge) on top of the templated image
        try {
          const compList: SelectedComponent[] = components as SelectedComponent[] || [];
          const mapped = compList.map(c => ({ id: c.id, name: c.name, title: undefined, category: c.category, color: c.color, position: c.position }));
          processedImageUrl = await applyComponentsToImage(processedImageUrl, mapped);
        } catch (e) {
          console.warn('Failed to apply components to image, continuing with templated image', e);
        }

  onGenerate(processedImageUrl); // Show processed image in canvas

        // Add new image to imageUrls array (same logic as NodeDetails)
        const existingImages = selectedNode.imageUrls || [];
        const updatedNode = {
          ...selectedNode,
          imageUrls: [...existingImages, processedImageUrl],
          imageUrl: processedImageUrl // Keep for backward compatibility
        };
        onSaveNode(updatedNode);

        console.log('Total images after canvas generation:', updatedNode.imageUrls.length);
      } else {
        throw new Error('No image URL returned');
      }
    } catch (error) {
      console.error('Error generating image from node:', error);
      onGenerate("ERROR");
      setTimeout(() => onGenerate("RESET"), 3000);
    }
  };

  const handleGenerateImage = async () => {
    // If we have a selected node, generate from node and include selected components
    if (selectedNode && (selectedNode.imagePrompt || selectedNode.title || selectedNode.content || selectedComponents.length > 0)) {
      return handleGenerateFromNode(selectedComponents);
    }
    
    console.log('🔥 Generate button clicked!');
    console.log('📊 Selected components:', selectedComponents);
    console.log('🎯 Components length:', selectedComponents.length);
    
    if (selectedComponents.length === 0) {
      console.log('❌ No components selected, stopping generation');
      return;
    }

    console.log('✅ Starting generation process...');
    // Start generating state
    onGenerate("GENERATING")
    
    try {
      // Create prompt from selected components
      const componentNames = selectedComponents.map(c => c.name).join(', ');
      const prompt = `Create a professional social media promotional image incorporating these elements: ${componentNames}. Modern design, vibrant colors, social media ready, high quality`;
      
      console.log('🎨 Starting Nova Canvas image generation with prompt:', prompt);
      
      const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ?? 'http://localhost:5044';
      
      const response = await fetch(`${BACKEND_URL}/api/generate-image-nova`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      if (data.ok && data.imageUrl) {
        console.log('✅ Nova Canvas image generation completed successfully:', data.imageUrl);
        onGenerate(data.imageUrl); // Pass the image URL to show in canvas
      } else {
        throw new Error('No image URL returned from Nova Canvas');
      }
      
    } catch (error) {
      console.error('Error generating image:', error)
      // Reset generating state on error
      onGenerate("ERROR")
      // Reset to normal state after 3 seconds
      setTimeout(() => onGenerate("RESET"), 3000)
    }
  }

  // Drag-after-generation state for promo placement
  const [isPlacingPromo, setIsPlacingPromo] = useState(false);
  const [promoPos, setPromoPos] = useState<{ x: number; y: number } | null>(null); // normalized 0..1
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Start placement: initialize from existing selectedNode component if present
  const startPromoPlacement = () => {
    if (!selectedNode) return;
    const promoComp = (selectedComponents || []).find(c => /%|off|discount|promo/i.test(String(c.name)) || (c.category && c.category.toLowerCase().includes('promotion')));
    if (!promoComp) return;
    // use any existing saved position on node.imageUrl mapping or component position if present
  const existingPos = (promoComp as unknown as { position?: { x?: number; y?: number } }).position;
    if (existingPos && typeof existingPos.x === 'number' && typeof existingPos.y === 'number') {
      if (existingPos.x > 0 && existingPos.x <= 1 && existingPos.y > 0 && existingPos.y <= 1) {
        setPromoPos({ x: existingPos.x, y: existingPos.y });
      } else {
        setPromoPos({ x: 0.9, y: 0.1 });
      }
    } else {
      setPromoPos({ x: 0.85, y: 0.12 }); // default top-right-ish
    }
    setIsPlacingPromo(true);
  };

  // Drag handlers
  useEffect(() => {
    let dragging = false;
  const offset = { dx: 0, dy: 0 };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging || !canvasRef.current || !promoPos) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      setPromoPos({ x, y });
    };
    const onMouseUp = () => { dragging = false; };
    const el = document;
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup', onMouseUp);
    };
  }, [promoPos]);

  const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  const savePromoPosition = async () => {
    if (!selectedNode || !promoPos) return;
    // find promo component and attach position
    const promoCompIndex = selectedComponents.findIndex(c => /%|off|discount|promo/i.test(String(c.name)) || (c.category && c.category.toLowerCase().includes('promotion')));
    if (promoCompIndex === -1) return;
    const promoComp = selectedComponents[promoCompIndex];
    // persist to component (here we call onSaveNode to save node-level imageUrls updated and component position)
    const normalized = { x: promoPos.x, y: promoPos.y };
    // Update the in-memory component and node, then call onSaveNode
    const updatedComp = { ...promoComp, position: normalized };
    const updatedComponents = [...selectedComponents];
    updatedComponents[promoCompIndex] = updatedComp;

    // Re-run composition to generate final image dataURL with positioned badge
    try {
      const processed = await applyTemplateToImage(selectedNode.imageUrl || '');
      const mapped = updatedComponents.map(c => ({ id: c.id, name: c.name, category: c.category, color: c.color, position: c.position }));
      const finalData = await applyComponentsToImage(processed, mapped);
      const existingImages = selectedNode.imageUrls || [];
      const updatedNode = {
        ...selectedNode,
        imageUrls: [...existingImages, finalData],
        imageUrl: finalData
      };
      // attach component positions into node content if desired (simple persistence)
      // Note: this onSaveNode should persist the component positions in your application's state/store
      onSaveNode(updatedNode);
    } catch (e) {
      console.warn('Failed to save promo position and recompose image', e);
    }

    setIsPlacingPromo(false);
  };

  const cancelPromoPlacement = () => {
    setIsPlacingPromo(false);
    setPromoPos(null);
  };

  return (
    <div className="flex-1 flex flex-col transition-all duration-300 ease-out">
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      
      {/* Main Canvas Area */}
      <div className="flex-1 p-4 relative flex items-start justify-center pt-20">
        {/* Background gradient blob */}
        <div className="absolute inset-[-30px] flex items-start justify-center pt-16 pointer-events-none">
          <div
            className={[
              "w-[240px] h-[240px] rounded-full bg-gradient-to-br from-cyan-400/20 via-teal-400/15 to-blue-400/20 opacity-25 blur-[40px]",
              isGenerating ? "animate-pulse animate-spin" : "",
            ].join(" ")}
            style={isGenerating ? {
              animationDuration: '2s, 8s',
              transform: 'scale(1.1)',
            } : {}}
          />
          {isGenerating && (
            <>
              <div className="absolute w-[144px] h-[144px] rounded-full bg-gradient-to-r from-cyan-300/10 to-teal-300/10 blur-[30px] animate-spin [animation-duration:6s] [animation-direction:reverse]" />
              <div className="absolute w-[288px] h-[288px] rounded-full bg-gradient-to-r from-blue-300/5 to-cyan-300/5 blur-[50px] animate-pulse [animation-duration:3s]" />
            </>
          )}
        </div>

        {/* Central campaign area */}
        <div className="relative flex items-center justify-center">
        <div className="relative transition-all duration-300 ease-out">
          <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Outer spinning ring */}
            <div
              className={[
                "absolute inset-[-20px]",
                "rounded-[70%30%_40%_60%/_50%_70%_30%_50%]",
                "backdrop-blur-[40px] border",
                isGenerating
                  ? [
                      "animate-spin animate-pulse animate-morph",
                      "bg-[linear-gradient(135deg,rgba(255,100,200,0.6),rgba(100,200,255,0.5),rgba(200,100,255,0.6))]",
                      "border-pink-400/50",
                      "shadow-[0_20px_60px_rgba(255,100,200,0.8),inset_0_2px_0_rgba(255,255,255,0.4)]",
                    ].join(" ")
                  : [
                      "animate-spin-slow animate-morph",
                      "bg-[linear-gradient(135deg,rgba(120,255,214,0.3),rgba(59,198,255,0.25),rgba(110,243,255,0.3))]",
                      "border-cyan-300/20",
                      "shadow-[0_12px_48px_rgba(59,198,255,0.4),inset_0_2px_0_rgba(255,255,255,0.2)]",
                    ].join(" "),
              ].join(" ")}
              style={isGenerating ? { animationDuration: '2s, 1s, 3s' } : {}}
            />

            {/* Primary Liquid Glass Effects */}
            <div
              className={[
                "absolute inset-[-15px]",
                "rounded-[60%40%_30%_70%/_60%_30%_70%_40%]",
                "backdrop-blur-[30px] border",
                isGenerating
                  ? [
                      "bg-[linear-gradient(135deg,rgba(255,150,200,0.5),rgba(150,100,255,0.4),rgba(100,200,255,0.5))]",
                      "border-purple-400/30",
                      "shadow-[0_15px_40px_rgba(255,150,200,0.7),inset_0_1px_0_rgba(255,255,255,0.3)]",
                      "animate-spin animate-morph animate-pulse",
                    ].join(" ")
                  : [
                      "bg-[linear-gradient(135deg,rgba(59,198,255,0.3),rgba(110,243,255,0.25),rgba(120,255,214,0.3))]",
                      "border-cyan-300/15",
                      "shadow-[0_8px_32px_rgba(59,198,255,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]",
                      "animate-morph animate-liquid-float",
                    ].join(" "),
              ].join(" ")}
              style={isGenerating ? { animationDuration: '3s, 2s, 1.5s', animationDirection: 'reverse' } : {}}
            />

            {/* Secondary liquid glass layer */}
            <div
              className={[
                "absolute inset-[-8px]",
                "rounded-[40%60%_70%_30%/_40%_70%_30%_60%]",
                "backdrop-blur-md border",
                "bg-[linear-gradient(45deg,rgba(110,243,255,0.25),rgba(120,255,214,0.2),rgba(0,212,255,0.25))]",
                "border-cyan-300/10",
                "shadow-[0_4px_16px_rgba(110,243,255,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]",
                isGenerating ? "animate-spin animate-morph animate-bounce" : "animate-morph",
              ].join(" ")}
              style={isGenerating ? { animationDuration: '4s, 2.5s, 2s', animationDirection: 'alternate' } : {}}
            />

            {/* Inner spinning accent ring */}
            <div
              className={[
                "absolute inset-[3px]",
                "rounded-[50%40%_60%_50%/_40%_60%_40%_60%]",
                "border border-cyan-300/10 backdrop-blur-[15px]",
                "bg-[linear-gradient(225deg,rgba(120,255,214,0.2),rgba(0,212,255,0.15),rgba(110,243,255,0.2))]",
                "shadow-[0_2px_12px_rgba(120,255,214,0.25)]",
                isGenerating
                  ? "animate-spin animate-morph animate-pulse [animation-direction:reverse]"
                  : "animate-morph animate-spin-slow [animation-direction:reverse]",
              ].join(" ")}
              style={isGenerating ? { 
                animationDuration: '1s, 1.5s, 0.8s',
                transform: 'rotate(0deg) scale(1.05)'
              } : {}}
            />

            {/* Inner glass orb - only show when no image */}
            {!(typeof isGenerating === 'string' && isGenerating.startsWith('data:image')) && (
              <div
                className={[
                  "absolute inset-[12px] rounded-full backdrop-blur-md",
                  "bg-[linear-gradient(135deg,rgba(255,255,255,0.2),rgba(120,255,214,0.08),rgba(110,243,255,0.06))]",
                  "border border-cyan-300/20",
                  "shadow-[0_4px_16px_rgba(120,255,214,0.15),inset_0_2px_0_rgba(255,255,255,0.3)]",
                ].join(" ")}
              />
            )}

            <div className="relative z-10 text-center w-full h-full flex items-center justify-center">
              {typeof isGenerating === 'string' && isGenerating.startsWith('data:image') ? (
                <div 
                  className="w-32 h-32 rounded-full overflow-hidden cursor-pointer hover:scale-105 hover:shadow-3xl transition-all duration-500 shadow-2xl border-2 border-white/40 backdrop-blur-sm relative group"
                  onClick={() => {
                    console.log('🖼 Image clicked, showing preview for:', isGenerating)
                    // Show preview layout instead of modal
                    onGenerate(`PREVIEW:${isGenerating}`)
                  }}
                >
                  <img 
                    src={isGenerating as string} 
                    alt="Generated Campaign" 
                    className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                    <div className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                      Click to preview
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <h3 
                    className={[
                      "text-lg font-semibold drop-shadow-lg backdrop-blur-sm cursor-pointer transition-all duration-300 text-center",
                      isGenerating === "GENERATING" 
                        ? "text-pink-200 animate-pulse" 
                        : "text-white hover:text-blue-200"
                    ].join(" ")}
                    onClick={() => onForecastAnalysisClick?.()}
                  >
                    {isGenerating === "GENERATING" ? "Generating..." : 
                     selectedNode ? selectedNode.title.length > 20 ? selectedNode.title.slice(0, 20) + '...' : selectedNode.title :
                     selectedComponents.length > 0 ? "Analyze" : "BrewPost Canvas"}
                  </h3>

                </>
              )}
            </div>
          </div>

          {selectedComponents.map((component, index) => {
            // Ensure minimum spacing between components to prevent overlap
            const minAngleSpacing = Math.max(30, 360 / Math.max(selectedComponents.length, 1)) // Minimum 30 degrees between components
            const angle = (index * minAngleSpacing * Math.PI) / 180
            // Adjust radius based on number of components to prevent crowding
            const baseRadius = 120
            const radiusAdjustment = Math.min(20, selectedComponents.length * 2) // Add extra radius for more components
            const radius = baseRadius + radiusAdjustment
            const x = radius * Math.cos(angle)
            const y = radius * Math.sin(angle)

            const getComponentColors = (category: string) => {
              switch (category) {
                case "Target User":
                  return {
                    bg: "bg-gradient-to-br from-blue-500/20 via-blue-400/15 to-blue-600/20",
                    border: "border-blue-400/40",
                    shadow: "shadow-blue-500/25",
                    text: "text-white font-semibold drop-shadow-lg",
                  }
                case "Online trend data":
                  return {
                    bg: "bg-gradient-to-br from-purple-500/20 via-purple-400/15 to-indigo-500/20",
                    border: "border-purple-400/40",
                    shadow: "shadow-purple-500/25",
                    text: "text-white font-semibold drop-shadow-lg",
                  }
                case "Campaign Type":
                  return {
                    bg: "bg-gradient-to-br from-pink-500/20 via-rose-400/15 to-red-500/20",
                    border: "border-pink-400/40",
                    shadow: "shadow-pink-500/25",
                    text: "text-white font-semibold drop-shadow-lg",
                  }
                case "Custom":
                  return {
                    bg: "bg-gradient-to-br from-green-500/20 via-emerald-400/15 to-green-600/20",
                    border: "border-green-400/40",
                    shadow: "shadow-green-500/25",
                    text: "text-white font-semibold drop-shadow-lg",
                  }
                default:
                  return {
                    bg: "bg-gradient-to-br from-gray-500/20 via-gray-400/15 to-gray-600/20",
                    border: "border-gray-400/30",
                    shadow: "shadow-gray-500/20",
                    text: "text-white font-semibold drop-shadow-lg",
                  }
              }
            }

            const colors = getComponentColors(component.category)

            return (
              <div
                key={component.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 animate-float cursor-pointer"
                style={{
                  left: `calc(25% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  animationDelay: `${index * 0.2}s`,
                  zIndex: 10 + index,
                }}
              >
                <div className="relative group">
                  {/* Liquid glass style chip */}
                  <div
                    className={[
                      "relative px-3 py-2 rounded-md backdrop-blur-md border shadow-md hover:shadow-lg transition-all duration-300 min-w-[70px] max-w-[120px]",
                      colors.bg,
                      colors.border,
                      colors.shadow,
                    ].join(" ")}
                  >
                    <div className="absolute inset-0 rounded-md bg-white/10 backdrop-blur-sm" />
                    <div className="relative z-10">
                      <p className={["text-[10px] text-center leading-tight", colors.text].join(" ")}>
                        {component.name}
                      </p>
                    </div>
                  </div>

                  {/* Remove button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 p-0 rounded-full bg-red-500/90 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm border border-red-400/50 shadow-md z-50 flex items-center justify-center"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('🔴 Remove button clicked for component:', component.name, 'ID:', component.id)
                      handleRemoveComponent(component.id)
                    }}
                    aria-label={`Remove ${component.name}`}
                  >
                    <Minus className="w-2 h-2" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {!showPreview && (
            <div className="absolute bottom-[-80px] right-[-10] z-50">
              <Button
                onClick={handleGenerateImage}
                disabled={isGenerating === "GENERATING" || (selectedComponents.length === 0 && !selectedNode)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg min-w-[120px]"
              >
                {isGenerating === "GENERATING" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {selectedNode ? 'Generate Image' : `Generate (${selectedComponents.length})`}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}