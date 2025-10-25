import React, { useState, useRef, useCallback, memo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Target,
  Eye,
  Zap,
  Calendar,
  ArrowRight,
  Plus,
  Link,
  X,
  Sparkles,
  CheckCircle,
  Image,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

interface ContentNode {
  id: string
  title: string
  type: 'post' | 'image' | 'story'
  status: 'draft' | 'scheduled' | 'published'
  scheduledDate?: Date
  content: string
  imageUrl?: string
  imageUrls?: string[]
  imagePrompt?: string
  day?: string
  postType?: 'engaging' | 'promotional' | 'branding'
  connections: string[]
  position: { x: number; y: number }
  postedAt?: Date
  postedTo?: string[]
  tweetId?: string
  selectedImageUrl?: string
}

interface NodeCanvasProps {
  nodes: ContentNode[]
  onNodeClick: (node: ContentNode) => void
  onNodeDoubleClick?: (node: ContentNode) => void
  onNodeUpdate: (nodes: ContentNode[]) => void
  onAddNode: () => void
  onDeleteNode?: (nodeId: string) => void
  onEditNode?: (node: ContentNode) => void
  createOrDeleteEdge?: (from: string, to: string) => Promise<void>
  onCanvasClick?: () => void
  selectedNodeIds?: string[]
  onSelectionChange?: (selectedIds: string[]) => void
}

export const DraggableNodeCanvas: React.FC<NodeCanvasProps> = ({
  nodes,
  onNodeClick,
  onNodeDoubleClick,
  onNodeUpdate,
  onAddNode,
  onDeleteNode,
  onEditNode,
  selectedNodeIds = [],
  onSelectionChange,
  createOrDeleteEdge,
  onCanvasClick
}) => {
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragStartZoom, setDragStartZoom] = useState(1)
  const [dragStartCanvasOffset, setDragStartCanvasOffset] = useState({
    x: 0,
    y: 0
  })
  const [connectingMode, setConnectingMode] = useState<string | null>(null)
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedPosition, setDraggedPosition] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastUpdateTime = useRef<number>(0)
  const [helpDragging, setHelpDragging] = useState(false)
  const [helpOffset, setHelpOffset] = useState({ x: 0, y: 0 })
  const [helpPos, setHelpPos] = useState<{ x: number; y: number } | null>(null)
  const [helpVisible, setHelpVisible] = useState(true)
  const [canvasPanning, setCanvasPanning] = useState(false)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [zoomLevel, setZoomLevel] = useState(1)
  const [expandedImageFolders, setExpandedImageFolders] = useState<Set<string>>(
    new Set()
  )
  const [draggedImage, setDraggedImage] = useState<{
    url: string
    nodeId: string
  } | null>(null)

  // Selection box states
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{
    x: number
    y: number
  } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{
    x: number
    y: number
  } | null>(null)

  const helpRef = useRef<HTMLDivElement>(null)
  const dragThreshold = 5

  const toggleImageFolder = (nodeId: string) => {
    setExpandedImageFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  const handleImageDragStart = (
    e: React.DragEvent,
    imageUrl: string,
    nodeId: string
  ) => {
    setDraggedImage({ url: imageUrl, nodeId })
    e.dataTransfer.setData('text/plain', imageUrl)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleImageDragEnd = () => {
    setDraggedImage(null)
  }

  const handleNodeDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleNodeDrop = (e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault()
    if (draggedImage && draggedImage.nodeId !== targetNodeId) {
      const updatedNodes = nodes.map(node =>
        node.id === targetNodeId
          ? { ...node, selectedImageUrl: draggedImage.url }
          : node
      )
      onNodeUpdate(updatedNodes)
    }
    setDraggedImage(null)
  }

  const getStatusColor = (status: ContentNode['status']) => {
    switch (status) {
      case 'published':
        return 'bg-success text-success-foreground'
      case 'scheduled':
        return 'bg-gradient-primary text-white'
      case 'draft':
        return 'bg-muted text-muted-foreground'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getPostTypeBorder = (postType?: ContentNode['postType']) => {
    switch (postType) {
      case 'engaging':
        return 'border-green-500/70 hover:border-green-500'
      case 'promotional':
        return 'border-blue-500/70 hover:border-blue-500'
      case 'branding':
        return 'border-yellow-500/70 hover:border-yellow-500'
      default:
        return 'border-primary/30 hover:border-primary/70'
    }
  }

  const getTypeIcon = (type: ContentNode['type']) => {
    switch (type) {
      case 'post':
        return Target
      case 'image':
        return Eye
      case 'story':
        return Zap
      default:
        return Target
    }
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (e.button !== 0) return
      e.preventDefault()

      const node = nodes.find(n => n.id === nodeId)
      if (!node) return

      // Handle selection logic
      const isNodeSelected = selectedNodeIds.includes(nodeId)
      const isCtrlPressed = e.ctrlKey || e.metaKey

      if (isCtrlPressed) {
        // Ctrl+click: toggle selection
        if (isNodeSelected) {
          // Remove from selection
          if (onSelectionChange) {
            onSelectionChange(selectedNodeIds.filter(id => id !== nodeId))
          }
        } else {
          // Add to selection
          if (onSelectionChange) {
            onSelectionChange([...selectedNodeIds, nodeId])
          }
        }
      } else if (!isNodeSelected) {
        // Regular click on unselected node: make it the only selection
        if (onSelectionChange) {
          onSelectionChange([nodeId])
        }
      }
      // If the node is already selected and no Ctrl, keep the current selection for group dragging

      const canvasRect = canvasRef.current?.getBoundingClientRect()
      if (canvasRect) {
        // Store the zoom and canvas offset at drag start
        setDragStartZoom(zoomLevel)
        setDragStartCanvasOffset({ ...canvasOffset })

        // Calculate mouse position in canvas coordinate space
        const mouseCanvasX =
          (e.clientX - canvasRect.left - canvasOffset.x) / zoomLevel
        const mouseCanvasY =
          (e.clientY - canvasRect.top - canvasOffset.y) / zoomLevel

        // Calculate offset from mouse to node position
        const offsetX = mouseCanvasX - node.position.x
        const offsetY = mouseCanvasY - node.position.y

        setDragOffset({ x: offsetX, y: offsetY })

        const initialMousePos = { x: e.clientX, y: e.clientY }

        const handleInitialMove = (moveEvent: MouseEvent) => {
          const deltaX = moveEvent.clientX - initialMousePos.x
          const deltaY = moveEvent.clientY - initialMousePos.y
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

          if (distance > dragThreshold) {
            setDraggedNode(nodeId)
            setIsDragging(true)
            setDraggedPosition({ x: node.position.x, y: node.position.y })

            document.body.classList.add('dragging')
            document.body.style.userSelect = 'none'
            document.body.style.cursor = 'grabbing'

            document.removeEventListener('mousemove', handleInitialMove)
            document.removeEventListener('mouseup', handleInitialUp)
          }
        }

        const handleInitialUp = () => {
          document.removeEventListener('mousemove', handleInitialMove)
          document.removeEventListener('mouseup', handleInitialUp)
        }

        document.addEventListener('mousemove', handleInitialMove, {
          passive: true
        })
        document.addEventListener('mouseup', handleInitialUp, { passive: true })
      }
    },
    [
      nodes,
      dragThreshold,
      selectedNodeIds,
      onSelectionChange,
      canvasOffset,
      zoomLevel
    ]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggedNode || !canvasRef.current || !isDragging) return

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        if (!canvasRef.current) return

        const canvasRect = canvasRef.current.getBoundingClientRect()

        // Use the zoom level and canvas offset from when drag started
        const mouseCanvasX =
          (e.clientX - canvasRect.left - dragStartCanvasOffset.x) /
          dragStartZoom
        const mouseCanvasY =
          (e.clientY - canvasRect.top - dragStartCanvasOffset.y) / dragStartZoom

        // Calculate new position for the dragged node
        const newX = mouseCanvasX - dragOffset.x
        const newY = mouseCanvasY - dragOffset.y

        setDraggedPosition({ x: newX, y: newY })

        const now = performance.now()
        if (now - lastUpdateTime.current > 16) {
          // Check if the dragged node is part of a selection
          const isDraggedNodeSelected = selectedNodeIds.includes(draggedNode)

          if (isDraggedNodeSelected && selectedNodeIds.length > 1) {
            // Group movement: move all selected nodes together
            const draggedNodeOriginal = nodes.find(n => n.id === draggedNode)
            if (draggedNodeOriginal) {
              const deltaX = newX - draggedNodeOriginal.position.x
              const deltaY = newY - draggedNodeOriginal.position.y

              const updatedNodes = nodes.map(node => {
                if (selectedNodeIds.includes(node.id)) {
                  return {
                    ...node,
                    position: {
                      x: node.position.x + deltaX,
                      y: node.position.y + deltaY
                    }
                  }
                }
                return node
              })

              onNodeUpdate(updatedNodes)
            }
          } else {
            // Single node movement
            const updatedNodes = nodes.map(node =>
              node.id === draggedNode
                ? { ...node, position: { x: newX, y: newY } }
                : node
            )

            onNodeUpdate(updatedNodes)
          }

          lastUpdateTime.current = now
        }
      })
    },
    [
      draggedNode,
      dragOffset,
      nodes,
      onNodeUpdate,
      isDragging,
      dragStartCanvasOffset,
      dragStartZoom,
      selectedNodeIds
    ]
  )

  const handleMouseUp = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (draggedNode && isDragging) {
      const isDraggedNodeSelected = selectedNodeIds.includes(draggedNode)

      if (isDraggedNodeSelected && selectedNodeIds.length > 1) {
        // Group movement: finalize positions for all selected nodes
        const draggedNodeOriginal = nodes.find(n => n.id === draggedNode)
        if (draggedNodeOriginal) {
          const deltaX = draggedPosition.x - draggedNodeOriginal.position.x
          const deltaY = draggedPosition.y - draggedNodeOriginal.position.y

          const updatedNodes = nodes.map(node => {
            if (selectedNodeIds.includes(node.id)) {
              return {
                ...node,
                position: {
                  x: node.position.x + deltaX,
                  y: node.position.y + deltaY
                }
              }
            }
            return node
          })

          onNodeUpdate(updatedNodes)
        }
      } else {
        // Single node movement
        const updatedNodes = nodes.map(node =>
          node.id === draggedNode
            ? { ...node, position: draggedPosition }
            : node
        )
        onNodeUpdate(updatedNodes)
      }
    }

    setDraggedNode(null)
    setIsDragging(false)
    setDraggedPosition({ x: 0, y: 0 })
    setDragOffset({ x: 0, y: 0 })
    setDragStartZoom(1)
    setDragStartCanvasOffset({ x: 0, y: 0 })

    document.body.classList.remove('dragging')
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [
    draggedNode,
    isDragging,
    draggedPosition,
    nodes,
    onNodeUpdate,
    selectedNodeIds
  ])

  React.useEffect(() => {
    if (isDragging && draggedNode) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true })
      document.addEventListener('mouseup', handleMouseUp, { passive: true })

      const preventContext = (e: Event) => e.preventDefault()
      document.addEventListener('contextmenu', preventContext)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('contextmenu', preventContext)

        document.body.classList.remove('dragging')
        document.body.style.userSelect = ''
        document.body.style.cursor = ''

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [isDragging, draggedNode, handleMouseMove, handleMouseUp])

  React.useEffect(() => {
    return () => {
      document.body.classList.remove('dragging')
      if (clickTimeout) {
        clearTimeout(clickTimeout)
      }
    }
  }, [clickTimeout])

  const handleConnect = useCallback(
    (fromNodeId: string, toNodeId: string) => {
      if (fromNodeId === toNodeId) return

      if (createOrDeleteEdge) {
        createOrDeleteEdge(fromNodeId, toNodeId)
      } else {
        const updatedNodes = nodes.map(node => {
          if (node.id === fromNodeId) {
            const connections = node.connections.includes(toNodeId)
              ? node.connections.filter(id => id !== toNodeId)
              : [...node.connections, toNodeId]
            return { ...node, connections }
          }
          if (node.id === toNodeId && !node.connections.includes(fromNodeId)) {
            return { ...node, connections: [...node.connections, fromNodeId] }
          }
          return node
        })

        onNodeUpdate(updatedNodes)
      }
      setConnectingMode(null)
    },
    [nodes, onNodeUpdate]
  )

  const handleNodeDoubleClick = useCallback(
    (node: ContentNode) => {
      if (clickTimeout) {
        clearTimeout(clickTimeout)
        setClickTimeout(null)
      }

      if (!connectingMode && !draggedNode) {
        if (onNodeDoubleClick) {
          onNodeDoubleClick(node)
        } else {
          onNodeClick(node)
        }
      }
    },
    [clickTimeout, connectingMode, draggedNode, onNodeClick, onNodeDoubleClick]
  )

  const handleNodeSingleClick = useCallback(
    (e: React.MouseEvent, node: ContentNode) => {
      e.stopPropagation()

      if (connectingMode) {
        if (connectingMode !== node.id) {
          handleConnect(connectingMode, node.id)
        }
        return
      }
    },
    [connectingMode, handleConnect]
  )

  const removeConnection = (fromNodeId: string, toNodeId: string) => {
    if (createOrDeleteEdge) {
      createOrDeleteEdge(fromNodeId, toNodeId)
    } else {
      const updatedNodes = nodes.map(node =>
        node.id === fromNodeId
          ? {
              ...node,
              connections: node.connections.filter(id => id !== toNodeId)
            }
          : node
      )
      onNodeUpdate(updatedNodes)
    }
  }

  React.useLayoutEffect(() => {
    if (!canvasRef.current || !helpRef.current || helpPos) return

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const helpRect = helpRef.current.getBoundingClientRect()

    const x = canvasRect.width - helpRect.width - 24
    const y = 24
    setHelpPos({ x: Math.max(0, x), y: Math.max(0, y) })
  }, [helpPos])

  const onHelpMouseDown = (e: React.MouseEvent) => {
    if (!helpRef.current || !canvasRef.current || !helpPos) return
    e.preventDefault()

    const rect = helpRef.current.getBoundingClientRect()
    setHelpDragging(true)
    document.body.classList.add('dragging')

    setHelpOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const onHelpMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!helpDragging || !canvasRef.current || !helpRef.current) return

      const canvasRect = canvasRef.current.getBoundingClientRect()
      const helpRect = helpRef.current.getBoundingClientRect()

      const newX = e.clientX - canvasRect.left - helpOffset.x
      const newY = e.clientY - canvasRect.top - helpOffset.y

      const maxX = canvasRect.width - helpRect.width
      const maxY = canvasRect.height - helpRect.height

      setHelpPos({
        x: Math.min(Math.max(0, newX), Math.max(0, maxX)),
        y: Math.min(Math.max(0, newY), Math.max(0, maxY))
      })
    },
    [helpDragging, helpOffset]
  )

  const onHelpMouseUp = () => {
    if (!helpDragging) return
    setHelpDragging(false)
    document.body.classList.remove('dragging')
  }

  React.useEffect(() => {
    if (!helpDragging) return
    const move = (e: MouseEvent) => onHelpMouseMove(e)
    const up = () => onHelpMouseUp()
    document.addEventListener('mousemove', move, { passive: true })
    document.addEventListener('mouseup', up, { passive: true })
    return () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
  }, [helpDragging, onHelpMouseMove])

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) {
        // Right click
        e.preventDefault()
        setCanvasPanning(true)
        setPanStart({
          x: e.clientX - canvasOffset.x,
          y: e.clientY - canvasOffset.y
        })
        document.body.style.cursor = 'grabbing'
      } else if (e.button === 0 && e.target === e.currentTarget) {
        // Left click on empty area
        if (connectingMode) {
          setConnectingMode(null)
        } else {
          // Start selection
          const rect = e.currentTarget.getBoundingClientRect()
          const startPoint = {
            x: (e.clientX - rect.left - canvasOffset.x) / zoomLevel,
            y: (e.clientY - rect.top - canvasOffset.y) / zoomLevel
          }

          setIsSelecting(true)
          setSelectionStart(startPoint)
          setSelectionEnd(startPoint)

          // Clear existing selection
          if (onSelectionChange) {
            onSelectionChange([])
          }
        }
      }
    },
    [connectingMode, canvasOffset, zoomLevel, onSelectionChange]
  )

  const handleCanvasPan = useCallback(
    (e: MouseEvent) => {
      if (!canvasPanning) return

      const newOffset = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }
      setCanvasOffset(newOffset)
    },
    [canvasPanning, panStart]
  )

  const handleCanvasPanEnd = useCallback(() => {
    setCanvasPanning(false)
    document.body.style.cursor = ''
  }, [])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const zoomFactor = 0.1
      const newZoom =
        e.deltaY > 0
          ? Math.max(0.5, zoomLevel - zoomFactor) // Zoom out (scroll down)
          : Math.min(1.5, zoomLevel + zoomFactor) // Zoom in (scroll up)
      setZoomLevel(newZoom)
    },
    [zoomLevel]
  )

  // Selection handlers
  const handleSelectionMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isSelecting || !selectionStart || !canvasRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const currentPoint = {
        x: (e.clientX - rect.left - canvasOffset.x) / zoomLevel,
        y: (e.clientY - rect.top - canvasOffset.y) / zoomLevel
      }

      setSelectionEnd(currentPoint)

      // Calculate selection rectangle
      const selectionRect = {
        left: Math.min(selectionStart.x, currentPoint.x),
        top: Math.min(selectionStart.y, currentPoint.y),
        right: Math.max(selectionStart.x, currentPoint.x),
        bottom: Math.max(selectionStart.y, currentPoint.y)
      }

      // Find nodes within selection
      const selectedIds = nodes
        .filter(node => {
          const nodeRect = {
            left: node.position.x,
            top: node.position.y,
            right: node.position.x + 240, // Node width
            bottom: node.position.y + 120 // Node height
          }

          return (
            nodeRect.left < selectionRect.right &&
            nodeRect.right > selectionRect.left &&
            nodeRect.top < selectionRect.bottom &&
            nodeRect.bottom > selectionRect.top
          )
        })
        .map(node => node.id)

      if (onSelectionChange) {
        onSelectionChange(selectedIds)
      }
    },
    [
      isSelecting,
      selectionStart,
      canvasOffset,
      zoomLevel,
      nodes,
      onSelectionChange
    ]
  )

  const handleSelectionMouseUp = useCallback(() => {
    setIsSelecting(false)
    setSelectionStart(null)
    setSelectionEnd(null)
  }, [])

  React.useEffect(() => {
    if (canvasPanning) {
      document.addEventListener('mousemove', handleCanvasPan)
      document.addEventListener('mouseup', handleCanvasPanEnd)
      document.addEventListener('contextmenu', e => e.preventDefault())

      return () => {
        document.removeEventListener('mousemove', handleCanvasPan)
        document.removeEventListener('mouseup', handleCanvasPanEnd)
        document.removeEventListener('contextmenu', e => e.preventDefault())
      }
    }
  }, [canvasPanning, handleCanvasPan, handleCanvasPanEnd])

  // Selection event listeners
  React.useEffect(() => {
    if (isSelecting) {
      document.addEventListener('mousemove', handleSelectionMouseMove)
      document.addEventListener('mouseup', handleSelectionMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleSelectionMouseMove)
        document.removeEventListener('mouseup', handleSelectionMouseUp)
      }
    }
  }, [isSelecting, handleSelectionMouseMove, handleSelectionMouseUp])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })
      return () => canvas.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  return (
    <div
      ref={canvasRef}
      className='relative w-full h-full bg-gradient-to-br from-background/50 to-background/80 no-select canvas-container'
      style={{
        cursor: canvasPanning
          ? 'grabbing'
          : isDragging
          ? 'grabbing'
          : 'default',
        willChange: isDragging || canvasPanning ? 'transform' : 'auto'
      }}
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Canvas content with transform */}
      <div
        className='relative w-full h-full'
        style={{
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoomLevel})`,
          transition: canvasPanning ? 'none' : 'transform 0.1s ease-out',
          transformOrigin: 'center center'
        }}
      >
        {/* Connection Lines */}
        <svg
          className='absolute inset-0 pointer-events-none z-0'
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <linearGradient
              id='connectionGradient'
              x1='0%'
              y1='0%'
              x2='100%'
              y2='0%'
            >
              <stop
                offset='0%'
                stopColor='hsl(var(--primary))'
                stopOpacity='0.4'
              />
              <stop
                offset='100%'
                stopColor='hsl(var(--primary))'
                stopOpacity='0.7'
              />
            </linearGradient>
            <filter id='connectionGlow'>
              <feGaussianBlur stdDeviation='2' result='coloredBlur' />
              <feMerge>
                <feMergeNode in='coloredBlur' />
                <feMergeNode in='SourceGraphic' />
              </feMerge>
            </filter>
          </defs>
          {nodes.map(node =>
            node.connections.map(connectedId => {
              const connectedNode = nodes.find(n => n.id === connectedId)
              if (!connectedNode) {
                console.warn(
                  `Connected node not found: ${connectedId} for node ${node.id}`
                )
                return null
              }

              const startX =
                (draggedNode === node.id
                  ? draggedPosition.x
                  : node.position.x) + 120
              const startY =
                (draggedNode === node.id
                  ? draggedPosition.y
                  : node.position.y) + 100
              const endX =
                (draggedNode === connectedNode.id
                  ? draggedPosition.x
                  : connectedNode.position.x) + 120
              const endY =
                (draggedNode === connectedNode.id
                  ? draggedPosition.y
                  : connectedNode.position.y) + 100

              return (
                <g key={`${node.id}-${connectedId}`}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke='hsl(var(--primary))'
                    strokeWidth='4'
                    strokeOpacity='0.2'
                    filter='url(#connectionGlow)'
                  />
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke='url(#connectionGradient)'
                    strokeWidth='2'
                    strokeDasharray='8,4'
                    className='transition-all duration-300'
                    style={{
                      animation: 'dash 2s linear infinite'
                    }}
                  />
                  <circle
                    cx={startX}
                    cy={startY}
                    r='3'
                    fill='hsl(var(--primary))'
                    opacity='0.8'
                  />
                  <circle
                    cx={endX}
                    cy={endY}
                    r='3'
                    fill='hsl(var(--primary))'
                    opacity='0.8'
                  />
                </g>
              )
            })
          )}
        </svg>

        <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -12;
          }
        }
      `}</style>

        {/* Nodes */}
        {nodes.map(node => {
          const TypeIcon = getTypeIcon(node.type)
          const isConnecting = connectingMode === node.id
          const canConnect = connectingMode && connectingMode !== node.id

          return (
            <Card
              key={node.id}
              className={`node-card group absolute w-60 p-4 bg-card/90 backdrop-blur-sm border-2 z-10 no-select ${
                draggedNode === node.id
                  ? 'dragging dragging-node border-primary cursor-grabbing will-change-transform'
                  : node.postedAt && node.postedTo && node.postedTo.length > 0
                  ? 'border-green-600/70 hover:border-green-600 cursor-grab hover:scale-[1.02] hover:shadow-xl hover:shadow-green-600/25 transition-all duration-200 ease-out transform-gpu'
                  : `${getPostTypeBorder(
                      node.postType
                    )} cursor-grab hover:scale-[1.02] hover:shadow-xl transition-all duration-200 ease-out transform-gpu`
              } ${
                selectedNodeIds.includes(node.id)
                  ? 'ring-4 ring-[#2CC295]/70 border-[#2CC295] shadow-lg shadow-[#2CC295]/25'
                  : ''
              } ${
                isConnecting ? 'ring-2 ring-primary/70 border-primary' : ''
              } ${
                canConnect
                  ? 'ring-2 ring-accent/70 border-accent animate-node-pulse cursor-pointer'
                  : ''
              }`}
              style={{
                left:
                  draggedNode === node.id ? draggedPosition.x : node.position.x,
                top:
                  draggedNode === node.id ? draggedPosition.y : node.position.y,
                transform:
                  draggedNode === node.id ? 'translateZ(0)' : 'translateZ(0)',
                willChange: draggedNode === node.id ? 'transform' : 'auto',
                transition:
                  draggedNode === node.id
                    ? 'none'
                    : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease-out'
              }}
              title='Double-click to open details'
              onMouseDown={e => {
                if (!canConnect) {
                  handleMouseDown(e, node.id)
                }
              }}
              onClick={e => handleNodeSingleClick(e, node)}
              onDoubleClick={e => {
                e.stopPropagation()
                handleNodeDoubleClick(node)
              }}
              onDragOver={handleNodeDragOver}
              onDrop={e => handleNodeDrop(e, node.id)}
            >
              {/* Node Controls */}
              <div
                className='absolute top-2 right-2 flex gap-1 z-50 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                onMouseDown={e => e.stopPropagation()}
              >
                {onDeleteNode && (
                  <Button
                    size='sm'
                    variant='outline'
                    className='h-6 w-6 p-0 bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive/50 pointer-events-auto'
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation()
                      e.preventDefault()
                      onDeleteNode(node.id)
                    }}
                    title='Delete node'
                  >
                    <X className='w-3 h-3' />
                  </Button>
                )}

                <Button
                  size='sm'
                  variant='outline'
                  className={`h-6 w-6 p-0 pointer-events-auto ${
                    connectingMode === node.id
                      ? 'bg-primary text-primary-foreground border-primary/50'
                      : 'bg-accent hover:bg-accent/90 border-accent/50'
                  }`}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation()
                    e.preventDefault()
                    if (connectingMode === node.id) {
                      setConnectingMode(null)
                    } else {
                      setConnectingMode(node.id)
                    }
                  }}
                  title={
                    connectingMode === node.id
                      ? 'Cancel linking'
                      : 'Link to other nodes'
                  }
                >
                  <Link className='w-3 h-3' />
                </Button>
              </div>

              <div className='flex items-start justify-between mb-3'>
                <div className='flex items-center gap-2'>
                  <div className='w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center'>
                    <TypeIcon className='w-4 h-4 text-white' />
                  </div>
                  <div>
                    <h3 className='font-medium text-xs'>{node.title}</h3>
                    <p className='text-xs text-muted-foreground capitalize'>
                      {node.day && node.postType
                        ? `${node.day} - ${
                            node.postType.charAt(0).toUpperCase() +
                            node.postType.slice(1)
                          }`
                        : node.day + ' - ' + node.type}
                    </p>
                  </div>
                </div>

                {node.postedAt && node.postedTo && node.postedTo.length > 0 && (
                  <div
                    className='flex items-center gap-1 text-green-600 dark:text-green-400'
                    title={`Posted to ${node.postedTo.join(
                      ', '
                    )} on ${node.postedAt.toLocaleDateString()}`}
                  >
                    <CheckCircle className='w-4 h-4' />
                    <span className='text-xs font-medium'>Posted</span>
                  </div>
                )}
              </div>

              <p className='text-xs text-muted-foreground mb-3 line-clamp-2'>
                {node.content}
              </p>

              <div className='flex items-center justify-between'>
                <Badge
                  variant='secondary'
                  className={`text-xs ${getStatusColor(node.status)}`}
                >
                  {node.status}
                </Badge>

                {node.scheduledDate && (
                  <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                    <Calendar className='w-3 h-3' />
                    {node.scheduledDate.toLocaleDateString()}
                  </div>
                )}
              </div>

              {node.connections.length > 0 && (
                <div className='mt-2 pt-2 border-t border-border/20'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <ArrowRight className='w-3 h-3' />
                      <span>{node.connections.length} connection(s)</span>
                    </div>
                    <div className='flex gap-1 flex-wrap'>
                      {node.connections.map(connId => {
                        const connectedNode = nodes.find(n => n.id === connId)
                        return (
                          <Button
                            key={connId}
                            size='sm'
                            variant='ghost'
                            className='h-5 px-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10'
                            onClick={e => {
                              e.stopPropagation()
                              removeConnection(node.id, connId)
                            }}
                            title={`Disconnect from: ${
                              connectedNode?.title || connId
                            }`}
                          >
                            <X className='w-2 h-2 mr-1' />
                            {connectedNode?.title?.slice(0, 8) ||
                              connId.slice(0, 8)}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}

        {/* Image Folder Cards */}
        {nodes
          .filter(node => node.imageUrl)
          .map(node => (
            <Card
              key={`folder-${node.id}`}
              className='absolute w-60 p-2 bg-card/90 backdrop-blur-sm border border-muted/50 z-5'
              style={{
                left: node.position.x,
                top: node.position.y + 200
              }}
            >
              <div
                className='flex items-center gap-1 cursor-pointer p-1 rounded hover:bg-muted/30 transition-colors'
                onClick={e => {
                  e.stopPropagation()
                  toggleImageFolder(node.id)
                }}
              >
                {expandedImageFolders.has(node.id) ? (
                  <ChevronDown className='w-3 h-3' />
                ) : (
                  <ChevronRight className='w-3 h-3' />
                )}
                <Image className='w-3 h-3' />
                <span className='text-xs font-medium'>Image</span>
              </div>

              {expandedImageFolders.has(node.id) && node.imageUrl && (
                <div className='mt-2'>
                  <div
                    className='relative group cursor-grab active:cursor-grabbing'
                    draggable
                    onDragStart={e =>
                      handleImageDragStart(e, node.imageUrl!, node.id)
                    }
                    onDragEnd={handleImageDragEnd}
                  >
                    <img
                      src={node.imageUrl}
                      alt='Selected image'
                      className='w-full h-30 object-cover rounded border border-border/20 hover:opacity-80 transition-opacity'
                    />
                  </div>
                </div>
              )}
            </Card>
          ))}

        {/* Selected Image Cards */}
        {nodes
          .filter(node => node.selectedImageUrl)
          .map(node => (
            <Card
              key={`image-${node.id}`}
              className='absolute w-60 p-2 bg-card/90 backdrop-blur-sm border border-primary/30 z-5'
              style={{
                left: node.position.x,
                top:
                  node.position.y +
                  (expandedImageFolders.has(node.id) ? 340 : 280)
              }}
            >
              <div className='flex items-center justify-between mb-1'>
                <span className='text-xs font-medium flex items-center gap-1'>
                  <Image className='w-3 h-3' />
                  Selected
                </span>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-4 w-4 p-0'
                  onClick={() => {
                    const updatedNodes = nodes.map(n =>
                      n.id === node.id
                        ? { ...n, selectedImageUrl: undefined }
                        : n
                    )
                    onNodeUpdate(updatedNodes)
                  }}
                >
                  <X className='w-2 h-2' />
                </Button>
              </div>
              <img
                src={node.selectedImageUrl}
                alt='Selected'
                className='w-full h-20 object-cover rounded'
              />
            </Card>
          ))}

        {/* Connection Mode Instructions */}
        {connectingMode && (
          <div className='absolute top-6 left-6 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg p-4 z-20'>
            <p className='text-sm text-muted-foreground mb-2'>
              Click another node to connect, or click the X to cancel
            </p>
            <p className='text-xs text-muted-foreground'>
              Connecting from:{' '}
              <span className='font-medium'>
                {nodes.find(n => n.id === connectingMode)?.title}
              </span>
            </p>
          </div>
        )}

        {/* Selection Box */}
        {isSelecting && selectionStart && selectionEnd && (
          <div
            className='absolute pointer-events-none z-30'
            style={{
              left: Math.min(selectionStart.x, selectionEnd.x),
              top: Math.min(selectionStart.y, selectionEnd.y),
              width: Math.abs(selectionEnd.x - selectionStart.x),
              height: Math.abs(selectionEnd.y - selectionStart.y),
              border: '2px dashed #2CC295',
              backgroundColor: 'rgba(44, 194, 149, 0.1)',
              borderRadius: '4px'
            }}
          />
        )}
      </div>

      {/* Usage Instructions - Outside transform so it stays fixed */}
      {helpVisible && (
        <div
          className='absolute top-4 right-4 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg p-3 z-30'
          style={{
            width: 220,
            userSelect: 'none'
          }}
        >
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2'>
              <Sparkles className='w-4 h-4 text-primary' />
              <p className='text-sm font-medium text-foreground'>
                Content Canvas
              </p>
            </div>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation()
                setHelpVisible(false)
              }}
              className='p-1 rounded hover:bg-destructive/20 text-destructive transition'
              title='Hide instructions'
            >
              <X className='w-4 h-4' />
            </button>
          </div>

          <div className='space-y-1 text-xs text-muted-foreground'>
            <p>
              • <strong>Drag</strong> to move nodes
            </p>
            <p>
              • <strong>Double-click</strong> to open details
            </p>
            <p>
              • <strong>Link icon</strong> to connect nodes
            </p>
          </div>
        </div>
      )}

      {/* Zoom Level Indicator */}
      <div className='absolute bottom-4 right-4 bg-black/70 text-white text-sm px-3 py-2 rounded-lg backdrop-blur-sm border border-white/10 z-40'>
        {Math.round(zoomLevel * 100)}%
      </div>
    </div>
  )
}