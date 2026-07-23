import { useGetProjectBudgetVsActual, getGetProjectBudgetVsActualQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, DollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { SectionCard, StatCard, EmptyState, SkeletonStats } from "@/components/shared";
import { motion } from "framer-motion";

export function ProjectBudget({ projectId }: { projectId: number }) {
  const { data: budget, isLoading } = useGetProjectBudgetVsActual(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectBudgetVsActualQueryKey(projectId) }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonStats count={4} />
      </div>
    );
  }

  const isOverBudget = (budget?.totalVariance ?? 0) > 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Budget"
          value={`₹${(budget?.totalBudgeted ?? 0).toLocaleString("en-IN")}`}
          icon={Wallet}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <StatCard
          label="Committed (POs)"
          value={`₹${(budget?.totalCommitted ?? 0).toLocaleString("en-IN")}`}
          icon={DollarSign}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          label="Actual Spend"
          value={`₹${(budget?.totalActual ?? 0).toLocaleString("en-IN")}`}
          icon={TrendingDown}
          iconColor="text-orange-600"
          iconBg="bg-orange-100"
        />
        <StatCard
          label="Variance"
          value={`₹${Math.abs(budget?.totalVariance ?? 0).toLocaleString("en-IN")}`}
          icon={isOverBudget ? TrendingUp : TrendingDown}
          iconColor={isOverBudget ? "text-red-600" : "text-emerald-600"}
          iconBg={isOverBudget ? "bg-red-100" : "bg-emerald-100"}
          trendLabel={isOverBudget ? "Over budget" : "Under budget"}
          trend={isOverBudget ? "up" : "down"}
          className={isOverBudget ? "border-red-200 bg-red-50/30" : "border-emerald-200 bg-emerald-50/30"}
        />
      </div>

      {/* Line Items Table */}
      <SectionCard title="Budget vs Actuals" noPadding>
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-5">Cost Head</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Budgeted</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Committed</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actual</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right px-5">Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budget?.lines?.map((line, idx) => (
              <TableRow key={idx} className="border-b border-border/40 hover:bg-muted/20">
                <TableCell className="px-5 py-3 font-semibold text-sm text-foreground">{line.costHead}</TableCell>
                <TableCell className="py-3 text-right font-mono font-semibold text-sm text-muted-foreground">
                  ₹{line.budgeted.toLocaleString("en-IN")}
                </TableCell>
                <TableCell className="py-3 text-right font-mono text-sm text-muted-foreground">
                  ₹{line.committed.toLocaleString("en-IN")}
                </TableCell>
                <TableCell className="py-3 text-right font-mono font-semibold text-sm text-foreground">
                  ₹{line.actual.toLocaleString("en-IN")}
                </TableCell>
                <TableCell className={`px-5 py-3 text-right font-mono font-semibold text-sm ${line.variance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  ₹{Math.abs(line.variance).toLocaleString("en-IN")}
                  <span className="text-[10px] ml-1">{line.variance > 0 ? "▼" : "▲"}</span>
                </TableCell>
              </TableRow>
            ))}
            {!budget?.lines?.length && (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={PieChart}
                    title="No budget lines defined"
                    description="Budget line items will appear here once configured."
                    size="sm"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>
    </motion.div>
  );
}
