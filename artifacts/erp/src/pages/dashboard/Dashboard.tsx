import { useGetCombinedDashboard, useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, TrendingUp, Users, FolderKanban, AlertCircle, FileCheck, CircleDollarSign, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

function formatCurrency(amount?: number) {
  if (!amount) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function Dashboard() {
  const { data: dashboard, isLoading: isDashboardLoading } = useGetDashboard();
  const { data: combined, isLoading: isCombinedLoading } = useGetCombinedDashboard();

  if (isDashboardLoading || isCombinedLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  const pipelineData = combined?.pipeline?.stages || [];

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground mt-1">Enterprise performance metrics and pipeline health.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard 
          title="Active Leads" 
          value={dashboard?.leadsCount?.toString()} 
          icon={Users}
          trend="+12% from last month" 
        />
        <KpiCard 
          title="Active Projects" 
          value={dashboard?.activeProjectsCount?.toString()} 
          icon={FolderKanban}
        />
        <KpiCard 
          title="Pending Approvals" 
          value={dashboard?.pendingApprovalsCount?.toString()} 
          icon={FileCheck}
          valueClass={dashboard?.pendingApprovalsCount ? "text-accent" : ""}
        />
        <KpiCard 
          title="Overdue Tasks" 
          value={dashboard?.overdueTasksCount?.toString()} 
          icon={AlertCircle}
          valueClass={dashboard?.overdueTasksCount ? "text-destructive" : ""}
        />
        <KpiCard 
          title="Total Contract Value" 
          value={formatCurrency(dashboard?.totalContractValue)} 
          icon={TrendingUp}
        />
        <KpiCard 
          title="A/R Outstanding" 
          value={formatCurrency(dashboard?.invoiceOutstanding)} 
          icon={CircleDollarSign}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Pipeline Chart */}
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Sales Pipeline</CardTitle>
            <CardDescription>
              {combined?.pipeline?.totalLeads} active leads across all stages
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="stage" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    dx={-10}
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.stage === 'Closed Won' ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.7)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Summary */}
        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Project Portfolio</CardTitle>
            <CardDescription>Execution health and financials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex justify-between items-end border-b pb-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Budget</p>
                  <p className="text-2xl font-bold">{formatCurrency(combined?.portfolioSummary?.totalBudget)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">Actual Spend</p>
                  <p className="text-2xl font-bold">{formatCurrency(combined?.portfolioSummary?.totalActualSpend)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium">On Track</span>
                  </div>
                  <p className="text-2xl font-bold">{combined?.portfolioSummary?.onTrackCount || 0}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border border-destructive/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Delayed</span>
                  </div>
                  <p className="text-2xl font-bold text-destructive">{combined?.portfolioSummary?.delayedCount || 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actionable Tables */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Leads */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base">Recent Leads</CardTitle>
            </div>
            <Link href="/crm/leads" className="text-sm text-primary hover:underline">View All</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-4">
              {dashboard?.recentLeads?.map(lead => (
                <Link key={lead.id} href={`/crm/leads/${lead.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border">
                    <div>
                      <p className="text-sm font-medium">{lead.companyName || 'Unknown Company'}</p>
                      <p className="text-xs text-muted-foreground">{lead.contactName}</p>
                    </div>
                    <Badge variant={lead.status === 'New' ? 'default' : 'secondary'}>
                      {lead.status}
                    </Badge>
                  </div>
                </Link>
              ))}
              {!dashboard?.recentLeads?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent leads</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Projects */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base">Active Projects</CardTitle>
            </div>
            <Link href="/projects" className="text-sm text-primary hover:underline">View All</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-4">
              {dashboard?.recentProjects?.map(project => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${project.percentComplete || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{project.percentComplete || 0}%</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Escalations */}
        <Card className="shadow-sm border-destructive/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Open Escalations
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-4">
              {dashboard?.openEscalations?.map(esc => (
                <div key={esc.id} className="p-3 rounded-md border border-border bg-destructive/5 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium leading-tight">{esc.reason}</p>
                    <Badge variant={esc.severity === 'Critical' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
                      {esc.severity}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{esc.module}</span>
                    <span>{format(new Date(esc.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              ))}
              {!dashboard?.openEscalations?.length && (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No active escalations</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, trend, valueClass }: any) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col">
          <span className={`text-2xl font-bold tracking-tight ${valueClass || ""}`}>{value || "0"}</span>
          {trend && (
            <span className="text-xs text-muted-foreground mt-1">{trend}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
