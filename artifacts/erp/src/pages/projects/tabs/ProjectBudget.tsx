import { useGetProjectBudgetVsActual, getGetProjectBudgetVsActualQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, PieChart } from "lucide-react";

export function ProjectBudget({ projectId }: { projectId: number }) {
  const { data: budget, isLoading } = useGetProjectBudgetVsActual(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectBudgetVsActualQueryKey(projectId) }
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-gray-50/50 p-4 rounded-[12px] border border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <PieChart className="h-4 w-4 text-gray-400" />
          Budget vs Actuals
        </h3>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-[12px] border border-gray-200 bg-white shadow-sm flex flex-col justify-between h-[100px]">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Total Budget</p>
          <p className="text-2xl font-bold font-mono tracking-tight text-gray-900">₹{budget?.totalBudgeted?.toLocaleString("en-IN") || 0}</p>
        </div>
        <div className="p-5 rounded-[12px] border border-gray-200 bg-white shadow-sm flex flex-col justify-between h-[100px]">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Committed (POs)</p>
          <p className="text-2xl font-bold font-mono tracking-tight text-gray-900">₹{budget?.totalCommitted?.toLocaleString("en-IN") || 0}</p>
        </div>
        <div className="p-5 rounded-[12px] border border-gray-200 bg-white shadow-sm flex flex-col justify-between h-[100px]">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Actual Spend</p>
          <p className="text-2xl font-bold font-mono tracking-tight text-gray-900">₹{budget?.totalActual?.toLocaleString("en-IN") || 0}</p>
        </div>
        <div className={`p-5 rounded-[12px] border flex flex-col justify-between h-[100px] ${budget?.totalVariance && budget.totalVariance > 0 ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
          <div className="flex justify-between items-start">
            <p className={`text-[11px] font-bold uppercase tracking-widest ${budget?.totalVariance && budget.totalVariance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>Variance</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider ${budget?.totalVariance && budget.totalVariance > 0 ? 'bg-red-200/50 text-red-800' : 'bg-emerald-200/50 text-emerald-800'}`}>
              {budget?.totalVariance && budget.totalVariance > 0 ? 'Over' : 'Under'}
            </span>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight">₹{Math.abs(budget?.totalVariance || 0).toLocaleString("en-IN")}</p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-[12px] overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-100 bg-gray-50/80 hover:bg-gray-50/80">
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 px-5">Cost Head</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Budgeted</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Committed</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Actual</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right px-5">Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budget?.lines?.map((line, idx) => (
              <TableRow key={idx} className="border-b border-gray-50 hover:bg-gray-50/30">
                <TableCell className="px-5 py-3 font-bold text-sm text-gray-900">{line.costHead}</TableCell>
                <TableCell className="py-3 text-right font-mono font-bold text-sm text-gray-600">₹{line.budgeted.toLocaleString("en-IN")}</TableCell>
                <TableCell className="py-3 text-right font-mono font-medium text-gray-500">₹{line.committed.toLocaleString("en-IN")}</TableCell>
                <TableCell className="py-3 text-right font-mono font-bold text-sm text-gray-900">₹{line.actual.toLocaleString("en-IN")}</TableCell>
                <TableCell className={`px-5 py-3 text-right font-mono font-bold text-sm flex items-center justify-end gap-1.5 ${line.variance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  ₹{Math.abs(line.variance).toLocaleString("en-IN")} <span className="text-[10px]">{line.variance > 0 ? '▼' : '▲'}</span>
                </TableCell>
              </TableRow>
            ))}
            {!budget?.lines?.length && (
              <TableRow><TableCell colSpan={5} className="text-center h-24 text-gray-500 font-medium text-sm">No budget lines defined.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
