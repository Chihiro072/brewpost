import { useMemo, useState } from 'react'
import { FolderClock, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { usePlanners } from '@/hooks/usePlanners'
import { plannerService, mapPlannerToNodes } from '@/services/plannerService'
import type { ContentNode } from '@/components/planning/PlanningPanel'

type PlannerItem = {
  id: string
  name: string
  lastEdited: string | Date
  postCount: number
}

type PlannerSidebarProps = {
  planners?: PlannerItem[]
  onDelete?: (id: string) => void
  onLoadPlanner?: (nodes: ContentNode[]) => void
}

function formatLastEdited (value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  })
  return `Last edited ${fmt.format(d)}`
}

const fallbackPlanners: PlannerItem[] = [
  { id: 'p1', name: 'Q4 Launch Plan', lastEdited: new Date(), postCount: 12 },
  {
    id: 'p2',
    name: 'Holiday Campaign',
    lastEdited: new Date(Date.now() - 86400000 * 7),
    postCount: 8
  },
  {
    id: 'p3',
    name: 'Influencer Collab',
    lastEdited: new Date(Date.now() - 86400000 * 21),
    postCount: 5
  }
]

export default function PlannerSidebar ({
  planners,
  onDelete,
  onLoadPlanner
}: PlannerSidebarProps) {
  const [open, setOpen] = useState(false)
  const { plannersQuery, deletePlannerMutation } = usePlanners()
  const items = useMemo(() => {
    if (planners && planners.length) {
      return planners.map(p => ({
        id: p.id,
        name: p.name,
        lastEdited: p.lastEdited,
        postCount: p.postCount
      }))
    }
    const apiItems = (plannersQuery.data || []).map(p => ({
      id: p.id,
      name: p.title,
      lastEdited: p.createdAt,
      postCount: p.postCount
    }))
    return apiItems.length ? apiItems : fallbackPlanners
  }, [planners, plannersQuery.data])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant='outline'
          className='border-[#03624C]/50 rounded-full w-10 h-10 p-0 text-[#00DF81] transition-colors'
          style={{ backgroundColor: 'rgba(0, 15, 49, 0.5)' }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(3, 98, 76, 0.3)'
            e.currentTarget.style.borderColor = 'rgba(44, 194, 149, 0.7)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 15, 49, 0.5)'
            e.currentTarget.style.borderColor = 'rgba(3, 98, 76, 0.5)'
          }}
          aria-label='Open Saved Planners'
        >
          <FolderClock className='h-5 w-5' />
        </Button>
      </SheetTrigger>
      <SheetContent
        side='left'
        className='bg-[rgba(3,34,33,0.92)] backdrop-blur-xl border-[#03624C]/60 text-white'
      >
        <SheetHeader>
          <SheetTitle className='bg-gradient-to-r from-[#2CC295] via-[#00DF81] to-[#03624C] bg-clip-text text-transparent'>
            Saved Planners
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className='mt-4 h-[80vh] pr-2'>
          <div className='space-y-3'>
            {plannersQuery.isLoading && (
              <div className='space-y-2'>
                <Skeleton className='h-20 w-full bg-[#03624C]/30' />
                <Skeleton className='h-20 w-full bg-[#03624C]/30' />
                <Skeleton className='h-20 w-full bg-[#03624C]/30' />
              </div>
            )}
            {!plannersQuery.isLoading && items.length === 0 && (
              <div className='text-center text-[#9CEBC9] py-12'>
                <div className='text-lg font-semibold text-white'>
                  No saved plans yet
                </div>
                <div className='mt-2 text-sm'>
                  Start creating on the canvas!
                </div>
              </div>
            )}
            {items.map(p => (
              <Card
                key={p.id}
                className='group relative border-[#03624C]/60 bg-[rgba(3,34,33,0.6)] hover:bg-[rgba(3,34,33,0.75)] transition-colors cursor-pointer'
                onClick={async () => {
                  try {
                    const detail = await plannerService.get(p.id)
                    const nodes = mapPlannerToNodes(detail)
                    onLoadPlanner && onLoadPlanner(nodes)
                    setOpen(false)
                  } catch {}
                }}
              >
                <div className='p-4 flex items-start justify-between gap-3'>
                  <div className='flex-1 min-w-0'>
                    <div className='text-sm font-semibold text-white truncate'>
                      {p.name}
                    </div>
                    <div className='mt-1 text-xs text-[#9CEBC9]'>
                      {formatLastEdited(p.lastEdited)}
                    </div>
                    <div className='mt-2'>
                      <Badge className='border-[#2CC295]/40 bg-[#2CC295]/20 text-[#00DF81]'>
                        {p.postCount} posts
                      </Badge>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='absolute right-3 top-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100'
                        aria-label='Delete planner'
                        onClick={(e) => { e.stopPropagation() }}
                        onMouseDown={(e) => { e.stopPropagation() }}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className='bg-slate-950 border-slate-800 text-slate-100'>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete planner</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this planner?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className='border-slate-800 hover:bg-slate-800/50'>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className='bg-red-600 hover:bg-red-500'
                          onClick={() => {
                            if (onDelete) {
                              onDelete(p.id)
                              return
                            }
                            deletePlannerMutation.mutate(p.id)
                          }}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
