import { useGetProjectDashboard, getGetProjectDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, TrendingUp, AlertTriangle, FileCheck, CheckCircle2, Calendar, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";

export function ProjectOverview({ projectId }: { projectId: number }) {
  const { data: dashboard, isLoading } = useGetProjectDashboard(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectDashboardQueryKey(projectId) }
  });

  if (isLoading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>;
  }

  const bg = dashboard?.budgetSummary;
  const health = bg ? (bg.totalVariance > 0 ? "Over Budget" : "On Budget") : "Unknown";

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-medium text-muted-foreground">Budget Health</p>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold tracking-tight">${bg?.totalActual?.toLocaleString() || 0}</p>
          <p className={`text-xs mt-1 ${health === 'Over Budget' ? 'text-destructive' : 'text-emerald-500'}`}>
            {health} (Variance: ${bg?.totalVariance?.toLocaleString() || 0})
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-medium text-muted-foreground">Activities</p>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold tracking-tight">{dashboard?.activitiesCount || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Total scheduled tasks</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-destructive/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-medium text-destructive">Open Issues</p>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-2xl font-bold text-destructive tracking-tight">{dashboard?.openEscalationsCount || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Require immediate attention</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-accent/20">
        <CardContent className="p-6 bg-accent/5">
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-medium text-accent-foreground">Pending Procurement</p>
            <FileCheck className="h-4 w-4 text-accent" />
          </div>
          <p className="text-2xl font-bold text-accent-foreground tracking-tight">{dashboard?.openMRsCount || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Open material requests</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Last Daily Progress Report (DPR)</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard?.lastDPR ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <div>
                  <p className="font-medium text-lg">{format(new Date(dashboard.lastDPR.reportDate), 'MMM d, yyyy')}</p>
                  <p className="text-sm text-muted-foreground">Submitted by {dashboard.lastDPR.submittedByName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">Progress</p>
                  <p className="text-2xl font-bold text-primary">{dashboard.lastDPR.percentComplete || 0}%</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Work Summary</p>
                <p className="text-sm mt-1">{dashboard.lastDPR.workSummary || 'No summary provided.'}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Calendar className="h-8 w-8 mb-2 opacity-50" />
              <p>No DPRs submitted yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboard?.upcomingMilestones?.map(m => (
              <div key={m.id} className="flex justify-between items-center p-3 rounded-lg border bg-muted/20">
                <div>
                  <p className="font-medium">{m.milestoneName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.dueDate ? format(new Date(m.dueDate), 'MMM d, yyyy') : 'No due date'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">${m.amount.toLocaleString()}</p>
                </div>
              </div>
            ))}
            {!dashboard?.upcomingMilestones?.length && (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 opacity-50 mx-auto" />
                <p>No pending milestones.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
