import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { plannerService, type PlannerSummary } from "@/services/plannerService";
import { toast } from "@/hooks/use-toast";

export function usePlanners() {
  const qc = useQueryClient();

  const plannersQuery = useQuery<PlannerSummary[]>({
    queryKey: ["planners"],
    queryFn: () => plannerService.list(1, 50),
  });

  const deletePlannerMutation = useMutation({
    mutationKey: ["planner-delete"],
    mutationFn: async (id: string) => plannerService.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["planners"] });
      const previous = qc.getQueryData<PlannerSummary[]>(["planners"]);
      qc.setQueryData<PlannerSummary[]>(["planners"], (old) => (old || []).filter((p) => p.id !== id));
      toast({ title: "Planner deleted", variant: "success" });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(["planners"], ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["planners"] });
    },
  });

  return { plannersQuery, deletePlannerMutation };
}

