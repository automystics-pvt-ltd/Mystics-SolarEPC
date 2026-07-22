import { useGetDPRs, getGetDPRsQueryKey } from "@workspace/api-client-react";
import { Loader2, Calendar, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";

export function ProjectDPRs({ projectId }: { projectId: number }) {
  const { data: dprs, isLoading } = useGetDPRs(
    { projectId },
    { query: { enabled: !!projectId, queryKey: getGetDPRsQueryKey({ projectId }) } }
  );

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-gray-50/50 p-4 rounded-[12px] border border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-gray-400" />
          Daily Progress Reports
        </h3>
      </div>

      {dprs?.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-[12px] h-48 flex flex-col items-center justify-center text-center p-6 bg-gray-50/50">
          <Calendar className="h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm font-bold text-gray-600">No DPRs submitted yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {dprs?.map(dpr => (
            <div key={dpr.id} className="border border-gray-200 rounded-[12px] bg-white shadow-sm p-5 flex flex-col">
              <div className="flex justify-between items-start mb-5 border-b border-gray-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-orange-50 rounded-[8px] flex items-center justify-center text-[#EA580C]">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900">{format(new Date(dpr.reportDate), 'EEEE, MMM d, yyyy')}</p>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">By {dpr.submittedByName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Progress</p>
                  <p className="font-bold text-xl text-[#EA580C] font-mono">{dpr.percentComplete || 0}%</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gray-50 p-3 rounded-[8px] border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Manpower</p>
                  <p className="font-bold text-sm text-gray-900">{dpr.manpowerCount || 0} <span className="text-xs text-gray-500 font-medium">active</span></p>
                </div>
                <div className="bg-gray-50 p-3 rounded-[8px] border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Weather</p>
                  <p className="font-bold text-sm text-gray-900">{dpr.weather || 'Not spec.'}</p>
                </div>
              </div>
              
              <div className="mt-auto">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Work Summary</p>
                <div className="text-sm font-medium text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50/50 p-3 rounded-[8px] border border-gray-100 min-h-[80px]">
                  {dpr.workSummary || <span className="italic text-gray-400">No summary provided.</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
