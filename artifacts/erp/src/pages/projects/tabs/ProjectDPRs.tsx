import { useGetDPRs, getGetDPRsQueryKey } from "@workspace/api-client-react";
import { Calendar, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { SectionCard, EmptyState, SkeletonList } from "@/components/shared";
import { motion } from "framer-motion";

export function ProjectDPRs({ projectId }: { projectId: number }) {
  const { data: dprs, isPending } = useGetDPRs(
    { projectId },
    { query: { enabled: !!projectId, queryKey: getGetDPRsQueryKey({ projectId }) } }
  );

  if (isPending) {
    return <SkeletonList rows={4} cols={3} showHeader />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionCard title="Daily Progress Reports">
        {!dprs?.length ? (
          <EmptyState
            icon={Calendar}
            title="No DPRs submitted yet"
            description="Daily progress reports will appear here once submitted."
            size="sm"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {dprs.map(dpr => (
              <div
                key={dpr.id}
                className="border border-border rounded-xl bg-card p-5 flex flex-col"
              >
                <div className="flex justify-between items-start mb-5 border-b border-border/60 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">
                        {format(new Date(dpr.reportDate), "EEEE, MMM d, yyyy")}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        By {dpr.submittedByName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Progress</p>
                    <p className="font-bold text-xl text-primary font-mono">{dpr.percentComplete || 0}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/60">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Manpower</p>
                    <p className="font-semibold text-sm text-foreground">
                      {dpr.manpowerCount || 0}{" "}
                      <span className="text-xs text-muted-foreground font-normal">active</span>
                    </p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/60">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Weather</p>
                    <p className="font-semibold text-sm text-foreground">{dpr.weather || "Not spec."}</p>
                  </div>
                </div>

                <div className="mt-auto">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Work Summary</p>
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 p-3 rounded-lg border border-border/60 min-h-[80px]">
                    {dpr.workSummary || (
                      <span className="italic text-muted-foreground">No summary provided.</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}
