import React from "react"
import { X } from "lucide-react"
import { Card } from "@/components/ui/card"

interface CustomModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function CustomModal({ open, title, onClose, children }: CustomModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 p-6 bg-background border border-border shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </Card>
    </div>
  )
}