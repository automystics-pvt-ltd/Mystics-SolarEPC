import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)} L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}k`;
  return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const ORANGE_PALETTE = [
  "#f97316",
  "#fb923c",
  "#fdba74",
  "#fed7aa",
  "#ffedd5",
  "#ea580c",
];

function stageName(s: PipelineStage): string {
  return s.name ?? s.stage ?? "";
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as PipelineStage;
  return (
    <div className="bg-card border border-border rounded-lg shadow-md px-3 py-2 text-[12px]">
      <p className="font-bold text-foreground mb-1">{stageName(data)}</p>
      <p className="text-muted-foreground">
        Count: <span className="font-semibold text-foreground">{data.count}</span>
      </p>
      {data.value != null && (
        <p className="text-muted-foreground">
          Value: <span className="font-semibold text-foreground">{formatCurrency(data.value)}</span>
        </p>
      )}
    </div>
  );
}

export function PipelineChart({ stages, isLoading }: PipelineChartProps) {
  if (isLoading) {
    return (
      <SectionCard title="Project Pipeline" subtitle="By stage — current portfolio">
        <div className="h-[260px] bg-muted animate-pulse rounded-lg" />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Project Pipeline" subtitle="By stage — current portfolio">
      {stages.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="No pipeline data"
          description="Pipeline stages will appear here once leads are created."
          size="sm"
        />
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stages}
              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
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
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 500 }}
                tickFormatter={(v: string) =>
                  v.length > 12 ? v.slice(0, 12) + "…" : v
                }
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                width={30}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {stages.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={ORANGE_PALETTE[index % ORANGE_PALETTE.length]}
                    fillOpacity={1 - index * 0.06}
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
