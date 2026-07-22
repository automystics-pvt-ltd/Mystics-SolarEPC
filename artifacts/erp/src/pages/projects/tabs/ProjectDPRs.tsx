import { useGetDPRs, getGetDPRsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";

export function ProjectDPRs({ projectId }: { projectId: number }) {
  const { data: dprs, isLoading } = useGetDPRs(
    { projectId },
    { query: { enabled: !!projectId, queryKey: getGetDPRsQueryKey({ projectId }) } }
  );

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Daily Progress Reports</h3>
      {dprs?.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
            No DPRs submitted yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dprs?.map(dpr => (
            <Card key={dpr.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4 border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold">{format(new Date(dpr.reportDate), 'EEEE, MMM d, yyyy')}</p>
                      <p className="text-xs text-muted-foreground mt-1">Submitted by {dpr.submittedByName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="font-bold text-xl text-primary">{dpr.percentComplete || 0}%</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-muted/30 p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground">Manpower</p>
                    <p className="font-semibold">{dpr.manpowerCount || 0} active</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground">Weather</p>
                    <p className="font-semibold">{dpr.weather || 'Not specified'}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-1">Work Summary</p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/10 p-3 rounded border">
                    {dpr.workSummary || 'No summary provided.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
