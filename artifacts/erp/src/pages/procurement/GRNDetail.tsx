import { useState } from "react";
import {
  useGetProcGrn, getGetProcGrnQueryKey, getGetProcGrnsQueryKey,
  useSubmitProcGrn, useApproveProcGrn, useRejectProcGrn,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Package, CheckCircle2, XCircle, Send, AlertTriangle, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Draft: { label: "Draft", color: "bg-slate-100 text-slate-600 border-slate-200" },
  Submitted: { label: "Submitted", color: "bg-blue-50 text-blue-700 border-blue-200" },
  Accepted: { label: "Accepted", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PartiallyAccepted: { label: "Partially Accepted", color: "bg-amber-50 text-amber-700 border-amber-200" },
  Rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200" },
};

const QC_COLOR: Record<string, string> = {
  Pending: "bg-slate-100 text-slate-600",
  Accepted: "bg-emerald-50 text-emerald-700",
  PartiallyAccepted: "bg-amber-50 text-amber-700",
  Rejected: "bg-red-50 text-red-700",
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
    <div className="flex h-60 items-center justify-center"><div className="animate-pulse text-slate-400">Loading GRN…</div></div>
  );

  const g = grn as any;
  const cfg = STATUS_CONFIG[g.status] ?? STATUS_CONFIG.Draft;
  const canSubmit = g.status === "Draft";
  const canApprove = isApprover && g.status === "Submitted";
  const canReject = isApprover && g.status === "Submitted";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setLocation("/procurement/grns")} className="h-9 w-9 shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-mono text-slate-900">{g.grnNumber}</h1>
                <Badge variant="outline" className={cn("text-sm", cfg.color)}>{cfg.label}</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">{g.vendorName} · PO #{g.poId} · Created {new Date(g.createdAt).toLocaleDateString("en-IN")} by {g.createdByName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canSubmit && (
              <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setActionDialog("submit")}>
                <Send className="w-3.5 h-3.5" /> Submit for Inspection
              </Button>
            )}
            {canApprove && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={() => setActionDialog("approve")}>
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

        {/* Delivery metadata */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-100 text-sm">
          <div><p className="text-xs text-slate-500">Delivery Date</p><p className="font-medium">{g.deliveryDate ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Vehicle No.</p><p className="font-medium">{g.vehicleNumber ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">DC Number</p><p className="font-medium">{g.dcNumber ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">DC Date</p><p className="font-medium">{g.dcDate ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Received By</p><p className="font-medium">{g.receivedByName ?? "—"}</p></div>
        </div>
      </div>

      {/* Quantity summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Ordered", value: g.totalOrderedQty, color: "text-slate-900" },
          { label: "Total Received", value: g.totalReceivedQty, color: "text-blue-700" },
          { label: "Total Accepted", value: g.totalAcceptedQty, color: "text-emerald-700" },
          { label: "Total Rejected", value: g.totalRejectedQty, color: "text-red-700" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={cn("text-2xl font-bold font-mono", s.color)}>{s.value ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">Line Items & Inspection Results</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["#", "Material", "UOM", "Ordered", "Received", "Accepted", "Rejected", "Damaged", "QC Status", "Rejection Reason"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(g.items ?? []).map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400">{item.lineNo}</td>
                  <td className="px-4 py-3"><p className="font-medium text-slate-900">{item.materialName}</p>{item.materialCode && <p className="text-xs text-slate-400">{item.materialCode}</p>}</td>
                  <td className="px-4 py-3 text-slate-600">{item.uom}</td>
                  <td className="px-4 py-3 font-mono">{item.orderedQty}</td>
                  <td className="px-4 py-3 font-mono text-blue-700">{item.receivedQty}</td>
                  <td className="px-4 py-3 font-mono text-emerald-700 font-bold">{item.acceptedQty}</td>
                  <td className="px-4 py-3 font-mono text-red-600">{item.rejectedQty}</td>
                  <td className="px-4 py-3 font-mono text-amber-600">{item.damagedQty}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("text-xs", QC_COLOR[item.qcStatus] ?? "")}>{item.qcStatus}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-40 truncate">{item.rejectionReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit log */}
      {(g.auditLogs ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-bold text-slate-900 mb-4">Audit Trail</h2>
          <div className="space-y-3">
            {g.auditLogs.map((log: any) => (
              <div key={log.id} className="flex gap-3">
                <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{log.action} <span className="text-slate-500 font-normal">by {log.performedByName}</span></p>
                  {log.remarks && <p className="text-sm text-slate-500 mt-0.5">{log.remarks}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action dialog */}
      <Dialog open={!!actionDialog} onOpenChange={o => { if (!o) { setActionDialog(null); setRemarks(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="capitalize">{actionDialog} GRN</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder={`Enter remarks${["approve","reject"].includes(actionDialog ?? "") ? " (required)" : ""}…`} className="min-h-20" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setActionDialog(null); setRemarks(""); }}>Cancel</Button>
              <Button className={cn(actionDialog === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : actionDialog === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700")}
                onClick={() => runAction(actionDialog ?? "")}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
