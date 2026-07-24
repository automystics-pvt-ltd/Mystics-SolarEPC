import { useState, useEffect, useRef } from "react";
import {
  useGetProcurementQuotation, getGetProcurementQuotationQueryKey, getGetProcurementQuotationsQueryKey,
  useSubmitProcurementQuotation,
  useStartProcurementQuotationReview, useApproveProcurementQuotation,
  useRejectProcurementQuotation, useRequestProcurementQuotationRevision,
  useAddProcurementQuotationComment, useDeleteProcurementQuotation,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, RotateCcw, Send, Eye, MessageSquare, BarChart2,
  Clock, FileText, Star, ShoppingCart, History, Lock, LockOpen,
  Paperclip, Upload, Trash2, Download, ExternalLink, AlertTriangle,
  Check, X, ChevronRight, Users, Shield, Timer, GitBranch, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader, SectionCard, DetailGrid, DetailRow, StatusBadge } from "@/components/shared";
import { addRecentEntry } from "@/lib/recentHistory";
import { useAuth } from "@/lib/auth";
import { apiPost, apiDelete } from "@/lib/fetch";

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const BASE = import.meta.env.BASE_URL;

const ACTION_ICONS: Record<string, any> = {
  Created: FileText, Submitted: Send, ReviewStarted: Eye, Approved: CheckCircle2,
  Rejected: XCircle, RevisionRequested: RotateCcw, Updated: Clock,
  CommentAdded: MessageSquare, Deleted: XCircle, POGenerated: ShoppingCart,
  Reopened: LockOpen, Cancelled: XCircle, AttachmentAdded: Paperclip, AttachmentRemoved: Trash2,
  Escalated: AlertTriangle,
};

function relTime(iso: string | null) {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function slaStatus(deadline: string | null, status: string) {
  if (!deadline || status !== "pending") return null;
  const hrs = (new Date(deadline).getTime() - Date.now()) / 3_600_000;
  if (hrs < 0)  return { label: `${Math.abs(Math.ceil(hrs))}h overdue`, cls: "text-red-600 bg-red-50 border-red-200" };
  if (hrs < 8)  return { label: `${Math.ceil(hrs)}h left`, cls: "text-orange-600 bg-orange-50 border-orange-200" };
  if (hrs < 24) return { label: `${Math.ceil(hrs)}h left`, cls: "text-amber-600 bg-amber-50 border-amber-200" };
  return { label: `${Math.floor(hrs / 24)}d left`, cls: "text-emerald-600 bg-emerald-50 border-emerald-200" };
}

function fmt(n: number | null | undefined) {
  return n !== null && n !== undefined
    ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
    : "—";
}

function fileIcon(mimeType: string | null) {
  if (!mimeType) return FileText;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("image")) return Paperclip;
  return FileText;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Approval timeline step ───────────────────────────────────────────────── */
function ApprovalStepRow({ step, isLast, currentStep }: { step: any; isLast: boolean; currentStep: number }) {
  const isActive = step.stepOrder === currentStep && step.status === "pending";
  const isDone   = step.status === "approved";
  const isRej    = step.status === "rejected";
  const isSkip   = ["skipped", "delegated"].includes(step.status);
  const sla      = slaStatus(step.slaDeadline, step.status);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          "h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 z-10",
          isDone   ? "bg-emerald-500 border-emerald-500 text-white"     :
          isRej    ? "bg-red-500 border-red-500 text-white"              :
          isActive ? "bg-primary border-primary text-white animate-pulse" :
          isSkip   ? "bg-slate-200 border-slate-300 text-slate-400"     :
                     "bg-muted border-border text-muted-foreground"
        )}>
          {isDone   ? <Check className="h-3.5 w-3.5" />   :
           isRej    ? <X className="h-3.5 w-3.5" />        :
           isActive ? <Clock className="h-3 w-3" />        :
                      <span className="text-[10px] font-bold">{step.stepOrder}</span>}
        </div>
        {!isLast && <div className={cn("w-0.5 h-8 mt-0.5", isDone ? "bg-emerald-400" : "bg-border/60")} />}
      </div>
      <div className={cn("pb-5 flex-1 min-w-0", isLast && "pb-0")}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className={cn("text-[12px] font-semibold",
            isActive ? "text-foreground" : isDone ? "text-emerald-700" : "text-muted-foreground"
          )}>{step.name}</p>
          <div className="flex items-center gap-1.5">
            {isActive && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">In Progress</span>}
            {isDone   && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200">Done</span>}
            {isRej    && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-200">Rejected</span>}
            {sla      && <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-semibold", sla.cls)}>{sla.label}</span>}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {step.approverRole ? `Approver: ${step.approverRole}` : "Any approver"}
          {step.actedByName && ` · ${step.actedByName}`}
          {step.actedAt && <> · <span className="tabular-nums">{relTime(step.actedAt)}</span></>}
          {step.delegatedToName && <> · <span className="text-violet-600">→ {step.delegatedToName}</span></>}
        </p>
        {step.comment && (
          <p className="mt-1 text-[11px] text-muted-foreground italic bg-muted/40 rounded px-2 py-1 border border-border/40">"{step.comment}"</p>
        )}
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export default function ProcurementQuotationDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const qId = Number(id);
  const { user: authUser } = useAuth();
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: quotation, isPending, isError } = useGetProcurementQuotation(qId, {
    query: { enabled: !!qId, queryKey: getGetProcurementQuotationQueryKey(qId) },
  });

  useEffect(() => {
    if (quotation?.referenceId && authUser?.id)
      addRecentEntry(authUser.id, `/procurement/quotations/${qId}`, quotation.referenceId, "Vendor Quotations");
  }, [quotation?.referenceId, qId, authUser?.id]);

  // Mutations from generated API client
  const submitMut   = useSubmitProcurementQuotation();
  const reviewMut   = useStartProcurementQuotationReview();
  const approveMut  = useApproveProcurementQuotation();
  const rejectMut   = useRejectProcurementQuotation();
  const revisionMut = useRequestProcurementQuotationRevision();
  const commentMut  = useAddProcurementQuotationComment();
  const deleteMut   = useDeleteProcurementQuotation();

  // Custom mutations for new endpoints
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();
  const token = localStorage.getItem("mystics_token") ?? "";

  const reopenMut = useMutation({
    // Actor identity (role/userId) is derived from the Bearer token server-side — only reason goes in body
    mutationFn: (reason: string) => apiPost(`/procurement-quotations/${qId}/reopen`, { reason }),
    onSuccess: () => { invalidate(); setActionDialog(null); setReopenReason(""); toast({ title: "Quotation reopened for revision" }); },
    onError: (e: any) => toast({ title: "Failed to reopen", description: e?.message ?? "Error", variant: "destructive" }),
  });

  const deleteAttachmentMut = useMutation({
    // Actor identity is derived from the Bearer token server-side — no userId/role in body
    mutationFn: (attId: number) => apiDelete(`/procurement-quotations/${qId}/attachments/${attId}`),
    onSuccess: () => { invalidate(); toast({ title: "Attachment removed" }); },
    onError: () => toast({ title: "Failed to remove attachment", variant: "destructive" }),
  });

  const isApprover = ["admin", "director", "pm"].includes(user.role);
  const isAdminOrDirector = ["admin", "director"].includes(user.role);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetProcurementQuotationQueryKey(qId) });
    qc.invalidateQueries({ queryKey: getGetProcurementQuotationsQueryKey() });
  };

  const runAction = (action: string) => {
    if (["approve", "reject", "request-revision"].includes(action) && !remarks.trim()) {
      toast({ title: "Remarks required", variant: "destructive" }); return;
    }
    const payload = { userName: user.name, userId: user.id, userRole: user.role, remarks };
    const ok = () => { invalidate(); setActionDialog(null); setRemarks(""); toast({ title: "Done" }); };
    const err = (e: any) => toast({ title: "Failed", description: e?.message ?? "Error", variant: "destructive" });
    if (action === "submit")           submitMut.mutate({ id: qId, data: payload as any }, { onSuccess: () => { invalidate(); setActionDialog(null); setRemarks(""); toast({ title: "Submitted for approval" }); }, onError: err });
    else if (action === "start-review")  reviewMut.mutate({ id: qId, data: payload as any }, { onSuccess: ok, onError: err });
    else if (action === "approve")       approveMut.mutate({ id: qId, data: payload as any }, { onSuccess: () => { invalidate(); setActionDialog(null); setRemarks(""); toast({ title: "✓ Approved & PO generated" }); }, onError: err });
    else if (action === "reject")        rejectMut.mutate({ id: qId, data: payload as any }, { onSuccess: ok, onError: err });
    else if (action === "request-revision") revisionMut.mutate({ id: qId, data: payload as any }, { onSuccess: ok, onError: err });
    else if (action === "comment")       commentMut.mutate({ id: qId, data: payload as any }, { onSuccess: ok, onError: err });
  };

  /* ── File upload ─────────────────────────────────────────────────────────── */
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      // Step 1: Register metadata + get presigned URL in one call
      const metaRes = await fetch(`${BASE}api/procurement-quotations/${qId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type, userName: user.name, userId: user.id, userRole: user.role }),
      });
      if (!metaRes.ok) throw new Error("Failed to register attachment");
      const { uploadURL, attachment } = await metaRes.json();
      const attachmentId: number | null = attachment?.id ?? null;

      // Step 2: Upload directly to GCS
      const uploadRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) {
        // Cleanup orphaned DB row
        if (attachmentId) await fetch(`${BASE}api/procurement-quotations/${qId}/attachments/${attachmentId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        throw new Error("Upload to storage failed");
      }

      invalidate();
      toast({ title: `${file.name} uploaded` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  /* ── Authenticated download ──────────────────────────────────────────────── */
  const downloadAttachment = async (att: any) => {
    try {
      const res = await fetch(`${BASE}api/storage${att.fileKey}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = att.fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      toast({ title: "Download failed", description: "Could not fetch the file", variant: "destructive" });
    }
  };

  if (isPending) return (
    <div className="flex h-60 items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading quotation…</div>
    </div>
  );
  if (isError || !quotation) return (
    <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
      Failed to load quotation. Please go back and try again.
    </div>
  );

  const q = quotation as any;
  const isLocked    = q.status === "Approved";
  const canEdit     = ["Draft", "RevisionRequested"].includes(q.status ?? "") && !isLocked;
  const canSubmit   = q.status === "Draft";
  const canReview   = isApprover && q.status === "Submitted";
  const canApprove  = isApprover && q.status === "UnderReview";
  const canReject   = isApprover && ["UnderReview", "Submitted"].includes(q.status ?? "");
  const canRevision = isApprover && ["UnderReview", "Submitted"].includes(q.status ?? "");
  const canReopen   = isAdminOrDirector && isLocked;
  const approvalReq = q.approvalRequest;

  const headerActions = (
    <div className="flex gap-2 flex-wrap">
      {canEdit && <Button variant="outline" size="sm" onClick={() => setLocation(`/procurement/quotations/${qId}/edit`)}>Edit</Button>}
      {canSubmit && <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setActionDialog("submit")}><Send className="w-3.5 h-3.5" /> Submit</Button>}
      {canReview && <Button size="sm" variant="outline" onClick={() => setActionDialog("start-review")}><Eye className="w-3.5 h-3.5 mr-1" /> Start Review</Button>}
      {canRevision && <Button size="sm" variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => setActionDialog("request-revision")}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Request Revision</Button>}
      {canReject && <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setActionDialog("reject")}><XCircle className="w-3.5 h-3.5 mr-1" /> Reject</Button>}
      {canApprove && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={() => setActionDialog("approve")}><CheckCircle2 className="w-3.5 h-3.5" /> Approve & PO</Button>}
      {canReopen && <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50 gap-1.5" onClick={() => setActionDialog("reopen")}><LockOpen className="w-3.5 h-3.5" /> Reopen</Button>}
      {q.mrId && <Button size="sm" variant="outline" onClick={() => setLocation(`/procurement/material-requests/${q.mrId}/compare`)} title="Compare all quotes"><BarChart2 className="w-3.5 h-3.5" /></Button>}
      <Button size="sm" variant="outline" onClick={() => setActionDialog("comment")}><MessageSquare className="w-3.5 h-3.5" /></Button>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">

      {/* Lock Banner */}
      {isLocked && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Lock className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Quotation Locked</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Approved on {q.approvedAt ? new Date(q.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"} by {q.approvedByName ?? "—"}.
              {" "}No further edits are allowed unless reopened by an authorised user.
            </p>
          </div>
          {canReopen && (
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100 gap-1.5 shrink-0" onClick={() => setActionDialog("reopen")}>
              <LockOpen className="h-3.5 w-3.5" /> Reopen
            </Button>
          )}
        </div>
      )}

      {/* Reopen Notice */}
      {q.reopenedAt && q.status !== "Approved" && (
        <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl">
          <LockOpen className="h-4 w-4 text-violet-600 shrink-0" />
          <p className="text-xs text-violet-700">
            Reopened on {new Date(q.reopenedAt).toLocaleDateString("en-IN")} — Reason: <span className="font-semibold">{q.reopenReason}</span>
          </p>
        </div>
      )}

      <PageHeader
        title={q.referenceId}
        subtitle={`${q.vendorSnapshotName ?? "No vendor"} · v${q.version} · Created ${new Date(q.createdAt).toLocaleDateString("en-IN")} by ${q.createdByName}`}
        backHref="/procurement/quotations"
        badge={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={q.status ?? "Draft"} />
            {isLocked && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1"><Lock className="w-3 h-3" /> Locked</Badge>}
            {q.isL1 && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Star className="w-3 h-3 mr-0.5" /> L1</Badge>}
            {q.poGenerated && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><ShoppingCart className="w-3 h-3 mr-0.5" /> PO Generated</Badge>}
            {approvalReq && (
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 gap-1 cursor-pointer"
                onClick={() => setLocation("/approvals")}>
                <GitBranch className="w-3 h-3" /> {approvalReq.refNumber}
              </Badge>
            )}
          </div>
        }
        actions={headerActions}
      />

      {/* Metadata strip */}
      <SectionCard title="Quotation Details">
        <DetailGrid cols={3}>
          <DetailRow label="Quotation Date" value={q.quotationDate ?? "—"} />
          <DetailRow label="Valid Till"      value={q.validityDate ?? "—"} />
          <DetailRow label="Payment Terms"  value={q.paymentTerms ?? "—"} />
          <DetailRow label="Delivery Terms" value={q.deliveryTerms ?? "—"} />
          <DetailRow label="Delivery Lead"  value={q.deliveryLeadDays ? `${q.deliveryLeadDays} days` : "—"} />
          <DetailRow label="Warranty"       value={q.warrantyMonths ? `${q.warrantyMonths} months` : "—"} />
        </DetailGrid>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="items">
            <TabsList>
              <TabsTrigger value="items">Line Items ({q.items?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="attachments">Attachments ({q.attachments?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="approval">Approval Timeline</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* Line items */}
            <TabsContent value="items" className="mt-3 space-y-4">
              <SectionCard noPadding>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>{["#", "Item / Description", "HSN", "Qty", "UoM", "Rate", "Disc%", "Taxable", "GST", "Total"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(q.items ?? []).map((item: any) => (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.lineNo}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{item.materialName}</p>
                          {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
                          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{item.hsnSacCode ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono">{item.qty}</td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.uom}</td>
                        <td className="px-3 py-2.5 font-mono">₹{Number(item.unitPrice ?? 0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{Number(item.discountPct ?? 0)}%</td>
                        <td className="px-3 py-2.5 font-mono">₹{Number(item.taxableAmount ?? 0).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2.5 text-xs">
                          <p className="font-medium">{Number(item.gstRate ?? 0)}%</p>
                          <p className="text-muted-foreground">₹{Number(item.totalGst ?? 0).toLocaleString("en-IN")}</p>
                        </td>
                        <td className="px-3 py-2.5 font-bold font-mono">
                          ₹{Number(item.lineTotal ?? 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                    {(q.items ?? []).length === 0 && (
                      <tr><td colSpan={10} className="text-center py-8 text-muted-foreground text-sm">No line items</td></tr>
                    )}
                  </tbody>
                </table>
              </SectionCard>

              {/* Totals */}
              <div className="bg-card border border-border rounded-xl p-4 ml-auto max-w-xs">
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Subtotal",      value: fmt(q.subtotal) },
                    { label: "Discount",      value: `- ${fmt(q.totalDiscount)}` },
                    { label: "GST",           value: fmt(q.totalGst) },
                    { label: "Freight",       value: fmt(q.freightCharges) },
                    { label: "Other Charges", value: fmt(q.otherCharges) },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-muted-foreground">
                      <span>{r.label}</span><span className="font-mono">{r.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground text-base">
                    <span>Total Amount</span><span className="font-mono">{fmt(q.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Attachments */}
            <TabsContent value="attachments" className="mt-3">
              <SectionCard title="Attachments">
                <div className="space-y-3">
                  {/* Upload zone */}
                  {!isLocked && (
                    <div
                      className={cn(
                        "border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-all",
                        uploading && "opacity-50 pointer-events-none",
                      )}
                      onClick={() => fileRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                    >
                      <Upload className="h-7 w-7 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">{uploading ? "Uploading…" : "Click or drag to attach files"}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">PDF, images, Excel, Word — any format</p>
                      <input ref={fileRef} type="file" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />
                    </div>
                  )}

                  {/* File list */}
                  {(q.attachments ?? []).length > 0 ? (
                    <div className="space-y-2">
                      {(q.attachments ?? []).map((att: any) => {
                        const FIcon = fileIcon(att.mimeType);
                        return (
                          <div key={att.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20 transition-colors group">
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <FIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{att.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatBytes(att.fileSize)} · {att.uploadedByName} · {relTime(att.uploadedAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                onClick={() => downloadAttachment(att)} title="Download">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              {!isLocked && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600"
                                  onClick={() => deleteAttachmentMut.mutate(att.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No attachments yet</p>
                  )}
                </div>
              </SectionCard>
            </TabsContent>

            {/* Approval Timeline */}
            <TabsContent value="approval" className="mt-3">
              <SectionCard title="Approval Workflow">
                {approvalReq ? (
                  <div className="space-y-4">
                    {/* Request header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-mono text-muted-foreground">{approvalReq.refNumber}</p>
                        <p className="text-sm font-semibold text-foreground">{approvalReq.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[11px] font-bold uppercase px-2 py-0.5 rounded-full border",
                          approvalReq.status === "pending"  ? "bg-amber-50 text-amber-700 border-amber-200"   :
                          approvalReq.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          approvalReq.status === "rejected" ? "bg-red-50 text-red-700 border-red-200"         :
                          "bg-slate-100 text-slate-600 border-slate-200"
                        )}>{approvalReq.status}</span>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setLocation("/approvals")}>
                          <ExternalLink className="h-3 w-3" /> Workbench
                        </Button>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" />
                      Step {approvalReq.currentStep} of {approvalReq.totalSteps}
                      {approvalReq.slaDeadline && (() => {
                        const s = slaStatus(approvalReq.slaDeadline, approvalReq.status);
                        return s ? <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-semibold", s.cls)}>{s.label}</span> : null;
                      })()}
                    </div>

                    {/* Steps */}
                    <div className="mt-4">
                      {(approvalReq.steps ?? []).map((step: any, i: number) => (
                        <ApprovalStepRow key={step.id} step={step} isLast={i === approvalReq.steps.length - 1} currentStep={approvalReq.currentStep} />
                      ))}
                    </div>

                    {/* Activity */}
                    {(approvalReq.actions ?? []).length > 0 && (
                      <div className="border-t border-border/60 pt-4 mt-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Activity</p>
                        <div className="space-y-3">
                          {(approvalReq.actions ?? []).map((a: any) => (
                            <div key={a.id} className="flex gap-2.5 text-xs">
                              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                                {a.actionType === "approved" ? <Check className="h-3 w-3 text-emerald-600" /> :
                                 a.actionType === "rejected" ? <X className="h-3 w-3 text-red-600" /> :
                                 <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">
                                  {a.actorName ?? "System"} <span className="font-normal text-muted-foreground capitalize">{a.actionType}</span>
                                </p>
                                {a.comment && <p className="text-muted-foreground italic">{a.comment}</p>}
                                <p className="text-muted-foreground/60">{relTime(a.createdAt)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <GitBranch className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground font-medium">No approval request yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Submit this quotation to start the approval workflow</p>
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            {/* Notes */}
            <TabsContent value="notes" className="mt-3">
              <SectionCard>
                <div className="space-y-3">
                  {q.vendorRemarks   && <div><p className="text-xs text-muted-foreground font-semibold uppercase">Vendor Remarks</p><p className="text-sm mt-1">{q.vendorRemarks}</p></div>}
                  {q.internalNotes   && <div><p className="text-xs text-muted-foreground font-semibold uppercase">Internal Notes</p><p className="text-sm mt-1">{q.internalNotes}</p></div>}
                  {q.approvalRemarks && <div><p className="text-xs text-muted-foreground font-semibold uppercase">Approval Remarks</p><p className="text-sm mt-1">{q.approvalRemarks}</p></div>}
                  {!q.vendorRemarks && !q.internalNotes && !q.approvalRemarks && (
                    <p className="text-sm text-muted-foreground">No remarks recorded</p>
                  )}
                </div>
              </SectionCard>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Version History */}
          <SectionCard title="Version History" badge={<History className="w-4 h-4 text-muted-foreground" />}>
            <div className="space-y-2">
              {(q.versions ?? []).map((v: any) => (
                <div key={v.id} className="flex items-center gap-2 text-xs">
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono font-bold">v{v.version}</span>
                  <div>
                    <p className="font-medium text-foreground">{v.changeSummary ?? "Updated"}</p>
                    <p className="text-muted-foreground">{v.changedByName} · {new Date(v.createdAt ?? "").toLocaleDateString("en-IN")}</p>
                  </div>
                </div>
              ))}
              {(q.versions ?? []).length === 0 && <p className="text-xs text-muted-foreground">No version history</p>}
            </div>
          </SectionCard>

          {/* Audit Trail */}
          <SectionCard title="Audit Trail" badge={<Clock className="w-4 h-4 text-muted-foreground" />}>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {(q.auditLogs ?? []).map((log: any) => {
                const Icon = ACTION_ICONS[log.action] ?? FileText;
                return (
                  <div key={log.id} className="flex gap-2.5">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      log.action === "Approved" ? "bg-emerald-100" :
                      log.action === "Rejected" ? "bg-red-100" :
                      log.action === "Reopened" ? "bg-amber-100" :
                      "bg-muted"
                    )}>
                      <Icon className={cn("w-3 h-3",
                        log.action === "Approved" ? "text-emerald-600" :
                        log.action === "Rejected" ? "text-red-600" :
                        log.action === "Reopened" ? "text-amber-600" :
                        "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{log.action}</p>
                      {log.remarks && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.remarks}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{log.performedByName} · {relTime(log.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              {(q.auditLogs ?? []).length === 0 && <p className="text-xs text-muted-foreground">No audit logs</p>}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ── Action Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!actionDialog && actionDialog !== "reopen"} onOpenChange={() => { setActionDialog(null); setRemarks(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "submit"            && "Submit for Approval"}
              {actionDialog === "start-review"      && "Start Review"}
              {actionDialog === "approve"           && "Approve Quotation & Generate PO"}
              {actionDialog === "reject"            && "Reject Quotation"}
              {actionDialog === "request-revision"  && "Request Revision"}
              {actionDialog === "comment"           && "Add Comment"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {actionDialog === "submit" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                Submitting will create an Approval Request in the central Approval Workbench. All designated approvers will be notified immediately.
              </div>
            )}
            {["approve", "reject", "request-revision"].includes(actionDialog ?? "") && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">Remarks are mandatory for this action.</div>
            )}
            {actionDialog === "approve" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
                Approving will lock this quotation and automatically generate a Purchase Order. This action cannot be undone without the Reopen workflow.
              </div>
            )}
            <div>
              <Label>{["approve", "reject", "request-revision"].includes(actionDialog ?? "") ? "Remarks *" : "Remarks (optional)"}</Label>
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Enter your remarks…" className="mt-1" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setActionDialog(null); setRemarks(""); }}>Cancel</Button>
              <Button
                onClick={() => runAction(actionDialog!)}
                disabled={submitMut.isPending || reviewMut.isPending || approveMut.isPending || rejectMut.isPending || revisionMut.isPending || commentMut.isPending}
                className={cn(
                  actionDialog === "approve" && "bg-emerald-600 hover:bg-emerald-700",
                  actionDialog === "reject"  && "bg-red-600 hover:bg-red-700",
                )}
              >
                {actionDialog === "approve"           ? "Approve & Generate PO" :
                 actionDialog === "reject"            ? "Reject" :
                 actionDialog === "request-revision"  ? "Send Revision Request" :
                 actionDialog === "submit"            ? "Submit for Approval" :
                 "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={actionDialog === "reopen"} onOpenChange={() => { setActionDialog(null); setReopenReason(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockOpen className="h-4 w-4 text-amber-600" /> Reopen Approved Quotation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚠ This action will unlock the quotation.</p>
              <p>Reopening resets the status to "Revision Requested" and requires a new approval cycle before a PO can be generated.</p>
              <p className="text-amber-700">The linked PO (if already created) will NOT be automatically voided.</p>
            </div>
            <div>
              <Label>Reason for reopening <span className="text-red-500">*</span></Label>
              <Textarea value={reopenReason} onChange={e => setReopenReason(e.target.value)} placeholder="e.g. Price renegotiation required, terms changed…" className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setReopenReason(""); }}>Cancel</Button>
            <Button
              disabled={!reopenReason.trim() || reopenMut.isPending}
              onClick={() => reopenMut.mutate(reopenReason)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {reopenMut.isPending ? "Reopening…" : "Confirm Reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
}
