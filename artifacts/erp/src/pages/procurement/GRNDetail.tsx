import { useState, useRef, useEffect } from "react";
import {
  useGetProcGrn, getGetProcGrnQueryKey, getGetProcGrnsQueryKey,
  useSubmitProcGrn, useApproveProcGrn, useRejectProcGrn,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, CheckCircle2, XCircle, Send, Clock, Printer,
  Camera, X, Lock, Unlock, RotateCcw, PackageX, MessageSquare,
  ChevronRight, Barcode, Package, AlertTriangle, Activity,
  Warehouse, Layers, RotateCwSquare, Hash,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { StatusBadge, DetailRow, DetailGrid, SectionCard, PageHeader } from "@/components/shared";
import { addRecentEntry } from "@/lib/recentHistory";
import { useAuth } from "@/lib/auth";
import { apiPost, apiGet, apiDelete } from "@/lib/fetch";

function formatDate(d?: string | null) {
  if (!d) return "—";
  try { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(d)); }
  catch { return d; }
}
function formatDateTime(d?: string | null) {
  if (!d) return "—";
  try { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(d)); }
  catch { return d; }
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const QC_COLOR: Record<string, string> = {
  Pending:           "bg-slate-100 text-slate-600 border-slate-200",
  Accepted:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  PartiallyAccepted: "bg-amber-50 text-amber-700 border-amber-200",
  Rejected:          "bg-red-50 text-red-700 border-red-200",
};

const LIFECYCLE_STEPS = [
  { key: "Draft",              label: "Draft",      icon: "📝" },
  { key: "Submitted",         label: "Submitted",  icon: "📤" },
  { key: "Accepted",          label: "Accepted",   icon: "✅" },
  { key: "PartiallyAccepted", label: "Partial",    icon: "🔶" },
  { key: "Rejected",          label: "Rejected",   icon: "❌" },
];
const TERMINAL_STEPS = ["Cancelled", "Reversed"];

function LifecycleBar({ status }: { status: string }) {
  if (TERMINAL_STEPS.includes(status)) {
    return (
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium",
        status === "Cancelled"
          ? "bg-slate-50 border-slate-200 text-slate-600"
          : "bg-orange-50 border-orange-200 text-orange-700"
      )}>
        {status === "Cancelled" ? <XCircle className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
        This GRN has been <strong>{status}</strong>
      </div>
    );
  }
  const activeIdx = ["Draft", "Submitted", "Accepted", "PartiallyAccepted", "Rejected"].indexOf(status);
  const steps = ["Draft", "Submitted", status === "Rejected" ? "Rejected" : status === "PartiallyAccepted" ? "PartiallyAccepted" : "Accepted"];

  return (
    <div className="flex items-center gap-0 px-4 py-3 bg-card border border-border rounded-xl overflow-x-auto">
      {steps.map((step, i) => {
        const done = i < steps.length - 1 || ["Accepted", "PartiallyAccepted", "Rejected"].includes(status);
        const active = step === status;
        return (
          <div key={step} className="flex items-center gap-0 min-w-0">
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
              active
                ? status === "Rejected" ? "bg-red-100 text-red-700 border border-red-200"
                  : status === "PartiallyAccepted" ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                : done ? "text-emerald-700" : "text-muted-foreground"
            )}>
              <span className="text-[14px]">
                {step === "Draft" ? "📝" : step === "Submitted" ? "📤" : step === "Accepted" ? "✅" : step === "PartiallyAccepted" ? "🔶" : "❌"}
              </span>
              {step === "PartiallyAccepted" ? "Partial" : step}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 mx-0.5 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
            <button type="button" onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
          <Camera className="w-5 h-5" />
          <span className="text-[10px] font-medium">Add photo</span>
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) { onAdd(e.target.files); e.target.value = ""; } }} />
    </div>
  );
}

function StatCard({ label, value, valueClass }: { label: string; value: number | string | null; valueClass?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <p className={cn("text-2xl font-bold font-mono", valueClass ?? "text-foreground")}>{value ?? 0}</p>
      <p className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wide">{label}</p>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export default function GRNDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const grnId = Number(id);
  const { user: authUser } = useAuth();
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();
  const isApprover = ["admin", "approver"].includes(user.role);

  const { data: grn, isLoading } = useGetProcGrn(grnId, { query: { enabled: !!grnId, queryKey: getGetProcGrnQueryKey(grnId) } });

  useEffect(() => {
    if (grn?.grnNumber && authUser?.id) addRecentEntry(authUser.id, `/procurement/grns/${grnId}`, grn.grnNumber, "GRNs");
  }, [grn?.grnNumber, grnId, authUser?.id]);

  const submitMut = useSubmitProcGrn();
  const approveMut = useApproveProcGrn();
  const rejectMut = useRejectProcGrn();

  const [activeTab, setActiveTab] = useState<"overview" | "items" | "comments" | "activity">("overview");
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [reverseReason, setReverseReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [localComments, setLocalComments] = useState<any[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [reversing, setReversing] = useState(false);

  const addPhotos = (files: FileList) => setPhotos(prev => [...prev, ...Array.from(files).map(f => ({ url: URL.createObjectURL(f), name: f.name }))]);
  const removePhoto = (idx: number) => setPhotos(prev => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_, i) => i !== idx); });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetProcGrnQueryKey(grnId) });
    qc.invalidateQueries({ queryKey: getGetProcGrnsQueryKey() });
  };

  // Sync comments from grn data
  useEffect(() => {
    if ((grn as any)?.comments) setLocalComments((grn as any).comments);
  }, [(grn as any)?.comments]);

  const runAction = (action: string) => {
    if (["approve", "reject"].includes(action) && !remarks.trim()) {
      toast({ title: "Remarks required", variant: "destructive" }); return;
    }
    const payload = { id: grnId, data: { userName: user.name, userId: user.id, remarks } as any };
    const handlers = {
      onSuccess: () => { invalidate(); setActionDialog(null); setRemarks(""); toast({ title: `GRN ${action}d successfully` }); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    };
    if (action === "submit") submitMut.mutate(payload, handlers);
    else if (action === "approve") approveMut.mutate(payload, handlers);
    else if (action === "reject") rejectMut.mutate(payload, handlers);
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; }
    setCancelling(true);
    try {
      await apiPost(`/proc-grns/${grnId}/cancel`, { userId: user.id, userName: user.name, reason: cancelReason });
      invalidate(); setShowCancelDialog(false); setCancelReason("");
      toast({ title: "GRN cancelled successfully" });
    } catch (e: any) {
      toast({ title: "Failed to cancel", description: e?.message, variant: "destructive" });
    } finally { setCancelling(false); }
  };

  const handleReverse = async () => {
    if (!reverseReason.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; }
    setReversing(true);
    try {
      await apiPost(`/proc-grns/${grnId}/reverse`, { userId: user.id, userName: user.name, reason: reverseReason });
      invalidate(); setShowReverseDialog(false); setReverseReason("");
      toast({ title: "GRN reversed — stock quantities unwound", description: "PO delivery quantities have been adjusted." });
    } catch (e: any) {
      toast({ title: "Failed to reverse", description: e?.message, variant: "destructive" });
    } finally { setReversing(false); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const comment = await apiPost<any>(`/proc-grns/${grnId}/comments`, {
        userId: user.id, userName: user.name, userRole: user.role, body: newComment.trim(),
      });
      setLocalComments(prev => [...prev, comment]);
      setNewComment("");
      toast({ title: "Comment added" });
    } catch (e: any) {
      toast({ title: "Failed to add comment", description: e?.message, variant: "destructive" });
    } finally { setSubmittingComment(false); }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await apiDelete(`/proc-grns/${grnId}/comments/${commentId}`);
      setLocalComments(prev => prev.filter(c => c.id !== commentId));
      toast({ title: "Comment deleted" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  if (isLoading || !grn) return (
    <div className="flex h-60 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading GRN…</p>
      </div>
    </div>
  );

  const g = grn as any;
  const canSubmit   = g.status === "Draft";
  const canApprove  = isApprover && g.status === "Submitted";
  const canReject   = isApprover && g.status === "Submitted";
  const canCancel   = ["Draft", "Submitted"].includes(g.status);
  const canReverse  = isApprover && ["Accepted", "PartiallyAccepted"].includes(g.status);
  const canReturn   = ["Accepted", "PartiallyAccepted", "Rejected"].includes(g.status);
  const isTerminal  = ["Cancelled", "Reversed"].includes(g.status);

  const hasActions = canSubmit || canApprove || canReject;

  // Tabs
  const TABS = [
    { key: "overview",  label: "Overview",  icon: Package },
    { key: "items",     label: `Items (${(g.items ?? []).length})`, icon: Layers },
    { key: "comments",  label: `Comments (${localComments.length})`, icon: MessageSquare },
    { key: "activity",  label: `Activity (${(g.auditLogs ?? []).length})`, icon: Activity },
  ] as const;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
      className={cn("space-y-4", hasActions ? "pb-28 lg:pb-10" : "pb-10")}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title={g.grnNumber}
        subtitle={`${g.vendorName ?? ""}${g.createdByName ? ` · Created by ${g.createdByName}` : ""}${g.warehouseName ? ` · ${g.warehouseName}` : ""}`}
        actions={
          <div className="flex items-center gap-2 print:hidden flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setLocation("/procurement/grns")} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            {canReturn && (
              <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex"
                onClick={() => setLocation(`/procurement/grn-returns/new?grnId=${grnId}`)}>
                <PackageX className="w-3.5 h-3.5" /> Create Return
              </Button>
            )}
            {/* Desktop actions */}
            <div className="hidden lg:flex items-center gap-2">
              {canCancel && !isTerminal && (
                <Button variant="outline" size="sm" className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowCancelDialog(true)}>
                  <XCircle className="w-3.5 h-3.5" /> Cancel GRN
                </Button>
              )}
              {canReverse && (
                <Button variant="outline" size="sm" className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => setShowReverseDialog(true)}>
                  <RotateCcw className="w-3.5 h-3.5" /> Reverse
                </Button>
              )}
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

      {/* ── Lifecycle bar ──────────────────────────────────────────────────── */}
      <LifecycleBar status={g.status} />

      {/* ── Lock banner ────────────────────────────────────────────────────── */}
      {g.isLocked && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-400">
          <Lock className="w-4 h-4 shrink-0" />
          <span>This GRN is <strong>locked</strong> — approved and posted to stock ledger. Use <em>Reverse</em> to undo.</span>
        </div>
      )}

      {/* ── Cancelled/Reversed detail banner ────────────────────────────────── */}
      {g.status === "Cancelled" && g.cancellationReason && (
        <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Cancelled by {g.cancelledByName}</span> on {formatDateTime(g.cancelledAt)}
          <p className="mt-0.5">Reason: {g.cancellationReason}</p>
        </div>
      )}
      {g.status === "Reversed" && g.reversalReason && (
        <div className="px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
          <span className="font-semibold text-orange-800">Reversed by {g.reversedByName}</span> on {formatDateTime(g.reversedAt)}
          <p className="mt-0.5">Reason: {g.reversalReason} — stock quantities have been unwound.</p>
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Ordered"  value={g.totalOrderedQty}  />
        <StatCard label="Total Received" value={g.totalReceivedQty} valueClass="text-blue-600" />
        <StatCard label="Total Accepted" value={g.totalAcceptedQty} valueClass="text-emerald-600" />
        <StatCard label="Total Rejected" value={g.totalRejectedQty} valueClass="text-red-600" />
        <div className="bg-card border border-border rounded-xl p-4 text-center col-span-2 md:col-span-1">
          <p className="text-2xl font-bold font-mono text-emerald-600">
            {g.totalAcceptedValue != null ? `₹${Number(g.totalAcceptedValue).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wide">Accepted Value</p>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-0 hide-scrollbar">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <SectionCard title="Receipt Details">
                <DetailGrid cols={4}>
                  <DetailRow label="PO Reference" value={g.poId ? `PO #${g.poId}` : undefined} mono />
                  <DetailRow label="Vendor" value={g.vendorName} />
                  <DetailRow label="Received By" value={g.receivedByName} />
                  <DetailRow label="Vehicle No." value={g.vehicleNumber} mono />
                  <DetailRow label="DC Number" value={g.dcNumber} mono />
                  <DetailRow label="DC Date" value={formatDate(g.dcDate)} />
                  <DetailRow label="Delivery Date" value={formatDate(g.deliveryDate)} />
                  <DetailRow label="Created" value={formatDate(g.createdAt)} />
                </DetailGrid>
              </SectionCard>

              {(g.warehouseName || g.storageLocation) && (
                <SectionCard title="Storage">
                  <DetailGrid cols={2}>
                    {g.warehouseName && <DetailRow label="Warehouse" value={g.warehouseName} />}
                    {g.storageLocation && <DetailRow label="Location" value={g.storageLocation} mono />}
                  </DetailGrid>
                </SectionCard>
              )}

              {(g.approvedByName || g.rejectedByName) && (
                <SectionCard title="Approval Chain">
                  <DetailGrid cols={2}>
                    {g.approvedByName && (
                      <>
                        <DetailRow label="Approved By" value={g.approvedByName} />
                        <DetailRow label="Approved At" value={formatDateTime(g.approvedAt)} />
                      </>
                    )}
                    {g.rejectedByName && (
                      <>
                        <DetailRow label="Rejected By" value={g.rejectedByName} />
                        <DetailRow label="Rejected At" value={formatDateTime(g.rejectedAt)} />
                      </>
                    )}
                    {g.approvalRemarks && <DetailRow label="Approval Remarks" value={g.approvalRemarks} colSpan={2} />}
                  </DetailGrid>
                </SectionCard>
              )}

              {g.remarks && (
                <SectionCard title="Remarks">
                  <p className="text-sm text-muted-foreground">{g.remarks}</p>
                </SectionCard>
              )}

              <SectionCard title="Delivery Photos">
                <PhotoUpload photos={photos} onAdd={addPhotos} onRemove={removePhoto} />
              </SectionCard>

              {canReturn && (
                <SectionCard title="GRN Returns">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Create a return for rejected or damaged goods.</p>
                    <Button variant="outline" size="sm" className="gap-1.5"
                      onClick={() => setLocation(`/procurement/grn-returns/new?grnId=${grnId}`)}>
                      <PackageX className="w-3.5 h-3.5" /> Create Return
                    </Button>
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* ITEMS & QC */}
          {activeTab === "items" && (
            <div className="space-y-4">
              {/* Mobile card view */}
              <div className="lg:hidden space-y-3">
                {(g.items ?? []).map((item: any) => (
                  <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{item.materialName}</p>
                          {item.materialCode && <p className="text-[11px] text-muted-foreground font-mono">{item.materialCode}</p>}
                        </div>
                        <span className={cn(
                          "shrink-0 inline-flex items-center rounded-md border text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wide",
                          QC_COLOR[item.qcStatus] ?? "bg-slate-100 text-slate-600 border-slate-200"
                        )}>{item.qcStatus}</span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center mb-3">
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

                      {(item.batchNumber || item.expiryDate || item.storageLocation || item.barcodeData) && (
                        <div className="pt-2 border-t border-border space-y-1">
                          {item.batchNumber && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Hash className="w-3 h-3" /> Batch: <span className="font-mono text-foreground">{item.batchNumber}</span>
                            </div>
                          )}
                          {item.expiryDate && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Clock className="w-3 h-3" /> Expiry: <span className="font-mono text-foreground">{item.expiryDate}</span>
                            </div>
                          )}
                          {item.storageLocation && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Warehouse className="w-3 h-3" /> Location: <span className="font-mono text-foreground">{item.storageLocation}</span>
                            </div>
                          )}
                          {item.barcodeData && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Barcode className="w-3 h-3" /> <span className="font-mono text-foreground">{item.barcodeData}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {item.damagedQty > 0 && <p className="mt-1.5 text-[11px] text-amber-600 font-medium">⚠️ Damaged: {item.damagedQty} {item.uom}</p>}
                      {item.rejectionReason && <p className="mt-0.5 text-[11px] text-muted-foreground">Reason: {item.rejectionReason}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <SectionCard title="Line Items & Inspection Results" noPadding className="hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        {["#", "Material", "UOM", "Ordered", "Received", "Accepted", "Rejected", "Damaged", "QC", "Batch / Expiry", "Location", "Barcode", "Rejection Reason"].map(h => (
                          <th key={h} className="text-left px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {(g.items ?? []).map((item: any) => (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-3 text-muted-foreground text-[12px]">{item.lineNo}</td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-foreground">{item.materialName}</p>
                            {item.materialCode && <p className="text-[11px] text-muted-foreground font-mono">{item.materialCode}</p>}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{item.uom}</td>
                          <td className="px-3 py-3 font-mono">{item.orderedQty}</td>
                          <td className="px-3 py-3 font-mono text-blue-600">{item.receivedQty}</td>
                          <td className="px-3 py-3 font-mono font-bold text-emerald-600">{item.acceptedQty}</td>
                          <td className="px-3 py-3 font-mono text-red-600">{item.rejectedQty}</td>
                          <td className="px-3 py-3 font-mono text-amber-600">{item.damagedQty}</td>
                          <td className="px-3 py-3">
                            <span className={cn(
                              "inline-flex items-center rounded-md border text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wide",
                              QC_COLOR[item.qcStatus] ?? "bg-slate-100 text-slate-600 border-slate-200"
                            )}>{item.qcStatus}</span>
                          </td>
                          <td className="px-3 py-3 text-[11px]">
                            {item.batchNumber && <div className="font-mono text-foreground">Batch: {item.batchNumber}</div>}
                            {item.expiryDate && <div className="text-muted-foreground">Exp: {item.expiryDate}</div>}
                          </td>
                          <td className="px-3 py-3 text-[11px] font-mono text-muted-foreground max-w-28 truncate">
                            {item.storageLocation ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-[11px] font-mono text-muted-foreground max-w-28 truncate">
                            {item.barcodeData ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground text-[11px] max-w-40 truncate">{item.rejectionReason ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              {/* QC Summary */}
              {(g.items ?? []).length > 0 && (
                <SectionCard title="QC Summary">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(["Accepted", "PartiallyAccepted", "Rejected", "Pending"] as const).map(s => {
                      const count = (g.items ?? []).filter((i: any) => i.qcStatus === s).length;
                      return (
                        <div key={s} className={cn("rounded-lg border p-3 text-center", QC_COLOR[s] ?? "")}>
                          <p className="text-xl font-bold font-mono">{count}</p>
                          <p className="text-[11px] font-semibold uppercase tracking-wide mt-0.5">{s === "PartiallyAccepted" ? "Partial" : s}</p>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* COMMENTS */}
          {activeTab === "comments" && (
            <div className="space-y-4">
              {/* Add comment */}
              {!isTerminal && (
                <SectionCard title="Add Comment">
                  <div className="space-y-3">
                    <Textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Write a comment, note, or question about this GRN…"
                      className="min-h-20 resize-none"
                    />
                    <div className="flex justify-end">
                      <Button size="sm" className="gap-1.5" onClick={handleAddComment} disabled={submittingComment || !newComment.trim()}>
                        {submittingComment ? <div className="w-3.5 h-3.5 border border-t-transparent rounded-full animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        Post Comment
                      </Button>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Comments list */}
              {localComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-card border border-dashed border-border rounded-xl">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm font-medium">No comments yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {localComments.map(comment => (
                    <div key={comment.id} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{(comment.userName ?? "?")[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{comment.userName ?? "Unknown"}</p>
                            <p className="text-[11px] text-muted-foreground">{timeAgo(comment.createdAt)} · {comment.userRole ?? ""}</p>
                          </div>
                        </div>
                        {comment.userId === user.id && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDeleteComment(comment.id)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-foreground mt-3 leading-relaxed">{comment.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACTIVITY */}
          {activeTab === "activity" && (
            <SectionCard title="Activity Timeline">
              {(g.auditLogs ?? []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No activity yet</div>
              ) : (
                <div className="space-y-4">
                  {(g.auditLogs ?? []).map((log: any, idx: number) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold",
                          log.action.includes("Approved") ? "bg-emerald-100 text-emerald-700"
                          : log.action.includes("Rejected") || log.action.includes("Cancelled") ? "bg-red-100 text-red-700"
                          : log.action.includes("Submitted") ? "bg-blue-100 text-blue-700"
                          : log.action.includes("Reversed") ? "bg-orange-100 text-orange-700"
                          : "bg-muted text-muted-foreground"
                        )}>
                          {log.action.includes("Approved") ? "✓"
                           : log.action.includes("Rejected") ? "✗"
                           : log.action.includes("Cancelled") ? "⊗"
                           : log.action.includes("Reversed") ? "↩"
                           : log.action.includes("Submitted") ? "→"
                           : "·"}
                        </div>
                        {idx < g.auditLogs.length - 1 && <div className="w-px flex-1 bg-border/60 mt-1" />}
                      </div>
                      <div className="pb-4 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground">
                          {log.action}
                          <span className="text-muted-foreground font-normal"> · {log.performedByName}</span>
                        </p>
                        {log.remarks && <p className="text-[12px] text-muted-foreground mt-0.5">{log.remarks}</p>}
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatDateTime(log.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

        </motion.div>
      </AnimatePresence>

      {/* ── Mobile sticky action bar ─────────────────────────────────────────── */}
      {hasActions && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 print:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}>
          <div className="mx-4 mb-2 bg-card border border-border rounded-2xl shadow-xl p-3 flex gap-3">
            {canSubmit && (
              <Button className="flex-1 h-12 text-sm gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                onClick={() => setActionDialog("submit")}>
                <Send className="w-4 h-4" /> Submit
              </Button>
            )}
            {canApprove && (
              <Button className="flex-1 h-12 text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                onClick={() => setActionDialog("approve")}>
                <CheckCircle2 className="w-4 h-4" /> Approve
              </Button>
            )}
            {canReject && (
              <Button variant="outline" className="flex-1 h-12 text-sm gap-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                onClick={() => setActionDialog("reject")}>
                <XCircle className="w-4 h-4" /> Reject
              </Button>
            )}
            {canCancel && !isTerminal && (
              <Button variant="outline" className="h-12 px-3 rounded-xl border-slate-300 text-slate-700"
                onClick={() => setShowCancelDialog(true)}>
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Submit / Approve / Reject dialog ────────────────────────────────── */}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setRemarks(""); }}>Cancel</Button>
            <Button
              className={cn(
                actionDialog === "approve" ? "bg-emerald-600 hover:bg-emerald-700" :
                actionDialog === "reject"  ? "bg-red-600 hover:bg-red-700" :
                                            "bg-blue-600 hover:bg-blue-700"
              )}
              onClick={() => runAction(actionDialog ?? "")}
              disabled={submitMut.isPending || approveMut.isPending || rejectMut.isPending}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel GRN dialog ───────────────────────────────────────────────── */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Cancel GRN
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel <strong>{g.grnNumber}</strong>. A cancelled GRN cannot be re-opened.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Cancellation Reason *</label>
            <Textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Provide a reason for cancellation…"
              className="min-h-16"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason("")}>Keep GRN</AlertDialogCancel>
            <AlertDialogAction
              className="bg-slate-600 hover:bg-slate-700 text-white"
              onClick={e => { e.preventDefault(); handleCancel(); }}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Confirm Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reverse GRN dialog ──────────────────────────────────────────────── */}
      <AlertDialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-500" /> Reverse GRN
            </AlertDialogTitle>
            <AlertDialogDescription>
              Reversing <strong>{g.grnNumber}</strong> will undo all stock ledger entries and reset PO delivery quantities. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Reversal Reason *</label>
            <Textarea
              value={reverseReason}
              onChange={e => setReverseReason(e.target.value)}
              placeholder="Provide a reason for reversal…"
              className="min-h-16"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReverseReason("")}>Keep GRN</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={e => { e.preventDefault(); handleReverse(); }}
              disabled={reversing}
            >
              {reversing ? "Reversing…" : "Confirm Reverse"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
