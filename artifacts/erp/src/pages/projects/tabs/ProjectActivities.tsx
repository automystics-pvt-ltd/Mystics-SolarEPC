import { useState } from "react";
import { useGetProjectActivities, useCreateActivity, getGetProjectActivitiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { Plus, CalendarRange } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, differenceInDays, parseISO } from "date-fns";
import { SectionCard, StatusBadge, EmptyState, SkeletonList } from "@/components/shared";
import { motion } from "framer-motion";

const createActivitySchema = z.object({
  wbsCode: z.string().optional(),
  name: z.string().min(1, "Name required"),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
});

export function ProjectActivities({ projectId }: { projectId: number }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: activities, isPending } = useGetProjectActivities(projectId, {
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

  if (isPending) {
    return <SkeletonList rows={5} cols={4} showHeader />;
  }

  // Prep Gantt data
  let ganttData: any[] = [];
  if (activities && activities.length > 0) {
    const validDates = activities.filter(a => a.plannedStart && a.plannedEnd);
    if (validDates.length > 0) {
      const minDateStr = validDates.reduce(
        (min, a) => (a.plannedStart! < min ? a.plannedStart! : min),
        validDates[0].plannedStart!
      );
      const minDate = parseISO(minDateStr);
      ganttData = validDates.map(a => {
        const start = parseISO(a.plannedStart!);
        const end = parseISO(a.plannedEnd!);
        const offset = differenceInDays(start, minDate);
        const duration = differenceInDays(end, start) || 1;
        return { id: a.id, name: a.name, offset, duration, status: a.status, start: a.plannedStart, end: a.plannedEnd };
      }).sort((a, b) => a.offset - b.offset);
    }
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-lg text-foreground">
          <p className="font-bold text-sm mb-2 leading-tight">{data.name}</p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-bold uppercase tracking-wider w-10 inline-block">Start</span>{" "}
              {format(parseISO(data.start), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-bold uppercase tracking-wider w-10 inline-block">End</span>{" "}
              {format(parseISO(data.end), "MMM d, yyyy")}
            </p>
          </div>
          <div className="mt-2">
            <StatusBadge status={data.status} size="sm" />
          </div>
        </div>
      );
    }
    return null;
  };

  const addActivityDialog = (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Activity
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold tracking-tight">New Activity</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(d => createMutation.mutate({ id: projectId, data: { ...d } }))}
            className="space-y-5"
          >
            <FormField control={form.control} name="wbsCode" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">WBS Code</FormLabel>
                <FormControl><Input className="h-10 font-mono" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Activity Name</FormLabel>
                <FormControl><Input className="h-10" {...field} /></FormControl>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="plannedStart" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Date</FormLabel>
                  <FormControl><Input className="h-10" type="date" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="plannedEnd" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Date</FormLabel>
                  <FormControl><Input className="h-10" type="date" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full h-11 mt-2" disabled={createMutation.isPending}>
              Add Activity
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Gantt Chart */}
      {ganttData.length > 0 && (
        <SectionCard title="Gantt View">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ganttData} layout="vertical" margin={{ top: 0, right: 20, left: 120, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="hsl(var(--border))" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="offset" stackId="a" fill="transparent" />
                <Bar dataKey="duration" stackId="a" radius={[4, 4, 4, 4]} barSize={16}>
                  {ganttData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.status === "Completed"  ? "#10B981" :
                        entry.status === "In Progress" ? "#EA580C" : "#E5E7EB"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* Activities Table */}
      <SectionCard title="Project Schedule" actions={addActivityDialog} noPadding>
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-5 w-[100px]">WBS</TableHead>
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Activity</TableHead>
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Start</TableHead>
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">End</TableHead>
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Progress</TableHead>
              <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-5">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities?.map(a => (
              <TableRow key={a.id} className="border-b border-border/40 hover:bg-muted/20">
                <TableCell className="px-5 py-3 font-mono text-xs font-bold text-muted-foreground">{a.wbsCode || "—"}</TableCell>
                <TableCell className="py-3 font-semibold text-sm text-foreground leading-tight">{a.name}</TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground">
                  {a.plannedStart ? format(parseISO(a.plannedStart), "MMM d, yyyy") : "—"}
                </TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground">
                  {a.plannedEnd ? format(parseISO(a.plannedEnd), "MMM d, yyyy") : "—"}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${a.percentComplete || 0}%` }} />
                    </div>
                    <span className="text-[11px] font-bold font-mono text-muted-foreground">{a.percentComplete || 0}%</span>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-3">
                  <StatusBadge status={a.status} size="sm" />
                </TableCell>
              </TableRow>
            ))}
            {!activities?.length && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={CalendarRange}
                    title="No activities scheduled"
                    description="Add activities to build your project schedule."
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
