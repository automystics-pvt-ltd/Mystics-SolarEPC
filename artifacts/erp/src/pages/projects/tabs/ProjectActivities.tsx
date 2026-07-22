import { useState } from "react";
import { useGetProjectActivities, useCreateActivity, getGetProjectActivitiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, differenceInDays, parseISO } from "date-fns";

const createActivitySchema = z.object({
  wbsCode: z.string().optional(),
  name: z.string().min(1, "Name required"),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
});

export function ProjectActivities({ projectId }: { projectId: number }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: activities, isLoading } = useGetProjectActivities(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectActivitiesQueryKey(projectId) }
  });

  const form = useForm<z.infer<typeof createActivitySchema>>({
    resolver: zodResolver(createActivitySchema),
    defaultValues: { name: "" }
  });

  const createMutation = useCreateActivity({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectActivitiesQueryKey(projectId) });
        setIsCreateOpen(false);
        form.reset();
      }
    }
  });

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Prep Gantt data
  let ganttData: any[] = [];
  if (activities && activities.length > 0) {
    // Find min start date
    const validDates = activities.filter(a => a.plannedStart && a.plannedEnd);
    if (validDates.length > 0) {
      const minDateStr = validDates.reduce((min, a) => a.plannedStart! < min ? a.plannedStart! : min, validDates[0].plannedStart!);
      const minDate = parseISO(minDateStr);
      
      ganttData = validDates.map(a => {
        const start = parseISO(a.plannedStart!);
        const end = parseISO(a.plannedEnd!);
        const offset = differenceInDays(start, minDate);
        const duration = differenceInDays(end, start) || 1;
        return {
          id: a.id,
          name: a.name,
          offset, // Empty space before bar starts
          duration, // Actual bar width
          status: a.status,
          start: a.plannedStart,
          end: a.plannedEnd
        };
      }).sort((a, b) => a.offset - b.offset); // Sort chronologically
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
          <p className="font-bold text-sm mb-1">{data.name}</p>
          <p className="text-xs text-muted-foreground">Start: {format(parseISO(data.start), 'MMM d, yyyy')}</p>
          <p className="text-xs text-muted-foreground">End: {format(parseISO(data.end), 'MMM d, yyyy')}</p>
          <Badge className="mt-2 text-[10px]" variant="outline">{data.status}</Badge>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Project Schedule</h3>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Activity</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Activity</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate({ data: { ...d, projectId } }))} className="space-y-4">
                <FormField control={form.control} name="wbsCode" render={({ field }) => (
                  <FormItem><FormLabel>WBS Code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Activity Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="plannedStart" render={({ field }) => (
                    <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="plannedEnd" render={({ field }) => (
                    <FormItem><FormLabel>End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>Add</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {ganttData.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Gantt Chart (Days from project start)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ganttData} layout="vertical" margin={{ top: 0, right: 30, left: 100, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="hsl(var(--border))" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.5)' }} />
                  {/* Invisible bar for the offset */}
                  <Bar dataKey="offset" stackId="a" fill="transparent" />
                  {/* Visible bar for duration */}
                  <Bar dataKey="duration" stackId="a" radius={[4, 4, 4, 4]}>
                    {ganttData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={
                        entry.status === 'Completed' ? 'hsl(var(--primary))' : 
                        entry.status === 'In Progress' ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground)/0.5)'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[100px]">WBS</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities?.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.wbsCode || '-'}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.plannedStart ? format(parseISO(a.plannedStart), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{a.plannedEnd ? format(parseISO(a.plannedEnd), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${a.percentComplete || 0}%` }} />
                      </div>
                      <span className="text-xs">{a.percentComplete || 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === 'Completed' ? 'default' : a.status === 'In Progress' ? 'secondary' : 'outline'}>
                      {a.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!activities?.length && (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No activities scheduled.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
