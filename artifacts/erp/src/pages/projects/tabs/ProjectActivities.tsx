import { useState } from "react";
import { useGetProjectActivities, useCreateActivity, getGetProjectActivitiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, CalendarRange } from "lucide-react";
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
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
  }

  // Prep Gantt data
  let ganttData: any[] = [];
  if (activities && activities.length > 0) {
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
          offset,
          duration,
          status: a.status,
          start: a.plannedStart,
          end: a.plannedEnd
        };
      }).sort((a, b) => a.offset - b.offset);
    }
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border-none p-3 rounded-[8px] shadow-lg text-white">
          <p className="font-bold text-sm mb-2 leading-tight">{data.name}</p>
          <div className="space-y-1">
            <p className="text-xs text-gray-300"><span className="text-gray-500 w-10 inline-block font-bold uppercase tracking-wider">Start</span> {format(parseISO(data.start), 'MMM d, yyyy')}</p>
            <p className="text-xs text-gray-300"><span className="text-gray-500 w-10 inline-block font-bold uppercase tracking-wider">End</span> {format(parseISO(data.end), 'MMM d, yyyy')}</p>
          </div>
          <Badge className={`mt-3 text-[10px] uppercase font-bold tracking-wider rounded-[4px] border-none ${data.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white'}`} variant="outline">{data.status}</Badge>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-[12px] border border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-gray-400" />
          Project Schedule
        </h3>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0C1445] hover:bg-[#0A0F2C] text-white font-bold rounded-[6px] h-8 shadow-none"><Plus className="h-4 w-4 mr-1.5" /> Add Activity</Button>
          </DialogTrigger>
          <DialogContent className="p-6">
            <DialogHeader className="mb-4"><DialogTitle className="text-xl font-bold tracking-tight">New Activity</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate({ id: projectId, data: { ...d } }))} className="space-y-5">
                <FormField control={form.control} name="wbsCode" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">WBS Code</FormLabel><FormControl><Input className="h-10 bg-gray-50 font-mono" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Activity Name</FormLabel><FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="plannedStart" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Start Date</FormLabel><FormControl><Input className="h-10 bg-gray-50" type="date" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="plannedEnd" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">End Date</FormLabel><FormControl><Input className="h-10 bg-gray-50" type="date" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-[8px] mt-2" disabled={createMutation.isPending}>Add Activity</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {ganttData.length > 0 && (
        <div className="border border-gray-100 rounded-[12px] p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6">Gantt View</p>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ganttData} layout="vertical" margin={{ top: 0, right: 20, left: 120, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f3f4f6" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: '#4B5563', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="offset" stackId="a" fill="transparent" />
                <Bar dataKey="duration" stackId="a" radius={[4, 4, 4, 4]} barSize={16}>
                  {ganttData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={
                      entry.status === 'Completed' ? '#10B981' : 
                      entry.status === 'In Progress' ? '#EA580C' : '#E5E7EB'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="border border-gray-100 rounded-[12px] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50/50">
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-500 px-5 w-[100px]">WBS</TableHead>
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-500">Activity</TableHead>
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-500">Start</TableHead>
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-500">End</TableHead>
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-500">Progress</TableHead>
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-500 px-5">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities?.map(a => (
              <TableRow key={a.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                <TableCell className="px-5 py-3 font-mono text-xs font-bold text-gray-500">{a.wbsCode || '-'}</TableCell>
                <TableCell className="py-3 font-bold text-sm text-gray-900 leading-tight">{a.name}</TableCell>
                <TableCell className="py-3 text-xs font-medium text-gray-600">{a.plannedStart ? format(parseISO(a.plannedStart), 'MMM d, yyyy') : '-'}</TableCell>
                <TableCell className="py-3 text-xs font-medium text-gray-600">{a.plannedEnd ? format(parseISO(a.plannedEnd), 'MMM d, yyyy') : '-'}</TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0C1445]" style={{ width: `${a.percentComplete || 0}%` }} />
                    </div>
                    <span className="text-[11px] font-bold font-mono text-gray-600">{a.percentComplete || 0}%</span>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-3">
                  <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                    a.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                    a.status === 'In Progress' ? 'bg-orange-50 text-[#EA580C] border-orange-200' : 
                    'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {a.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {!activities?.length && (
              <TableRow><TableCell colSpan={6} className="text-center h-24 text-gray-500 font-medium">No activities scheduled.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
