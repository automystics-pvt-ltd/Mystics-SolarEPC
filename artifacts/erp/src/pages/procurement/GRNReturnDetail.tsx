import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Printer, CheckCircle2, Truck, Lock, Send, Loader2, PackageX, Clock } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/fetch";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Submitted: "bg-blue-50 text-blue-700 border-blue-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Dispatched: "bg-purple-50 text-purple-700 border-purple-200",
  Closed: "bg-gray-100 text-gray-600 border-gray-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

export default function GRNReturnDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [submitDialog, setSubmitDialog] = useState(false);
  const [approveDialog, setApproveDialog] = useState(false);
  const [dispatchDialog, setDispatchDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [creditNoteAmount, setCreditNoteAmount] = useState("");

  const { data: rtv, isLoading } = useQuery({
    queryKey: ["grn-return", id],
    queryFn: () => apiGet<any>(`/grn-returns/${id}`),
  });

  const mutation = (endpoint: string, extra?: any) => useMutation({
    mutationFn: (body: any) => apiPatch(`/grn-returns/${id}/${endpoint}`, { userId: user?.id, userName: user?.name, ...extra, ...body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grn-return", id] });
      qc.invalidateQueries({ queryKey: ["grn-returns"] });
      toast({ title: "Updated", description: "Status updated successfully" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const submitMut = useMutation({
    mutationFn: () => apiPatch(`/grn-returns/${id}/submit`, { userId: user?.id, userName: user?.name, remarks }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grn-return", id] }); qc.invalidateQueries({ queryKey: ["grn-returns"] }); toast({ title: "Submitted", description: "Return submitted for approval" }); setSubmitDialog(false); setRemarks(""); },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const approveMut = useMutation({
    mutationFn: () => apiPatch(`/grn-returns/${id}/approve`, { userId: user?.id, userName: user?.name, remarks }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grn-return", id] }); qc.invalidateQueries({ queryKey: ["grn-returns"] }); toast({ title: "Approved", description: "Return approved" }); setApproveDialog(false); setRemarks(""); },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const dispatchMut = useMutation({
    mutationFn: () => apiPatch(`/grn-returns/${id}/dispatch`, { userId: user?.id, userName: user?.name, dispatchDate, remarks }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grn-return", id] }); qc.invalidateQueries({ queryKey: ["grn-returns"] }); toast({ title: "Dispatched", description: "Return marked as dispatched" }); setDispatchDialog(false); },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const closeMut = useMutation({
    mutationFn: () => apiPatch(`/grn-returns/${id}/close`, { userId: user?.id, userName: user?.name, creditNoteNumber, creditNoteDate, creditNoteAmount: Number(creditNoteAmount) || undefined, remarks }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grn-return", id] }); qc.invalidateQueries({ queryKey: ["grn-returns"] }); toast({ title: "Closed", description: "Return closed successfully" }); setCloseDialog(false); },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );

  if (!rtv) return (
    <div className="p-6 text-center text-gray-400">
      <PackageX className="h-10 w-10 mx-auto mb-2 opacity-50" />
      <p>Return not found</p>
    </div>
  );

  const isAdmin = user?.role === "admin" || user?.role === "director";

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/procurement/grn-returns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{rtv.returnNumber}</h1>
            <Badge variant="outline" className={cn("text-sm font-semibold", STATUS_COLOR[rtv.status] ?? "")}>
              {rtv.status}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">GRN Return — {rtv.vendorName}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          {rtv.status === "Draft" && (
            <Button onClick={() => setSubmitDialog(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Send className="h-4 w-4" /> Submit for Approval
            </Button>
          )}
          {rtv.status === "Submitted" && isAdmin && (
            <Button onClick={() => setApproveDialog(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          )}
          {rtv.status === "Approved" && (
            <Button onClick={() => setDispatchDialog(true)} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
              <Truck className="h-4 w-4" /> Mark Dispatched
            </Button>
          )}
          {(rtv.status === "Dispatched" || rtv.status === "Approved") && isAdmin && (
            <Button onClick={() => setCloseDialog(true)} variant="outline" className="gap-2">
              <Lock className="h-4 w-4" /> Close Return
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Vendor", value: rtv.vendorName },
          { label: "GRN ID", value: `#${rtv.grnId}` },
          { label: "Return Type", value: rtv.returnType },
          { label: "Return Date", value: rtv.returnDate || "—" },
          { label: "Created By", value: rtv.createdByName || "—" },
          { label: "Created At", value: new Date(rtv.createdAt).toLocaleDateString("en-IN") },
          { label: "Total Qty", value: rtv.totalReturnQty ?? 0 },
          { label: "Total Value", value: Number(rtv.totalReturnValue || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" }) },
        ].map(({ label, value }) => (
          <Card key={label} className="border-gray-200/60 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{value as string}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Return Reason */}
      {rtv.returnReason && (
        <Card className="border-gray-200/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Return Reason</p>
            <p className="text-sm text-gray-800">{rtv.returnReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Credit Note (if closed) */}
      {rtv.creditNoteNumber && (
        <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-2">Credit Note</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Credit Note #</p>
                <p className="font-mono font-bold text-sm">{rtv.creditNoteNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-sm font-semibold">{rtv.creditNoteDate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount</p>
                <p className="text-sm font-bold text-emerald-700">
                  {Number(rtv.creditNoteAmount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items Table */}
      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Return Items ({rtv.items?.length ?? 0})</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-500">
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">Material</th>
                <th className="text-center px-4 py-2">UOM</th>
                <th className="text-center px-4 py-2">Return Qty</th>
                <th className="text-right px-4 py-2">Unit Price</th>
                <th className="text-right px-4 py-2">Value</th>
                <th className="text-left px-4 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(rtv.items ?? []).map((item: any) => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{item.lineNo}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.materialName}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{item.uom}</td>
                  <td className="px-4 py-3 text-center font-semibold">{item.returnQty}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {Number(item.unitPrice || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {Number(item.returnValue || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.rejectionReason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Audit Trail */}
      {rtv.auditLogs?.length > 0 && (
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" /> Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rtv.auditLogs.map((log: any, i: number) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <div className="h-2 w-2 rounded-full bg-orange-500 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{log.action}</span>
                      {log.performedByName && (
                        <span className="text-xs text-gray-500">by {log.performedByName}</span>
                      )}
                    </div>
                    {log.remarks && <p className="text-xs text-gray-500 mt-0.5">{log.remarks}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <Dialog open={submitDialog} onOpenChange={setSubmitDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit for Approval</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">Are you sure you want to submit this return for approval?</p>
            <div className="space-y-1">
              <Label>Remarks (optional)</Label>
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialog(false)}>Cancel</Button>
            <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve GRN Return</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Approval Remarks (optional)</Label>
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)}>Cancel</Button>
            <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {approveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dispatchDialog} onOpenChange={setDispatchDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as Dispatched</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Dispatch Date</Label>
              <Input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchDialog(false)}>Cancel</Button>
            <Button onClick={() => dispatchMut.mutate()} disabled={dispatchMut.isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
              {dispatchMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Mark Dispatched
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Close Return</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Credit Note # (optional)</Label>
                <Input value={creditNoteNumber} onChange={e => setCreditNoteNumber(e.target.value)} placeholder="CN-001" />
              </div>
              <div className="space-y-1">
                <Label>Credit Note Date</Label>
                <Input type="date" value={creditNoteDate} onChange={e => setCreditNoteDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Credit Note Amount (₹)</Label>
              <Input type="number" value={creditNoteAmount} onChange={e => setCreditNoteAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Cancel</Button>
            <Button onClick={() => closeMut.mutate()} disabled={closeMut.isPending} className="bg-gray-700 hover:bg-gray-800 text-white">
              {closeMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Close Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
