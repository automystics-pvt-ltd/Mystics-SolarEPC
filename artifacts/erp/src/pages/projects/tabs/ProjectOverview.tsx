import { useGetProjectDashboard, getGetProjectDashboardQueryKey } from "@workspace/api-client-react";
import { Loader2, TrendingUp, AlertTriangle, FileCheck, CheckCircle2, Calendar, ClipboardCheck, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export function ProjectOverview({ projectId }: { projectId: number }) {
  const { data: dashboard, isLoading } = useGetProjectDashboard(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectDashboardQueryKey(projectId) }
  });

  if (isLoading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
  }

  const bg = dashboard?.budgetSummary;
  const isOverBudget = bg ? bg.totalVariance > 0 : false;
  const health = bg ? (isOverBudget ? "Over Budget" : "On Budget") : "Unknown";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* KPIs */}
      <div className={`rounded-[12px] p-5 border flex flex-col justify-between ${isOverBudget ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
        <div className="flex justify-between items-start mb-4">
          <p className={`text-[11px] font-bold uppercase tracking-widest ${isOverBudget ? 'text-red-600' : 'text-emerald-700'}`}>Budget Health</p>
          <div className={`p-1.5 rounded-md ${isOverBudget ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className={`text-2xl font-bold tracking-tight font-mono ${isOverBudget ? 'text-red-700' : 'text-emerald-800'}`}>${bg?.totalActual?.toLocaleString() || 0}</p>
          <p className={`text-xs font-bold mt-1 flex items-center gap-1 ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
            {isOverBudget ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {health} (Var: ${Math.abs(bg?.totalVariance || 0).toLocaleString()})
          </p>
        </div>
      </div>

      <div className="rounded-[12px] p-5 border border-gray-100 bg-gray-50 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Activities</p>
          <div className="p-1.5 rounded-md bg-white text-gray-600 shadow-sm">
            <ClipboardCheck className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-gray-900">{dashboard?.activitiesCount || 0}</p>
          <p className="text-xs font-medium mt-1 text-gray-500">Total scheduled tasks</p>
        </div>
      </div>

      <div className="rounded-[12px] p-5 border border-red-100 bg-red-50/50 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-red-600">Open Issues</p>
          <div className="p-1.5 rounded-md bg-red-100 text-red-600 shadow-sm">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-red-700">{dashboard?.openEscalationsCount || 0}</p>
          <p className="text-xs font-medium mt-1 text-red-500">Require immediate attention</p>
        </div>
      </div>

      <div className="rounded-[12px] p-5 border border-blue-100 bg-blue-50/50 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Pending Proc.</p>
          <div className="p-1.5 rounded-md bg-blue-100 text-blue-600 shadow-sm">
            <FileCheck className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-blue-700">{dashboard?.openMRsCount || 0}</p>
          <p className="text-xs font-medium mt-1 text-blue-500">Open material requests</p>
        </div>
      </div>

      {/* Main content panels */}
      <div className="md:col-span-2 rounded-[12px] border border-gray-100 p-5 bg-white">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-5">Last Daily Progress Report (DPR)</h3>
        {dashboard?.lastDPR ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-orange-50 text-[#EA580C] flex items-center justify-center">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{format(new Date(dashboard.lastDPR.reportDate), 'MMM d, yyyy')}</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">Submitted by {dashboard.lastDPR.submittedByName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Progress</p>
                <p className="text-xl font-bold text-[#EA580C]">{dashboard.lastDPR.percentComplete || 0}%</p>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-[8px] border border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Work Summary</p>
              <p className="text-sm text-gray-700 leading-relaxed font-medium">{dashboard.lastDPR.workSummary || 'No summary provided.'}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <Calendar className="h-8 w-8 mb-3 opacity-20" />
            <p className="text-sm font-medium">No DPRs submitted yet.</p>
          </div>
        )}
      </div>

      <div className="md:col-span-2 rounded-[12px] border border-gray-100 p-5 bg-white">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-5">Upcoming Milestones</h3>
        <div className="space-y-3">
          {dashboard?.upcomingMilestones?.map(m => (
            <div key={m.id} className="flex justify-between items-center p-4 rounded-[8px] border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
              <div>
                <p className="font-bold text-sm text-gray-900">{m.milestoneName}</p>
                <p className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-wider">Due: {m.dueDate ? format(new Date(m.dueDate), 'MMM d, yyyy') : 'No due date'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900 font-mono text-[15px]">${m.amount.toLocaleString()}</p>
              </div>
            </div>
          ))}
          {!dashboard?.upcomingMilestones?.length && (
            <div className="text-center py-10 text-gray-400 flex flex-col items-center justify-center">
              <CheckCircle2 className="h-8 w-8 mb-3 opacity-20" />
              <p className="text-sm font-medium">No pending milestones.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
