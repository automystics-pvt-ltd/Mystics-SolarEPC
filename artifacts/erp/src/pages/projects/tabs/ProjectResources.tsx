import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Loader2, Users, Trash2, User, Wrench, Truck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/fetch";
import { toast } from "sonner";
import { SectionCard, StatusBadge, EmptyState } from "@/components/shared";
import { usePermissions } from "@/lib/permissions";
import { motion } from "framer-motion";
import { format, parseISO, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";

interface ResourceAllocation {
  id: number; projectId: number; activityId?: number; activityName?: string;
  resourceType: string; resourceId?: number; resourceName: string; role?: string;
  allocationPct: number; plannedStartDate?: string; plannedEndDate?: string;
  actualStartDate?: string; actualEndDate?: string;
  hourlyRate?: number; totalHours?: number; status: string; notes?: string;
  createdAt: string;
}

interface Activity { id: number; name: string; }

const RESOURCE_TYPES = ["Employee","Contractor","Equipment","Vehicle"];
const STATUSES = ["Planned","Active","Completed","Released"];

function resourceIcon(type: string) {
  if (type === "Equipment") return <Wrench className="h-3.5 w-3.5" />;
  if (type === "Vehicle") return <Truck className="h-3.5 w-3.5" />;
  if (type === "Contractor") return <User className="h-3.5 w-3.5" />;
  return <Users className="h-3.5 w-3.5" />;
}

function ResourceTimeline({ allocations }: { allocations: ResourceAllocation[] }) {
  const withDates = allocations.filter(a => a.plannedStartDate && a.plannedEndDate);
  if (!withDates.length) return null;

  const allDates = withDates.flatMap(a => [a.plannedStartDate!, a.plannedEndDate!].map(d => parseISO(d)));
  const minDate = startOfWeek(new Date(Math.min(...allDates.map(d => d.getTime()))));
  const maxDate = endOfWeek(new Date(Math.max(...allDates.map(d => d.getTime()))));
  const weeks = eachWeekOfInterval({ start: minDate, end: maxDate }).slice(0, 12);

  const uniqueNames = [...new Set(withDates.map(a => a.resourceName))];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px] text-[11px]">
        {/* Week headers */}
        <div className="flex border-b border-border/60 pb-1 mb-2 pl-[140px]">
          {weeks.map(w => (
            <div key={w.toISOString()} className="flex-1 text-center text-muted-foreground font-medium">
              {format(w, "d MMM")}
            </div>
          ))}
        </div>
        {uniqueNames.map(name => {
          const rAllocs = withDates.filter(a => a.resourceName === name);
          return (
            <div key={name} className="flex items-center mb-1.5 h-6">
              <div className="w-[132px] shrink-0 text-xs font-medium truncate pr-2 text-foreground">{name}</div>
              <div className="flex flex-1 gap-px">
                {weeks.map(w => {
                  const weekStart = startOfWeek(w);
                  const weekEnd = endOfWeek(w);
                  const active = rAllocs.some(a =>
                    isWithinInterval(weekStart, { start: parseISO(a.plannedStartDate!), end: parseISO(a.plannedEndDate!) }) ||
                    isWithinInterval(weekEnd, { start: parseISO(a.plannedStartDate!), end: parseISO(a.plannedEndDate!) }) ||
                    (parseISO(a.plannedStartDate!) <= weekStart && parseISO(a.plannedEndDate!) >= weekEnd)
                  );
                  const alloc = rAllocs.find(a =>
                    isWithinInterval(weekStart, { start: parseISO(a.plannedStartDate!), end: parseISO(a.plannedEndDate!) })
                  );
                  return (
                    <div
                      key={w.toISOString()}
                      className={cn("flex-1 h-5 rounded-sm", active ? "bg-blue-400 opacity-80" : "bg-muted/30")}
                      title={active && alloc ? `${alloc.allocationPct}%` : undefined}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectResources({ projectId }: { projectId: number }) {
  const { canEdit: canEditProject } = usePermissions("projects");
  const [addOpen, setAddOpen] = useState(false);
  const qc = useQueryClient();

  const resKey = ["resources", projectId];
  const { data: resources = [], isPending } = useQuery<ResourceAllocation[]>({
    queryKey: resKey,
    queryFn: () => apiGet(`/projects/${projectId}/resources`),
    enabled: !!projectId,
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["activities", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/activities`),
    enabled: !!projectId,
  });

  const createMut = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/resources`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: resKey }); setAddOpen(false); toast.success("Allocation added"); },
    onError: () => toast.error("Failed to add allocation"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/resource-allocations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: resKey }); toast.success("Allocation removed"); },
    onError: () => toast.error("Failed to remove"),
  });

  const [form, setForm] = useState({
    resourceType: "Employee", resourceName: "", role: "", activityId: "",
    allocationPct: "100", plannedStartDate: "", plannedEndDate: "",
    hourlyRate: "", totalHours: "", status: "Planned", notes: "",
  });

  // Summary stats
  const totalPersonDays = resources.reduce((s, r) => {
    if (!r.plannedStartDate || !r.plannedEndDate) return s;
    const days = Math.max(1, Math.ceil((new Date(r.plannedEndDate).getTime() - new Date(r.plannedStartDate).getTime()) / 86400000));
    return s + (days * r.allocationPct / 100);
  }, 0);

  const totalCost = resources.reduce((s, r) => {
    return s + (r.hourlyRate && r.totalHours ? r.hourlyRate * r.totalHours : 0);
  }, 0);

  // Group by activity
  const grouped = resources.reduce<Record<string, ResourceAllocation[]>>((acc, r) => {
    const key = r.activityName ?? "No Activity";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Summary footer row */}
      {resources.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Allocations", value: resources.length },
            { label: "Est. Person-Days", value: Math.round(totalPersonDays) },
            { label: "Est. Cost", value: totalCost ? `₹${totalCost.toLocaleString("en-IN")}` : "—" },
          ].map(s => (
            <div key={s.label} className="bg-muted/30 rounded-xl border border-border/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Resource table */}
      <SectionCard
        title="Resource Allocations"
        isLoading={isPending}
        actions={canEditProject ? <Button size="sm" className="h-8 gap-1.5" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Allocation</Button> : undefined}
        noPadding
      >
        {resources.length === 0 ? (
          <EmptyState icon={Users} title="No resource allocations" description="Assign team members, contractors, and equipment to activities." action={canEditProject ? { label: "Add Allocation", onClick: () => setAddOpen(true) } : undefined} size="sm" />
        ) : (
          <div>
            {Object.entries(grouped).map(([activity, allocs]) => (
              <div key={activity}>
                <div className="px-5 py-2 bg-muted/20 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{activity}</div>
                {allocs.map(a => (
                  <div key={a.id} className="flex items-center gap-4 px-5 py-3 border-b border-border/40 hover:bg-muted/20 group">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      a.resourceType === "Employee" ? "bg-blue-100 text-blue-600" :
                      a.resourceType === "Contractor" ? "bg-purple-100 text-purple-600" : "bg-muted text-muted-foreground"
                    )}>
                      {resourceIcon(a.resourceType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{a.resourceName}</p>
                      <p className="text-[11px] text-muted-foreground">{a.role ?? a.resourceType}{a.allocationPct !== 100 ? ` · ${a.allocationPct}%` : ""}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      {a.plannedStartDate && a.plannedEndDate ? (
                        <>{format(parseISO(a.plannedStartDate), "d MMM")} – {format(parseISO(a.plannedEndDate), "d MMM yy")}</>
                      ) : "No dates"}
                    </div>
                    <StatusBadge status={a.status} size="sm" />
                    {canEditProject && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                        onClick={() => deleteMut.mutate(a.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Resource timeline */}
      {resources.some(r => r.plannedStartDate && r.plannedEndDate) && (
        <SectionCard title="Resource Timeline (next 12 weeks)">
          <ResourceTimeline allocations={resources} />
        </SectionCard>
      )}

      {/* Add allocation sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Add Resource Allocation</SheetTitle></SheetHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</Label>
                <Select value={form.resourceType} onValueChange={v => setForm(f => ({ ...f, resourceType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Activity</Label>
                <Select value={form.activityId} onValueChange={v => setForm(f => ({ ...f, activityId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {activities.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resource Name *</Label>
              <Input className="mt-1" value={form.resourceName} onChange={e => setForm(f => ({ ...f, resourceName: e.target.value }))} placeholder="e.g. Ravi Kumar / JCB #3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</Label>
                <Input className="mt-1" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Site Engineer" />
              </div>
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Allocation %</Label>
                <Input type="number" className="mt-1 font-mono" value={form.allocationPct} onChange={e => setForm(f => ({ ...f, allocationPct: e.target.value }))} min={1} max={100} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                <Input type="date" className="mt-1" value={form.plannedStartDate} onChange={e => setForm(f => ({ ...f, plannedStartDate: e.target.value }))} />
              </div>
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Date</Label>
                <Input type="date" className="mt-1" value={form.plannedEndDate} onChange={e => setForm(f => ({ ...f, plannedEndDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hourly Rate (₹)</Label>
                <Input type="number" className="mt-1 font-mono" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} placeholder="Optional" />
              </div>
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Hours</Label>
                <Input type="number" className="mt-1 font-mono" value={form.totalHours} onChange={e => setForm(f => ({ ...f, totalHours: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Textarea className="mt-1 text-sm" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                disabled={!form.resourceName || createMut.isPending}
                onClick={() => createMut.mutate({
                  resourceType: form.resourceType, resourceName: form.resourceName,
                  role: form.role || null, activityId: (form.activityId && form.activityId !== "none") ? Number(form.activityId) : null,
                  allocationPct: Number(form.allocationPct),
                  plannedStartDate: form.plannedStartDate || null, plannedEndDate: form.plannedEndDate || null,
                  hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
                  totalHours: form.totalHours ? Number(form.totalHours) : null,
                  status: form.status, notes: form.notes || null,
                })}
              >
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Allocation"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
