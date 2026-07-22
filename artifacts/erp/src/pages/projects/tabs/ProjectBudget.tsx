import { useGetProjectBudgetVsActual, getGetProjectBudgetVsActualQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export function ProjectBudget({ projectId }: { projectId: number }) {
  const { data: budget, isLoading } = useGetProjectBudgetVsActual(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectBudgetVsActualQueryKey(projectId) }
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Budget vs Actuals</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground font-medium">Total Budget</p>
            <p className="text-xl font-bold mt-1">${budget?.totalBudgeted?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground font-medium">Committed (POs)</p>
            <p className="text-xl font-bold mt-1">${budget?.totalCommitted?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground font-medium">Actual Spend</p>
            <p className="text-xl font-bold mt-1">${budget?.totalActual?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card className={`border ${budget?.totalVariance && budget.totalVariance > 0 ? 'border-destructive/50 bg-destructive/5' : 'border-emerald-500/50 bg-emerald-500/5'}`}>
          <CardContent className="p-4">
            <p className="text-sm font-medium">Variance</p>
            <p className="text-xl font-bold mt-1">${Math.abs(budget?.totalVariance || 0).toLocaleString()}</p>
            <p className="text-xs mt-1">{budget?.totalVariance && budget.totalVariance > 0 ? 'Over budget' : 'Under budget'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 border-b"><CardTitle className="text-base">Cost Heads</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Cost Head</TableHead>
                <TableHead className="text-right">Budgeted</TableHead>
                <TableHead className="text-right">Committed</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budget?.lines?.map((line, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{line.costHead}</TableCell>
                  <TableCell className="text-right">${line.budgeted.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">${line.committed.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">${line.actual.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-medium ${line.variance > 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                    ${Math.abs(line.variance).toLocaleString()} {line.variance > 0 ? '▼' : '▲'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
