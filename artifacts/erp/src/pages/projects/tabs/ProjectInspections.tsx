import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, ClipboardCheck, CheckCircle2, XCircle, MinusCircle, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { toast } from "sonner";
import { SectionCard, StatusBadge, EmptyState } from "@/components/shared";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface ChecklistItem { id: string; section: string; description: string; passCriteria: string; isRequired: boolean; }
interface Checklist { id: number; name: string; inspectionType: string; items: ChecklistItem[]; }
interface InspectionResult { checklistItemId: string; result: "Pass" | "Fail" | "NA"; remark?: string; }
interface Inspection {
  id: number; projectId: number; checklistId?: number; checklistName?: string;
  inspectionType?: string; scheduledDate?: string; conductedDate?: string;
  inspectedBy?: number; inspectedByName?: string; status: string; overallResult?: string;
  results: InspectionResult[]; observations?: string; failureReasons?: string;
  reInspectionRequired: boolean; reInspectionDate?: string;
  attachmentUrls: string[]; approvedBy?: number; approvedAt?: string; createdAt: string;
}

function resultBadge(result: "Pass" | "Fail" | "NA") {
  if (result === "Pass") return <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold"><CheckCircle2 className="h-3.5 w-3.5" />Pass</span>;
  if (result === "Fail") return <span className="flex items-center gap-1 text-red-500 text-xs font-bold"><XCircle className="h-3.5 w-3.5" />Fail</span>;
  return <span className="flex items-center gap-1 text-muted-foreground text-xs"><MinusCircle className="h-3.5 w-3.5" />N/A</span>;
}

function statusColor(status: string) {
  if (status === "Passed") return "border-emerald-200 bg-emerald-50/30";
  if (status === "Failed") return "border-red-200 bg-red-50/30";
  if (status === "PassedWithObservations") return "border-yellow-200 bg-yellow-50/30";
  if (status === "Cancelled") return "border-muted";
  return "border-border";
}

export function ProjectInspections({ projectId }: { projectId: number }) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [detail, setDetail] = useState<Inspection | null>(null);
  const [resultsMap, setResultsMap] = useState<Record<string, InspectionResult>>({});
  const [observations, setObservations] = useState("");
  const qc = useQueryClient();

  const inspKey = ["inspections", projectId];
  const { data: inspections = [], isLoading } = useQuery<Inspection[]>({
    queryKey: inspKey,
    queryFn: () => apiGet(`/projects/${projectId}/inspections`),
    enabled: !!projectId,
  });

  const { data: checklists = [] } = useQuery<Checklist[]>({
    queryKey: ["inspection-checklists"],
    queryFn: () => apiGet("/inspection-checklists"),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/inspections`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: inspKey }); setScheduleOpen(false); toast.success("Inspection scheduled"); },
    onError: () => toast.error("Failed to schedule inspection"),
  });

  const submitMut = useMutation({
    mutationFn: ({ id, ...d }: any) => apiPatch(`/project-inspections/${id}`, d),
    onSuccess: (updated: Inspection) => {
      qc.invalidateQueries({ queryKey: inspKey });
      setDetail(updated);
      if (updated.status === "Failed") toast.error("Inspection failed — snag items created automatically");
      else if (updated.status === "Passed") toast.success("Inspection passed!");
      else toast.info("Results saved");
    },
    onError: () => toast.error("Failed to submit results"),
  });

  const [form, setForm] = useState({ checklistId: "", scheduledDate: "", inspectedBy: "" });

  // When detail opens, initialise results map from existing results
  function openDetail(insp: Inspection) {
    setDetail(insp);
    const map: Record<string, InspectionResult> = {};
    insp.results.forEach(r => { map[r.checklistItemId] = r; });
    setResultsMap(map);
    setObservations(insp.observations ?? "");
  }

  function setResult(itemId: string, result: "Pass" | "Fail" | "NA") {
    setResultsMap(m => ({ ...m, [itemId]: { ...m[itemId], checklistItemId: itemId, result } }));
  }
  function setRemark(itemId: string, remark: string) {
    setResultsMap(m => ({ ...m, [itemId]: { ...m[itemId], checklistItemId: itemId, result: m[itemId]?.result ?? "NA", remark } }));
  }

  // Get checklist items for the detail panel
  const detailChecklist = detail?.checklistId ? checklists.find(c => c.id === detail.checklistId) : null;
  const sections = detailChecklist ? [...new Set(detailChecklist.items.map(i => i.section))] : [];

  // UI guard: all required items must be answered before submit is enabled
  const requiredItems = detailChecklist?.items.filter(i => i.isRequired) ?? [];
  const unansweredRequired = requiredItems.filter(i => !resultsMap[i.id]?.result);
  const allRequiredAnswered = unansweredRequired.length === 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionCard
        title="Quality Inspections"
        isLoading={isLoading}
        actions={<Button size="sm" className="h-8 gap-1.5" onClick={() => setScheduleOpen(true)}><Plus className="h-3.5 w-3.5" /> Schedule</Button>}
      >
        {inspections.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No inspections scheduled" description="Schedule quality inspections against standard checklists." action={{ label: "Schedule Inspection", onClick: () => setScheduleOpen(true) }} size="sm" />
        ) : (
          <div className="space-y-2">
            {inspections.map((insp, i) => (
              <motion.div key={insp.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div
                  className={cn("flex items-center gap-4 p-4 border rounded-xl cursor-pointer hover:shadow-sm transition-all", statusColor(insp.status))}
                  onClick={() => openDetail(insp)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{insp.checklistName ?? insp.inspectionType ?? "Inspection"}</p>
                      {insp.results.length > 0 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {insp.results.filter(r => r.result === "Pass").length}/{insp.results.length} passed
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {insp.scheduledDate ? format(parseISO(insp.scheduledDate), "d MMM yyyy") : "No date"}{insp.inspectedByName ? ` · ${insp.inspectedByName}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={insp.status} size="sm" />
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Schedule sheet */}
      <Sheet open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Schedule Inspection</SheetTitle></SheetHeader>
          <div className="space-y-4 pt-4">
            <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Checklist Template *</Label>
              <Select value={form.checklistId} onValueChange={v => setForm(f => ({ ...f, checklistId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a checklist…" /></SelectTrigger>
                <SelectContent>
                  {checklists.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scheduled Date</Label>
              <Input type="date" className="mt-1" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} />
            </div>
            <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inspector (User ID)</Label>
              <Input type="number" className="mt-1 font-mono" value={form.inspectedBy} onChange={e => setForm(f => ({ ...f, inspectedBy: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
              <Button
                disabled={!form.checklistId || createMut.isPending}
                onClick={() => createMut.mutate({
                  checklistId: Number(form.checklistId),
                  scheduledDate: form.scheduledDate || null,
                  inspectedBy: form.inspectedBy ? Number(form.inspectedBy) : null,
                })}
              >
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Schedule"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail/conduct slide-over */}
      <Sheet open={!!detail} onOpenChange={v => !v && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  {detail.checklistName ?? "Inspection"}
                  <StatusBadge status={detail.status} size="sm" />
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {detail.scheduledDate ? format(parseISO(detail.scheduledDate), "d MMM yyyy") : "No date"}{detail.inspectedByName ? ` · ${detail.inspectedByName}` : ""}
                </p>
              </SheetHeader>

              {detailChecklist ? (
                <div className="space-y-6">
                  {sections.map(section => {
                    const items = detailChecklist.items.filter(i => i.section === section);
                    return (
                      <div key={section}>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 pb-1.5 border-b border-border/60">{section}</h4>
                        <div className="space-y-4">
                          {items.map(item => {
                            const r = resultsMap[item.id];
                            return (
                              <div key={item.id} className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">
                                      {item.description}
                                      {item.isRequired && <span className="ml-1 text-red-500 text-xs">*</span>}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Pass: {item.passCriteria}</p>
                                  </div>
                                  {r?.result && resultBadge(r.result)}
                                </div>
                                <div className="flex gap-2">
                                  {(["Pass","Fail","NA"] as const).map(v => (
                                    <button
                                      key={v}
                                      onClick={() => setResult(item.id, v)}
                                      className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-bold border transition-colors",
                                        r?.result === v
                                          ? v === "Pass" ? "bg-emerald-600 text-white border-emerald-600"
                                            : v === "Fail" ? "bg-red-500 text-white border-red-500"
                                            : "bg-muted text-foreground border-border"
                                          : "border-border hover:bg-muted/40"
                                      )}
                                    >{v}</button>
                                  ))}
                                </div>
                                {r?.result === "Fail" && (
                                  <Input
                                    placeholder="Remark / failure description"
                                    className="text-sm h-8"
                                    value={r?.remark ?? ""}
                                    onChange={e => setRemark(item.id, e.target.value)}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observations</Label>
                    <Textarea className="mt-1 text-sm" value={observations} onChange={e => setObservations(e.target.value)} rows={3} placeholder="General site observations…" />
                  </div>

                  {detail.status !== "Passed" && detail.status !== "Failed" && detail.status !== "Cancelled" && (
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      {!allRequiredAnswered && (
                        <p className="text-[11px] text-amber-600 font-medium text-right">
                          {unansweredRequired.length} required item{unansweredRequired.length !== 1 ? "s" : ""} still need a result
                        </p>
                      )}
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
                        <Button
                          disabled={submitMut.isPending || !allRequiredAnswered}
                          onClick={() => {
                            const results = Object.values(resultsMap);
                            submitMut.mutate({
                              id: detail.id,
                              results,
                              observations,
                              conductedDate: new Date().toISOString().split("T")[0],
                              status: "InProgress",
                            });
                          }}
                        >
                          {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Results"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">No checklist template linked to this inspection.</p>
                  {detail.results.length > 0 && (
                    <div className="space-y-2">
                      {detail.results.map((r, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 border border-border/60 rounded-lg">
                          {resultBadge(r.result)}
                          <span className="text-sm text-muted-foreground">{r.checklistItemId}</span>
                          {r.remark && <span className="text-xs text-muted-foreground">— {r.remark}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
