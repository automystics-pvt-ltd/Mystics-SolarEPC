import { useState, useRef, useEffect } from "react";
import {
  useGetProcGrn, getGetProcGrnQueryKey, getGetProcGrnsQueryKey,
  useSubmitProcGrn, useApproveProcGrn, useRejectProcGrn,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, CheckCircle2, XCircle, Send, Clock, Printer,
  Camera, X,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { StatusBadge, DetailRow, DetailGrid, SectionCard, PageHeader } from "@/components/shared";
import { addRecentEntry } from "@/lib/recentHistory";

function formatDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(d));
  } catch {
    return d;
  }
}

const QC_COLOR: Record<string, string> = {
  Pending:           "bg-slate-100 text-slate-600 border-slate-200",
  Accepted:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  PartiallyAccepted: "bg-amber-50 text-amber-700 border-amber-200",
  Rejected:          "bg-red-50 text-red-700 border-red-200",
};

/* ── Swipeable GRN line item card (mobile) ─────────────────────────────── */
function SwipeableLineCard({ item }: { item: any }) {
  const x = useMotionValue(0);
  const background = useTransform(x, [-80, 0], ["#fee2e2", "transparent"]);
  const rejectOpacity = useTransform(x, [-80, -20], [1, 0]);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -60) {
      // Snapped to reject hint — bounce back
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card" ref={cardRef}>
      {/* Swipe-left reveal: reject hint */}
      <motion.div
        style={{ opacity: rejectOpacity }}
        className="absolute inset-0 flex items-center justify-end pr-4 bg-red-100 rounded-xl pointer-events-none"
      >
        <div className="flex flex-col items-center gap-1">
          <XCircle className="w-6 h-6 text-red-500" />
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Reject</span>
        </div>
      </motion.div>

      {/* Card content */}
      <motion.div
        style={{ x, background }}
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="relative z-10 p-4 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm">{item.materialName}</p>
            {item.materialCode && <p className="text-[11px] text-muted-foreground">{item.materialCode}</p>}
          </div>
          <span className={cn(
            "shrink-0 inline-flex items-center rounded-md border text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wide",
            QC_COLOR[item.qcStatus] ?? "bg-slate-100 text-slate-600 border-slate-200"
          )}>
            {item.qcStatus}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Ordered",  value: item.orderedQty,  color: "text-foreground" },
            { label: "Received", value: item.receivedQty, color: "text-blue-600" },
            { label: "Accepted", value: item.acceptedQty, color: "text-emerald-600" },
            { label: "Rejected", value: item.rejectedQty, color: "text-red-600" },
          ].map(s => (
            <div key={s.label}>
              <p className={cn("text-lg font-bold font-mono", s.color)}>{s.value ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {item.damagedQty > 0 && (
          <p className="mt-2 text-[11px] text-amber-600 font-medium">Damaged: {item.damagedQty} {item.uom}</p>
        )}
        {item.rejectionReason && (
          <p className="mt-1 text-[11px] text-muted-foreground">{item.rejectionReason}</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground/60 text-right select-none">← swipe to flag reject</p>
      </motion.div>
    </div>
  );
}

/* ── Photo Upload component ──────────────────────────────────────────────── */
function PhotoUpload({ photos, onAdd, onRemove }: {
  photos: { url: string; name: string }[];
  onAdd: (files: FileList) => void;
  onRemove: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
            <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
              aria-label="Remove photo"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1",
            "text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
          )}
          aria-label="Add photo"
        >
          <Camera className="w-5 h-5" />
          <span className="text-[10px] font-medium">Add photo</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={e => { if (e.target.files?.length) { onAdd(e.target.files); e.target.value = ""; } }}
      />

      {photos.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Tap "Add photo" to attach delivery photos from your camera or gallery.
        </p>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
export default function GRNDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const grnId = Number(id);
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();
  const isApprover = ["admin", "approver"].includes(user.role);

  const { data: grn, isLoading } = useGetProcGrn(grnId, { query: { enabled: !!grnId, queryKey: getGetProcGrnQueryKey(grnId) } });

  useEffect(() => {
    if (grn?.grnNumber) addRecentEntry(`/procurement/grns/${grnId}`, grn.grnNumber, "GRNs");
  }, [grn?.grnNumber, grnId]);

  const submitMut = useSubmitProcGrn();
  const approveMut = useApproveProcGrn();
  const rejectMut = useRejectProcGrn();

  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);

  const addPhotos = (files: FileList) => {
    const newPhotos = Array.from(files).map(f => ({ url: URL.createObjectURL(f), name: f.name }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };
  const removePhoto = (idx: number) => setPhotos(prev => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_, i) => i !== idx); });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetProcGrnQueryKey(grnId) });
    qc.invalidateQueries({ queryKey: getGetProcGrnsQueryKey() });
  };

  const runAction = (action: string) => {
    if (["approve", "reject"].includes(action) && !remarks.trim()) {
      toast({ title: "Remarks required", variant: "destructive" }); return;
    }
    const payload = { id: grnId, data: { userName: user.name, userId: user.id, remarks } as any };
    const handlers = {
      onSuccess: () => { invalidate(); setActionDialog(null); setRemarks(""); toast({ title: `GRN ${action} successful` }); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    };
    if (action === "submit") submitMut.mutate(payload, handlers);
    else if (action === "approve") approveMut.mutate(payload, handlers);
    else if (action === "reject") rejectMut.mutate(payload, handlers);
  };

  if (isLoading || !grn) return (
    <div className="flex h-60 items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading GRN…</div>
    </div>
  );

  const g = grn as any;
  const canSubmit  = g.status === "Draft";
  const canApprove = isApprover && g.status === "Submitted";
  const canReject  = isApprover && g.status === "Submitted";
  const hasActions = canSubmit || canApprove || canReject;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
      className={cn("space-y-5", hasActions ? "pb-28 lg:pb-10" : "pb-10")}
    >

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title={g.grnNumber}
        subtitle={`${g.vendorName ?? ""}${g.createdByName ? ` · Created by ${g.createdByName}` : ""}`}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setLocation("/procurement/grns")} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            {/* Desktop action buttons (hidden on mobile — shown in sticky bar) */}
            <div className="hidden lg:flex items-center gap-2">
              {canSubmit && (
                <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setActionDialog("submit")}>
                  <Send className="w-3.5 h-3.5" /> Submit for Inspection
                </Button>
              )}
              {canApprove && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={() => setActionDialog("approve")}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </Button>
              )}
              {canReject && (
                <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 gap-1.5" onClick={() => setActionDialog("reject")}>
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </Button>
              )}
            </div>
          </div>
        }
      />

      {/* ── Status Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-3 px-5 py-3 rounded-xl border bg-card">
        <StatusBadge status={g.status} size="md" />
        <div className="h-4 w-px bg-border/60" />
        <span className="text-[12px] text-muted-foreground">GRN#:</span>
        <span className="font-mono text-[12px] font-semibold text-foreground">{g.grnNumber}</span>
        <div className="h-4 w-px bg-border/60" />
        <span className="text-[12px] text-muted-foreground">PO Ref:</span>
        <span className="font-mono text-[12px] font-semibold text-foreground">#{g.poId}</span>
        {g.deliveryDate && (
          <>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[12px] text-muted-foreground">Received:</span>
            <span className="text-[12px] text-foreground">{formatDate(g.deliveryDate)}</span>
          </>
        )}
        {g.createdAt && (
          <>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[12px] text-muted-foreground">Created:</span>
            <span className="text-[12px] text-foreground">{formatDate(g.createdAt)}</span>
          </>
        )}
      </div>

      {/* ── Quantity Summary Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Ordered",  value: g.totalOrderedQty,  colorClass: "text-foreground" },
          { label: "Total Received", value: g.totalReceivedQty, colorClass: "text-blue-600" },
          { label: "Total Accepted", value: g.totalAcceptedQty, colorClass: "text-emerald-600" },
          { label: "Total Rejected", value: g.totalRejectedQty, colorClass: "text-red-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={cn("text-2xl font-bold font-mono", s.colorClass)}>{s.value ?? 0}</p>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Receipt Details ──────────────────────────────────────────────────── */}
      <SectionCard title="Receipt Details">
        <DetailGrid cols={4}>
          <DetailRow label="PO Reference" value={g.poId ? `PO #${g.poId}` : undefined} mono />
          <DetailRow label="Vendor" value={g.vendorName} />
          <DetailRow label="Received By" value={g.receivedByName} />
          <DetailRow label="Vehicle No." value={g.vehicleNumber} mono />
          <DetailRow label="DC Number" value={g.dcNumber} mono />
          <DetailRow label="DC Date" value={formatDate(g.dcDate)} />
          <DetailRow label="Delivery Date" value={formatDate(g.deliveryDate)} />
          <DetailRow label="Created By" value={g.createdByName} />
          {g.warehouseName && <DetailRow label="Warehouse" value={g.warehouseName} />}
          {g.remarks && <DetailRow label="Remarks" value={g.remarks} colSpan={2} />}
        </DetailGrid>
      </SectionCard>

      {/* ── Delivery Photos ──────────────────────────────────────────────────── */}
      <SectionCard title="Delivery Photos">
        <PhotoUpload photos={photos} onAdd={addPhotos} onRemove={removePhoto} />
      </SectionCard>

      {/* ── Line Items — mobile card view ─────────────────────────────────────── */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-foreground">Line Items & Inspection</h3>
          <span className="text-[11px] text-muted-foreground">{(g.items ?? []).length} items</span>
        </div>
        {(g.items ?? []).map((item: any) => (
          <SwipeableLineCard key={item.id} item={item} />
        ))}
      </div>

      {/* ── Line Items — desktop table ────────────────────────────────────────── */}
      <SectionCard title="Line Items & Inspection Results" noPadding className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {["#", "Material", "UOM", "Ordered", "Received", "Accepted", "Rejected", "Damaged", "QC Status", "Rejection Reason"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(g.items ?? []).map((item: any) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-[12px]">{item.lineNo}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{item.materialName}</p>
                    {item.materialCode && <p className="text-[11px] text-muted-foreground">{item.materialCode}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.uom}</td>
                  <td className="px-4 py-3 font-mono">{item.orderedQty}</td>
                  <td className="px-4 py-3 font-mono text-blue-600">{item.receivedQty}</td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600">{item.acceptedQty}</td>
                  <td className="px-4 py-3 font-mono text-red-600">{item.rejectedQty}</td>
                  <td className="px-4 py-3 font-mono text-amber-600">{item.damagedQty}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-md border text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wide",
                      QC_COLOR[item.qcStatus] ?? "bg-slate-100 text-slate-600 border-slate-200"
                    )}>
                      {item.qcStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-[11px] max-w-40 truncate">{item.rejectionReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Activity / Audit Trail ───────────────────────────────────────────── */}
      {(g.auditLogs ?? []).length > 0 && (
        <SectionCard title="Activity">
          <div className="space-y-4">
            {g.auditLogs.map((log: any, idx: number) => (
              <div key={log.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center shrink-0">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  {idx < g.auditLogs.length - 1 && <div className="w-px flex-1 bg-border/60 mt-1" />}
                </div>
                <div className="pb-4 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {log.action}
                    <span className="text-muted-foreground font-normal"> · {log.performedByName}</span>
                  </p>
                  {log.remarks && <p className="text-[12px] text-muted-foreground mt-0.5">{log.remarks}</p>}
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Mobile sticky action bar ─────────────────────────────────────────── */}
      {hasActions && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 print:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
        >
          <div className="mx-4 mb-2 bg-card border border-border rounded-2xl shadow-xl p-3 flex gap-3">
            {canSubmit && (
              <Button
                className="flex-1 h-14 text-base gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                onClick={() => setActionDialog("submit")}
              >
                <Send className="w-5 h-5" /> Submit for Inspection
              </Button>
            )}
            {canApprove && (
              <Button
                className="flex-1 h-14 text-base gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                onClick={() => setActionDialog("approve")}
              >
                <CheckCircle2 className="w-5 h-5" /> Approve
              </Button>
            )}
            {canReject && (
              <Button
                variant="outline"
                className="flex-1 h-14 text-base gap-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                onClick={() => setActionDialog("reject")}
              >
                <XCircle className="w-5 h-5" /> Reject
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Action Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!actionDialog} onOpenChange={o => { if (!o) { setActionDialog(null); setRemarks(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionDialog} GRN</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder={`Enter remarks${["approve","reject"].includes(actionDialog ?? "") ? " (required)" : ""}…`}
              className="min-h-20"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setActionDialog(null); setRemarks(""); }}>Cancel</Button>
              <Button
                className={cn(
                  actionDialog === "approve" ? "bg-emerald-600 hover:bg-emerald-700" :
                  actionDialog === "reject"  ? "bg-red-600 hover:bg-red-700" :
                                              "bg-blue-600 hover:bg-blue-700"
                )}
                onClick={() => runAction(actionDialog ?? "")}
              >
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
