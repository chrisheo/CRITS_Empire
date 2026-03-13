import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { plansApi } from "@/api/plans";
import { queryKeys } from "@/lib/queryKeys";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { EmptyState } from "@/components/EmptyState";
import { MarkdownBody } from "@/components/MarkdownBody";
import { cn } from "@/lib/utils";

function formatDate(value: string | null): string {
  if (!value) return "Undated";
  return value;
}

export function Plans() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Plans" }]);
  }, [setBreadcrumbs]);

  const listQuery = useQuery({
    queryKey: queryKeys.plans.list,
    queryFn: () => plansApi.list(),
  });

  const plans = listQuery.data?.plans ?? [];

  useEffect(() => {
    if (!plans.length) {
      setSelectedPlanId(null);
      return;
    }
    if (!selectedPlanId || !plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(plans[0]?.id ?? null);
    }
  }, [plans, selectedPlanId]);

  const detailQuery = useQuery({
    queryKey: queryKeys.plans.detail(selectedPlanId ?? ""),
    queryFn: () => plansApi.get(selectedPlanId ?? ""),
    enabled: !!selectedPlanId,
  });

  const groupedPlans = useMemo(() => {
    const map = new Map<string, typeof plans>();
    for (const plan of plans) {
      const key = formatDate(plan.date);
      const existing = map.get(key) ?? [];
      existing.push(plan);
      map.set(key, existing);
    }
    return [...map.entries()];
  }, [plans]);

  if (listQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading plans...</p>;
  }

  if (listQuery.error) {
    return <p className="text-sm text-destructive">{listQuery.error.message}</p>;
  }

  if (plans.length === 0) {
    return <EmptyState icon={ScrollText} message="No plan documents found." />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border border-border bg-card/30 max-h-[calc(100vh-180px)] overflow-y-auto">
        <div className="p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
          Plans by date
        </div>
        <div className="p-2 space-y-3">
          {groupedPlans.map(([date, items]) => (
            <section key={date} className="space-y-1">
              <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {date}
              </h3>
              <div className="space-y-0.5">
                {items.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors",
                      selectedPlanId === plan.id && "bg-accent text-foreground",
                    )}
                  >
                    <div className="font-medium truncate">{plan.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{plan.source}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <main className="border border-border bg-card/30 min-h-[300px]">
        {detailQuery.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading document...</p>}
        {detailQuery.error && <p className="p-4 text-sm text-destructive">{detailQuery.error.message}</p>}
        {detailQuery.data && (
          <div className="p-4 space-y-4">
            <div>
              <h1 className="text-lg font-semibold">{detailQuery.data.name}</h1>
              <p className="text-xs text-muted-foreground">
                {detailQuery.data.relativePath} · updated {new Date(detailQuery.data.updatedAt).toLocaleString()}
              </p>
            </div>
            <MarkdownBody>{detailQuery.data.content}</MarkdownBody>
          </div>
        )}
      </main>
    </div>
  );
}
