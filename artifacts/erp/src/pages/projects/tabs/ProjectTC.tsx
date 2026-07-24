import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Loader2, Zap, ChevronRight, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { toast } from "sonner";
import { SectionCard, StatusBadge, EmptyState } from "@/components/shared";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface TCSession {
  id: number; projectId: number; tcNumber: string;
  testDate?: string; conductedBy?: number; conductedByName?: string;
  witnessedBy?: string; testType: string;
  systemCapacityKwp?: number; measuredOutputKw?: number; performanceRatio?: number;
  gridVoltageV?: number; gridFrequencyHz?: number;
  insulationResistanceMohm?: number; earthContinuityOhm?: number;
  testResults: Record<string, any>; status: string; remarks?: string;
  snagItemIds: number[]; attachmentUrls: string[]; approvedBy?: number;
  approvedAt?: string; createdAt: string;
}

const TEST_TYPES = [
  "IVCurveTest","InsulationResistance","EarthContinuity",
  "StringTest","GridSyncTest","Performance","FullCommissioning"
];

// Thresholds for pass/fail indication
const THRESHOLDS = {
  performanceRatio:          { min: 0.70, label: "Performance Ratio", unit: "" },
  gridVoltageV:              { min: 207, max: 253, label: "Grid Voltage", unit: "V" },
  gridFrequencyHz:           { min: 49, max: 51, label: "Grid Frequency", unit: "Hz" },
  insulationResistanceMohm:  { min: 1, label: "Insulation Resistance", unit: "MΩ" },
  earthContinuityOhm:        { max: 1, label: "Earth Continuity", unit: "Ω" },
};

function paramRow(label: string, value: number | null | undefined, unit: string, threshold?: { min?: number; max?: number }) {
  if (value == null) return null;
  let pass = true;
  if (threshold?.min != null && value < threshold.min) pass = false;
  if (threshold?.max != null && value > threshold.max) pass = false;
  return { label, value, unit, pass };
}

function ParameterTable({ session }: { session: TCSession }) {
  const rows = [
    paramRow("System Capacity", session.systemCapacityKwp, "kWp"),
    paramRow("Measured Output", session.measuredOutputKw, "kW"),
    paramRow("Performance Ratio", session.performanceRatio != null ? Math.round(session.performanceRatio * 1000) / 10 : null, "%", { min: 70 }),
    paramRow("Grid Voltage", session.gridVoltageV, "V", { min: 207, max: 253 }),
    paramRow("Grid Frequency", session.gridFrequencyHz, "Hz", { min: 49, max: 51 }),
    paramRow("Insulation Resistance", session.insulationResistanceMohm, "MΩ", { min: 1 }),
    paramRow("Earth Continuity", session.earthContinuityOhm, "Ω", { max: 1 }),
  ].filter(Boolean) as { label: string; value: number; unit: string; pass: boolean }[];

  if (!rows.length) return <p className="text-sm text-muted-foreground">No parameters recorded.</p>;

  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map(row => (
        <div key={row.label} className={cn("flex items-center justify-between p-3 rounded-lg border", row.pass ? "border-emerald-200 bg-emerald-50/30" : "border-red-200 bg-red-50/30")}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{row.label}</p>
            <p className="text-lg font-bold font-mono text-foreground">{row.value}{row.unit}</p>
          </div>
          {row.pass
            ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function statusColor(status: string) {
  if (status === "Passed") return "border-emerald-200 bg-emerald-50/30";
  if (status === "Failed") return "border-red-200 bg-red-50/30";
  if (status === "ConditionalPass") return "border-yellow-200 bg-yellow-50/30";
  return "border-border";
}

export function ProjectTC({ projectId }: { projectId: number }) {
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<TCSession | null>(null);
  const qc = useQueryClient();

  const tcKey = ["testing-commissioning", projectId];
  const { data: sessions = [], isLoading } = useQuery<TCSession[]>({
    queryKey: tcKey,
    queryFn: () => apiGet(`/projects/${projectId}/testing-commissioning`),
    enabled: !!projectId,
  });

  const createMut = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/testing-commissioning`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: tcKey }); setAddOpen(false); toast.success("T&C session created"); },
    onError: () => toast.error("Failed to create session"),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, ...d }: any) => apiPatch<TCSession>(`/testing-commissioning/${id}`, d),
    onSuccess: (updated: TCSession) => { qc.invalidateQueries({ queryKey: tcKey }); setDetail(updated); toast.success("Session updated"); },
    onError: () => toast.error("Failed to update"),
  });

  const [form, setForm] = useState({
    testType: "FullCommissioning", testDate: "", witnessedBy: "", conductedBy: "",
    systemCapacityKwp: "", measuredOutputKw: "", gridVoltageV: "", gridFrequencyHz: "",
    insulationResistanceMohm: "", earthContinuityOhm: "", remarks: "", status: "Draft",
  });

  const computedPR = form.systemCapacityKwp && form.measuredOutputKw
    ? (Number(form.measuredOutputKw) / Number(form.systemCapacityKwp) * 100).toFixed(1) + "%"
    : "—";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionCard
        title="Testing & Commissioning"
        isLoading={isLoading}
        actions={<Button size="sm" className="h-8 gap-1.5" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5" /> New Session</Button>}
      >
        {sessions.length === 0 ? (
          <EmptyState icon={Zap} title="No T&C sessions" description="Record testing and commissioning sessions with full electrical parameters." action={{ label: "New Session", onClick: () => setAddOpen(true) }} size="sm" />
        ) : (
          <div className="space-y-2">
            {sessions.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div
                  className={cn("flex items-center gap-4 p-4 border rounded-xl cursor-pointer hover:shadow-sm transition-all", statusColor(s.status))}
                  onClick={() => setDetail(s)}
                >
                  <div className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground">{s.tcNumber}</p>
                      <span className="text-xs text-muted-foreground">· {s.testType}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {s.testDate ? format(parseISO(s.testDate), "d MMM yyyy") : "No date"}
                      {s.performanceRatio != null && ` · PR: ${(s.performanceRatio * 100).toFixed(1)}%`}
                      {s.conductedByName && ` · ${s.conductedByName}`}
                    </p>
                  </div>
                  <StatusBadge status={s.status} size="sm" />
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* New session drawer */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>New T&C Session</SheetTitle></SheetHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test Type</Label>
                <Select value={form.testType} onValueChange={v => setForm(f => ({ ...f, testType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{TEST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test Date</Label>
                <Input type="date" className="mt-1" value={form.testDate} onChange={e => setForm(f => ({ ...f, testDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conducted By (User ID)</Label>
                <Input type="number" className="mt-1 font-mono" value={form.conductedBy} onChange={e => setForm(f => ({ ...f, conductedBy: e.target.value }))} placeholder="Optional" />
              </div>
              <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Witnessed By</Label>
                <Input className="mt-1" value={form.witnessedBy} onChange={e => setForm(f => ({ ...f, witnessedBy: e.target.value }))} placeholder="Name or organisation" />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Electrical Parameters</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "System Capacity (kWp)", key: "systemCapacityKwp" },
                  { label: "Measured Output (kW)", key: "measuredOutputKw" },
                  { label: "Grid Voltage (V)", key: "gridVoltageV" },
                  { label: "Grid Frequency (Hz)", key: "gridFrequencyHz" },
                  { label: "Insulation Resistance (MΩ)", key: "insulationResistanceMohm" },
                  { label: "Earth Continuity (Ω)", key: "earthContinuityOhm" },
                ].map(f => (
                  <div key={f.key}><Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <Input type="number" step="any" className="mt-1 font-mono" value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground font-medium">Calculated PR:</span>
                <span className={cn("text-sm font-bold font-mono", computedPR !== "—" && Number(computedPR.replace("%","")) >= 70 ? "text-emerald-600" : "text-red-500")}>
                  {computedPR}
                </span>
                {computedPR !== "—" && Number(computedPR.replace("%","")) < 70 && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                )}
              </div>
            </div>

            <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Draft","Submitted","Passed","Failed","ConditionalPass"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Remarks</Label>
              <Textarea className="mt-1 text-sm" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={3} placeholder="Test conditions, observations, conditional pass notes…" />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                disabled={createMut.isPending}
                onClick={() => createMut.mutate({
                  testType: form.testType, testDate: form.testDate || null,
                  conductedBy: form.conductedBy ? Number(form.conductedBy) : null,
                  witnessedBy: form.witnessedBy || null,
                  systemCapacityKwp: form.systemCapacityKwp ? Number(form.systemCapacityKwp) : null,
                  measuredOutputKw: form.measuredOutputKw ? Number(form.measuredOutputKw) : null,
                  gridVoltageV: form.gridVoltageV ? Number(form.gridVoltageV) : null,
                  gridFrequencyHz: form.gridFrequencyHz ? Number(form.gridFrequencyHz) : null,
                  insulationResistanceMohm: form.insulationResistanceMohm ? Number(form.insulationResistanceMohm) : null,
                  earthContinuityOhm: form.earthContinuityOhm ? Number(form.earthContinuityOhm) : null,
                  remarks: form.remarks || null, status: form.status,
                })}
              >
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Session"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail slide-over */}
      <Sheet open={!!detail} onOpenChange={v => !v && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />{detail.tcNumber}
                  <StatusBadge status={detail.status} size="sm" />
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {detail.testType}{detail.testDate ? ` · ${format(parseISO(detail.testDate), "d MMM yyyy")}` : ""}
                  {detail.conductedByName ? ` · ${detail.conductedByName}` : ""}
                  {detail.witnessedBy ? ` · Witnessed by: ${detail.witnessedBy}` : ""}
                </p>
              </SheetHeader>

              <div className="space-y-6">
                <ParameterTable session={detail} />

                {detail.remarks && (
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/60">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Remarks</p>
                    <p className="text-sm text-foreground">{detail.remarks}</p>
                  </div>
                )}

                {/* Status actions for submitted sessions */}
                {detail.status === "Submitted" && (
                  <div className="border-t border-border/60 pt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Approve Result</p>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 gap-1.5 border-yellow-300 text-yellow-700"
                        onClick={() => patchMut.mutate({ id: detail.id, status: "ConditionalPass", approvedAt: new Date().toISOString() })}>
                        Conditional Pass
                      </Button>
                      <Button className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => patchMut.mutate({ id: detail.id, status: "Passed", approvedAt: new Date().toISOString() })}>
                        <CheckCircle2 className="h-4 w-4" /> Pass
                      </Button>
                      <Button variant="destructive" className="flex-1 gap-1.5"
                        onClick={() => patchMut.mutate({ id: detail.id, status: "Failed" })}>
                        <XCircle className="h-4 w-4" /> Fail
                      </Button>
                    </div>
                  </div>
                )}

                {/* Submit draft */}
                {detail.status === "Draft" && (
                  <Button className="w-full"
                    onClick={() => patchMut.mutate({ id: detail.id, status: "Submitted" })}>
                    Submit for Approval
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
