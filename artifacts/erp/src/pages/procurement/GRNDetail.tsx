import { useState } from "react";
import {
  useGetProcGrn, getGetProcGrnQueryKey, getGetProcGrnsQueryKey,
  useSubmitProcGrn, useApproveProcGrn, useRejectProcGrn,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Package, CheckCircle2, XCircle, Send, Clock, Printer } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { StatusBadge, DetailRow, DetailGrid, SectionCard, PageHeader } from "@/components/shared";

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

export default function GRNDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const grnId = Number(id);
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();
  const isApprover = ["admin", "approver"].includes(user.role);

  const { data: grn, isLoading } = useGetProcGrn(grnId, { query: { enabled: !!grnId, queryKey: getGetProcGrnQueryKey(grnId) } });
  const submitMut = useSubmitProcGrn();
  const approveMut = useApproveProcGrn();
  const rejectMut = useRejectProcGrn();

  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="space-y-5 pb-10">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title={g.grnNumber}
        subtitle={`${g.vendorName ?? ""}${g.createdByName ? ` · Created by ${g.createdByName}` : ""}`}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setLocation("/procurement/grns")} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
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

      {/* ── Line Items & QC ─────────────────────────────────────────────────── */}
      <SectionCard title="Line Items & Inspection Results" noPadding>
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
