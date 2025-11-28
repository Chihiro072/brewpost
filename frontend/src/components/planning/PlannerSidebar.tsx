import { useMemo, useState } from "react";
import { FolderClock, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePlanners } from "@/hooks/usePlanners";
import { plannerService, mapPlannerToNodes } from "@/services/plannerService";
import type { ContentNode } from "@/components/planning/PlanningPanel";

type PlannerItem = {
  id: string;
  name: string;
  lastEdited: string | Date;
  postCount: number;
};

type PlannerSidebarProps = {
  planners?: PlannerItem[];
  onDelete?: (id: string) => void;
  onLoadPlanner?: (nodes: ContentNode[]) => void;
};

function formatLastEdited(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `Last edited ${fmt.format(d)}`;
}

const fallbackPlanners: PlannerItem[] = [
  { id: "p1", name: "Q4 Launch Plan", lastEdited: new Date(), postCount: 12 },
  { id: "p2", name: "Holiday Campaign", lastEdited: new Date(Date.now() - 86400000 * 7), postCount: 8 },
  { id: "p3", name: "Influencer Collab", lastEdited: new Date(Date.now() - 86400000 * 21), postCount: 5 },
];

export default function PlannerSidebar({ planners, onDelete, onLoadPlanner }: PlannerSidebarProps) {
  const [open, setOpen] = useState(false);
  const { plannersQuery, deletePlannerMutation } = usePlanners();
  const items = useMemo(() => {
    if (planners && planners.length) {
      return planners.map((p) => ({ id: p.id, name: p.name, lastEdited: p.lastEdited, postCount: p.postCount }));
    }
    const apiItems = (plannersQuery.data || []).map((p) => ({ id: p.id, name: p.title, lastEdited: p.createdAt, postCount: p.postCount }));
    return apiItems.length ? apiItems : fallbackPlanners;
  }, [planners, plannersQuery.data]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="h-12 w-12 rounded-full bg-slate-900 text-cyan-400 hover:bg-slate-800 hover:text-cyan-300 border border-slate-800 shadow-md"
          aria-label="Open Saved Planners"
        >
          <FolderClock className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-slate-950 border-slate-800 text-slate-100">
        <SheetHeader>
          <SheetTitle className="text-white">Saved Planners</SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[80vh] pr-2">
          <div className="space-y-3">
            {plannersQuery.isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full bg-slate-800/50" />
                <Skeleton className="h-20 w-full bg-slate-800/50" />
                <Skeleton className="h-20 w-full bg-slate-800/50" />
              </div>
            )}
            {!plannersQuery.isLoading && items.length === 0 && (
              <div className="text-center text-slate-400 py-12">
                <div className="text-lg font-semibold text-white">No saved plans yet</div>
                <div className="mt-2 text-sm">Start creating on the canvas!</div>
              </div>
            )}
            {items.map((p) => (
              <Card
                key={p.id}
                className="group relative border-slate-800/60 bg-slate-900/50 hover:bg-slate-900/70 transition-colors"
                onClick={async () => {
                  try {
                    const detail = await plannerService.get(p.id);
                    const nodes = mapPlannerToNodes(detail);
                    onLoadPlanner && onLoadPlanner(nodes);
                    setOpen(false);
                  } catch {}
                }}
              >
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{formatLastEdited(p.lastEdited)}</div>
                    <div className="mt-2">
                      <Badge className="border-cyan-500/40 bg-cyan-500/20 text-cyan-400">{p.postCount} posts</Badge>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-3 top-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
                        aria-label="Delete planner"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-slate-950 border-slate-800 text-slate-100">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete planner</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete this planner?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-slate-800 hover:bg-slate-800/50">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-500"
                          onClick={() => {
                            if (onDelete) {
                              onDelete(p.id);
                              return;
                            }
                            deletePlannerMutation.mutate(p.id);
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
  );
}

