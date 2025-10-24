"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import React, { useState, useEffect } from "react"
import CustomModal from "@/components/custom-modal"
import { X } from "lucide-react"

interface Component {
  id: string
  name: string
  category: string
  color: string
  type?: "online_trend" | "campaign_type" | "promotion_type"
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
const CATEGORIES = ["Online trend data", "Campaign Type", "Promotion Type"] as const
const STORAGE_KEY = "kedai.customComponents.v1"

interface ComponentSidebarProps {
  onAddComponent: (component: Component) => void
  generatedComponents?: CampaignComponent[]
  onRemoveFromCanvas?: (id: string) => void
  isLoadingAi?: boolean
  generationProgress?: string | boolean
}

function colorByType(t: CampaignComponent["type"]) {
  if (t === "promotion_type") return "bg-gradient-to-br from-blue-500 via-blue-400 to-blue-600"
  if (t === "online_trend") return "bg-gradient-to-br from-purple-500 via-purple-400 to-indigo-500"
  return "bg-gradient-to-br from-pink-500 via-rose-400 to-red-500"
}

export function ComponentSidebar({
  onAddComponent,
  generatedComponents = [],
  onRemoveFromCanvas,
  isLoadingAi = false,
  generationProgress = false,
}: ComponentSidebarProps) {
  // Only AI-generated components (no mocks)
  const [allComponents, setAllComponents] = useState<Component[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)
  const [customComponents, setCustomComponents] = useState<Component[]>([])
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Normalize AI components to same visual spec as the original cards
  useEffect(() => {
    const converted: Component[] = generatedComponents.map((comp) => ({
      id: comp.id,
      name: comp.title,
      category:
        comp.type === "online_trend"
          ? "Online trend data"
          : comp.type === "campaign_type"
          ? "Campaign Type"
          : comp.type === "promotion_type"
          ? "Promotion Type"
          : "Suggested",
      color: colorByType(comp.type),
      type: comp.type,
    }))

    // uniquify by id (in case backend sends duplicates)
    const unique = converted.filter((c, i, arr) => i === arr.findIndex((x) => x.id === c.id))
    setAllComponents(unique)
  }, [generatedComponents])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setCustomComponents(JSON.parse(raw) as Component[])
    } catch (e) { console.debug('[ComponentSidebar] failed to read custom components', e) }
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customComponents))
    } catch (e) { console.debug('[ComponentSidebar] failed to save custom components', e) }
  }, [customComponents, mounted])

  useEffect(() => {
    if (!mounted) return
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setCustomComponents(JSON.parse(e.newValue) as Component[]) } catch (err) { console.debug('[ComponentSidebar] failed to parse storage event', err) }
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [mounted])

  function openAddModal() {
    setNewName("")
    setShowModal(true)
  }

  function handleCreateCustom() {
    const name = newName.trim()
    if (!name) return
    const id = `custom-${Date.now()}`
    setCustomComponents((s) => [
      ...s,
      { id, name, category: "Custom", color: "bg-gradient-to-br from-green-500 via-emerald-400 to-green-600" },
    ])
    setShowModal(false)
    setSelectedId(id)
  }

  function handleClickCustom(component: Component) {
    setSelectedId(component.id)
    onAddComponent(component)
  }

  function handleRemoveCustom(id: string) {
    setCustomComponents((prev) => prev.filter((c) => c.id !== id))
    if (selectedId === id) setSelectedId(null)
    onRemoveFromCanvas?.(id)
  }

  if (!mounted) return null

if (isLoadingAi) {
    return (
      <div className="w-full border-t border-border/50 bg-card/80 backdrop-blur-xl p-3 max-h-64 overflow-y-auto flex items-center justify-center">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes dot {
            0% { transform: translateY(0) }
            50% { transform: translateY(-4px) }
            100% { transform: translateY(0) }
          }
          .dot { display:inline-block; width:6px; height:6px; border-radius:999px; background:currentColor; margin-left:6px; }
          .dot:nth-child(1){ animation: dot 1s infinite 0s }
          .dot:nth-child(2){ animation: dot 1s infinite 0.15s }
          .dot:nth-child(3){ animation: dot 1s infinite 0.3s }
        `}} />
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="text-sm font-medium">
            {typeof generationProgress === 'string' ? generationProgress : 'Generating components'}
          </div>
          <div className="flex items-center"><span className="dot" /><span className="dot" /><span className="dot" /></div>
        </div>
      </div>
    )
  }

  if (isLoadingAi) {
    return (
      <div className="w-full border-t border-border/50 bg-card/80 backdrop-blur-xl p-3 max-h-64 overflow-y-auto flex items-center justify-center">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes dot {
            0% { transform: translateY(0) }
            50% { transform: translateY(-4px) }
            100% { transform: translateY(0) }
          }
          .dot { display:inline-block; width:6px; height:6px; border-radius:999px; background:currentColor; margin-left:6px; }
          .dot:nth-child(1){ animation: dot 1s infinite 0s }
          .dot:nth-child(2){ animation: dot 1s infinite 0.15s }
          .dot:nth-child(3){ animation: dot 1s infinite 0.3s }
        `}} />
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="text-sm font-medium">
            {typeof generationProgress === 'string' ? generationProgress : 'Generating components'}
          </div>
          <div className="flex items-center"><span className="dot" /><span className="dot" /><span className="dot" /></div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full border-t border-border/50 bg-card/80 backdrop-blur-xl p-3 max-h-80 overflow-y-auto">
      {/** Loading state: when AI is generating components, show a subtle skeleton instead of demo content */}
      {/** If parent passes isLoadingAi, don't render the demo/components list */}
      
      <style dangerouslySetInnerHTML={{
        __html: `
          .horizontal-scroll-container::-webkit-scrollbar {
            height: 8px;
          }
          .horizontal-scroll-container::-webkit-scrollbar-track {
            background: transparent;
          }
          .horizontal-scroll-container::-webkit-scrollbar-thumb {
            background-color: rgb(120 255 214 / 0.5);
            border-radius: 4px;
          }
          .horizontal-scroll-container::-webkit-scrollbar-thumb:hover {
            background-color: rgb(59 198 255 / 0.7);
          }
        `
      }} />
      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Components</h2>
          {allComponents.length > 0 && (
            <p className="text-sm text-muted-foreground">
              AI-generated components ({allComponents.length})
            </p>
          )}
        </div>

        {CATEGORIES.map((category) => {
          const categoryComponents = allComponents.filter((c) => c.category === category)
          // Debug: log AI raw results so you can inspect in browser console
          console.debug('[ComponentSidebar] generatedComponents', { category, generatedComponents })

          const generatedInCategory = generatedComponents.filter((gc) =>
            (gc.type === 'online_trend' && category === 'Online trend data') ||
            (gc.type === 'campaign_type' && category === 'Campaign Type') ||
            (gc.type === 'promotion_type' && category === 'Promotion Type')
          )

          const isExpanded = !!expanded[category]
          const visible = isExpanded ? categoryComponents : categoryComponents.slice(0, 4)
          const hiddenCount = Math.max(0, categoryComponents.length - visible.length)

          if (categoryComponents.length === 0) return null

          return (
            <div key={category} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {category}
                  </Badge>
                  
                  {generatedInCategory.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      AI Generated ({generatedInCategory.length})
                    </Badge>
                  )}
                </div>
              </div>

              {/* Horizontal scrolling container */}
              <div className="horizontal-scroll-container flex gap-3 overflow-x-auto overflow-y-hidden pb-2 px-1 scroll-smooth" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgb(120 255 214 / 0.5) transparent',
                WebkitOverflowScrolling: 'touch'
              }}>
                {categoryComponents.map((component) => {
                  const generatedComp = generatedComponents.find((gc) => gc.id === component.id)
                  const isGenerated = Boolean(generatedComp)

                  return (
                    <Card
                      key={component.id}
                      className="relative p-2 cursor-pointer transition-all duration-200 border-border/50 hover:border-primary/50 hover:shadow-lg group bg-card flex-shrink-0 min-w-[140px] max-w-[160px] hover:scale-[1.02]"
                      onClick={() => onAddComponent(component)}
                    >
                      {isGenerated && (
                        <span className="absolute top-0.5 right-0.5 text-[8px] px-1 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                          AI
                        </span>
                      )}

                      <div className="flex flex-col items-center text-center space-y-1">
                        {/* Compact gradient bubble */}
                        <div className="flex items-center justify-center w-full">
                          <div
                            className={`w-10 h-10 rounded-full ${component.color} flex items-center justify-center group-hover:animate-float`}
                          >
                            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                              <div className="w-3 h-3 rounded-full bg-white/40" />
                            </div>
                          </div>
                        </div>

                        <div className="w-full">
                          <p className="text-xs text-card-foreground font-medium leading-tight mb-0.5">
                            {component.name}
                          </p>

                          {isGenerated && generatedComp && (
                            <>
                              <div className="flex items-center justify-center gap-1 mb-0.5">
                                <span className="inline-block w-1 h-1 rounded-full bg-emerald-500" />
                                <span className="text-[9px] text-muted-foreground font-medium">
                                  {Math.round(generatedComp.relevanceScore)}%
                                </span>
                              </div>
                              <p className="text-[8px] text-muted-foreground line-clamp-2 leading-tight">
                                {generatedComp.description}
                              </p>
                              
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* Scroll indicator if needed */}
              {categoryComponents.length > 2 && (
                <div className="flex justify-center -mt-1">
                  <span className="text-[9px] bg-background/50 backdrop-blur-sm border border-border/30 rounded-full px-1.5 py-0.5 text-muted-foreground select-none pointer-events-none">
                    ← Scroll horizontally for more →
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {/* Custom section */}
        <div className="space-y-1 -mt-1">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              Custom
            </Badge>
          </div>
          <div className="horizontal-scroll-container flex gap-3 overflow-x-auto overflow-y-hidden pb-3 px-1 scroll-smooth" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(120 255 214 / 0.5) transparent',
            WebkitOverflowScrolling: 'touch'
          }}>
            {customComponents.map((component) => {
              const isSelected = selectedId === component.id
              const bubbleClass = isSelected
                ? "w-10 h-10 rounded-full bg-gradient-to-br from-green-400 via-emerald-300 to-green-500 flex items-center justify-center"
                : `w-10 h-10 rounded-full ${component.color} flex items-center justify-center group-hover:animate-float`

              return (
                <div key={component.id} className="relative group">
                  <button
                    aria-label={`Remove ${component.name}`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleRemoveCustom(component.id)
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg z-10"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>

                  <Card
                    className="p-2 cursor-pointer transition-all duration-200 border-border/50 hover:border-primary/50 hover:shadow-lg group bg-card flex-shrink-0 min-w-[140px] max-w-[160px] hover:scale-[1.02]"
                    onClick={() => handleClickCustom(component)}
                  >
                    <div className="flex flex-col items-center text-center space-y-1">
                      <div className={bubbleClass}>
                        <div className="w-6 h-6 bg-white/20 rounded-full" />
                      </div>
                      <p className="text-xs text-center text-card-foreground font-medium leading-tight">
                        {component.name}
                      </p>
                    </div>
                  </Card>
                </div>
              )
            })}

            {/* Add custom button */}
            <Card
              className="p-2 cursor-pointer transition-all duration-200 border-dashed border-border/40 flex flex-col items-center justify-center bg-card flex-shrink-0 min-w-[140px] max-w-[160px] hover:scale-[1.02]"
              onClick={openAddModal}
            >
              <div className="w-8 h-8 rounded-full bg-yellow-300/30 flex items-center justify-center mb-1">
                <div className="text-sm font-bold text-yellow-700">+</div>
              </div>
              <p className="text-xs text-center text-card-foreground font-medium leading-tight">Add custom</p>
            </Card>
          </div>
        </div>
      </div>

      <CustomModal open={showModal} title="Create custom component" onClose={() => setShowModal(false)}>
        <input
          className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm mb-3 placeholder:text-muted-foreground"
          placeholder="Component name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreateCustom()
          }}
        />
        <div className="flex gap-2 justify-end">
          <button className="px-3 py-1 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors" onClick={() => setShowModal(false)}>
            Cancel
          </button>
          <button className="px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" onClick={handleCreateCustom}>
            Create
          </button>
        </div>
      </CustomModal>
    </div>
  )
}