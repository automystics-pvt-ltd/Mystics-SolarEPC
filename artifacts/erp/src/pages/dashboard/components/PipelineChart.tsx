import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { BarChart2 } from "lucide-react";
import { SectionCard, EmptyState } from "@/components/shared";

export interface PipelineStage {
  name?: string;
  stage?: string;
  count: number;
  value?: number;
}

interface PipelineChartProps {
  stages: PipelineStage[];
  isLoading?: boolean;
}

function formatCurrency(amount?: number | null): string {
  if (!amount) return "₹0";
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)} L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}k`;
  return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// Stage-to-color: blue → emerald gradient (New → Won)
const STAGE_COLORS: Record<string, string> = {
  New: "#3b82f6",
  Contacted: "#6366f1",
  Qualified: "#8b5cf6",
  Proposal: "#f59e0b",
  Negotiation: "#f97316",
  Won: "#10b981",
  Closed: "#10b981",
  Lost: "#ef4444",
};

const DEFAULT_COLORS = [
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#f59e0b",
  "#f97316",
  "#10b981",
];

function stageName(s: PipelineStage): string {
  return s.name ?? s.stage ?? "";
}

function stageColor(s: PipelineStage, idx: number): string {
  const name = stageName(s);
  return STAGE_COLORS[name] ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as PipelineStage;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3.5 py-2.5 text-[12px]">
      <p className="font-bold text-foreground mb-1.5">{stageName(data)}</p>
      <p className="text-muted-foreground">
        Leads:{" "}
        <span className="font-semibold text-foreground">{data.count}</span>
      </p>
      {data.value != null && data.value > 0 && (
        <p className="text-muted-foreground">
          Pipeline:{" "}
          <span className="font-semibold text-foreground">
            {formatCurrency(data.value)}
          </span>
        </p>
      )}
    </div>
  );
}

export function PipelineChart({ stages, isLoading }: PipelineChartProps) {
  if (isLoading) {
    return (
      <SectionCard title="Lead Pipeline" subtitle="Leads by stage">
        <div className="h-[240px] bg-muted animate-pulse rounded-lg" />
      </SectionCard>
    );
  }

  // Sort by canonical stage order
  const stageOrder = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Closed", "Lost"];
  const sorted = [...stages].sort((a, b) => {
    const ai = stageOrder.indexOf(stageName(a));
    const bi = stageOrder.indexOf(stageName(b));
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // Compute total for percentage
  const total = sorted.reduce((s, st) => s + st.count, 0);

  return (
    <SectionCard
      title="Lead Pipeline"
      subtitle="Leads by stage"
      badge={
        total > 0 ? (
          <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {total} total
          </span>
        ) : undefined
      }
    >
      {sorted.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="No pipeline data"
          description="Pipeline stages will appear here once leads are created."
          size="sm"
        />
      ) : (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sorted}
              margin={{ top: 20, right: 8, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey={(s: PipelineStage) => stageName(s)}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                  fontWeight: 500,
                }}
                tickFormatter={(v: string) => (v.length > 10 ? v.slice(0, 10) + "…" : v)}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                width={28}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", radius: 4 }} />
              <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={52}>
                <LabelList
                  dataKey="count"
                  position="top"
                  style={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
                {sorted.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={stageColor(entry, index)}
                    fillOpacity={0.88}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}
