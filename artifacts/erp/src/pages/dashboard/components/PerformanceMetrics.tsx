import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/shared";

interface PerformanceMetricsProps {
  deliveryRate?: number;
  collectionRate?: number;
  grnAcceptanceRate?: number;
  isLoading?: boolean;
}

interface MetricCardProps {
  label: string;
  value: number;
  sublabel: string;
  barColor: string;
  valueColor: string;
}

function getQualityLabel(pct: number): { text: string; color: string } {
  if (pct >= 85) return { text: "Excellent", color: "text-emerald-600 dark:text-emerald-400" };
  if (pct >= 70) return { text: "Good", color: "text-blue-600 dark:text-blue-400" };
  if (pct >= 50) return { text: "Fair", color: "text-amber-600 dark:text-amber-400" };
  return { text: "Needs Attention", color: "text-red-600 dark:text-red-400" };
}

function MetricCard({ label, value, sublabel, barColor, valueColor }: MetricCardProps) {
  const pct = Math.min(100, Math.max(0, isNaN(value) ? 0 : value));
  const { text: qualityText, color: qualityColor } = getQualityLabel(pct);

  return (
    <div className="flex-1 min-w-0 bg-card border border-border rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex items-baseline gap-2 mb-1">
        <p className={cn("text-[26px] font-bold leading-tight tabular-nums", valueColor)}>
          {pct.toFixed(1)}%
        </p>
        <span className={cn("text-[11px] font-semibold", qualityColor)}>
          {qualityText}
        </span>
      </div>
      {/* Progress track */}
      <div className="mt-2.5 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">{sublabel}</p>
    </div>
  );
}

export function PerformanceMetrics({
  deliveryRate,
  collectionRate,
  grnAcceptanceRate,
  isLoading,
}: PerformanceMetricsProps) {
  if (isLoading) {
    return (
      <SectionCard title="Performance Metrics" subtitle="Current fiscal year">
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse"
            >
              <div className="h-3 bg-muted rounded-full w-24" />
              <div className="h-7 bg-muted rounded-full w-16" />
              <div className="h-2 bg-muted rounded-full" />
              <div className="h-3 bg-muted rounded-full w-32" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Performance Metrics" subtitle="Current fiscal year">
      <div className="flex flex-col sm:flex-row gap-4">
        <MetricCard
          label="On-Time Delivery"
          value={deliveryRate ?? 0}
          sublabel="Projects completed on schedule"
          barColor="bg-blue-500"
          valueColor="text-blue-600 dark:text-blue-400"
        />
        <MetricCard
          label="Invoice Collection"
          value={collectionRate ?? 0}
          sublabel="Receivables collected vs raised"
          barColor="bg-emerald-500"
          valueColor="text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          label="GRN Acceptance Rate"
          value={grnAcceptanceRate ?? 0}
          sublabel="GRNs approved without rejection"
          barColor="bg-violet-500"
          valueColor="text-violet-600 dark:text-violet-400"
        />
      </div>
    </SectionCard>
  );
}
