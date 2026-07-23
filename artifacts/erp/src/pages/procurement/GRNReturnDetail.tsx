import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Truck, Lock, Send, Loader2, PackageX, Clock, Printer } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/fetch";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader, SectionCard, StatusBadge, DetailGrid, DetailRow } from "@/components/shared";
import { addRecentEntry } from "@/lib/recentHistory";

const STEPS = ["Draft", "Submitted", "Approved", "Dispatched", "Closed"];

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

  useEffect(() => {
    if (rtv?.returnNumber && user?.id) addRecentEntry(user.id, `/procurement/grn-returns/${id}`, rtv.returnNumber, "GRN Returns");
  }, [rtv?.returnNumber, id, user?.id]);

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
    <div className="p-6 text-center text-muted-foreground">
      <PackageX className="h-10 w-10 mx-auto mb-2 opacity-50" />
      <p>Return not found</p>
    </div>
  );

  const isAdmin = user?.role === "admin" || user?.role === "director";
  const currentIdx = STEPS.indexOf(rtv.status);

  const workflowActions = (
    <div className="flex gap-2 flex-wrap print:hidden">
      {rtv.status === "Draft" && (
        <Button onClick={() => setSubmitDialog(true)} size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Send className="h-3.5 w-3.5" /> Submit for Approval
        </Button>
      )}
      {rtv.status === "Submitted" && isAdmin && (
        <Button onClick={() => setApproveDialog(true)} size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </Button>
      )}
      {rtv.status === "Approved" && (
        <Button onClick={() => setDispatchDialog(true)} size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Truck className="h-3.5 w-3.5" /> Mark Dispatched
        </Button>
      )}
      {(rtv.status === "Dispatched" || rtv.status === "Approved") && isAdmin && (
        <Button onClick={() => setCloseDialog(true)} size="sm" variant="outline" className="gap-2">
          <Lock className="h-3.5 w-3.5" /> Close Return
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
        <Printer className="h-3.5 w-3.5" /> Print
      </Button>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title={rtv.returnNumber}
        subtitle={rtv.returnReason ?? "GRN Return"}
        backHref="/procurement/grn-returns"
        actions={workflowActions}
      />

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 rounded-xl border border-border bg-card shadow-sm">
        <StatusBadge status={rtv.status} />
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[12px] text-muted-foreground">GRN <span className="font-mono font-semibold text-foreground">#{rtv.grnId}</span></span>
        {rtv.poId && <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[12px] text-muted-foreground">PO <span className="font-mono font-semibold text-foreground">#{rtv.poId}</span></span>
        </>}
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[12px] text-muted-foreground">{rtv.vendorName}</span>
        {rtv.returnDate && <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[12px] text-muted-foreground">{rtv.returnDate}</span>
        </>}
      </div>

      {/* Workflow Stepper */}
      <div className="px-5 py-4 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center">
          {STEPS.map((step, i) => (
            <React.Fragment key={step}>
              <div className={cn("flex flex-col items-center gap-1",
                i < currentIdx ? "text-emerald-600 dark:text-emerald-400" : i === currentIdx ? "text-primary" : "text-muted-foreground/40"
              )}>
                <div className={cn("h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
                  i < currentIdx ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-400" :
                  i === currentIdx ? "border-primary bg-primary/10 text-primary" :
                  "border-border bg-muted/40 text-muted-foreground/40"
                )}>
                  {i < currentIdx ? "✓" : i + 1}
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap">{step}</span>
              </div>
              {i < STEPS.length - 1 && <div className={cn("flex-1 h-px mx-1",
                i < currentIdx ? "bg-emerald-400 dark:bg-emerald-700" : "bg-border/60"
              )} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Return Details */}
      <SectionCard title="Return Details">
        <DetailGrid cols={3}>
          <DetailRow label="GRN Reference" value={`#${rtv.grnId}`} mono />
          <DetailRow label="PO Reference" value={rtv.poId ? `#${rtv.poId}` : undefined} mono />
          <DetailRow label="Vendor" value={rtv.vendorName} />
          <DetailRow label="Return Type" value={rtv.returnType} />
          <DetailRow label="Return Date" value={rtv.returnDate} />
          <DetailRow label="Items Count" value={rtv.items?.length ?? 0} />
          <DetailRow label="Total Qty" value={rtv.totalReturnQty ?? 0} />
          <DetailRow label="Total Value" value={Number(rtv.totalReturnValue || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })} />
          <DetailRow label="Created By" value={rtv.createdByName} />
          {rtv.returnReason && <DetailRow label="Return Reason" value={rtv.returnReason} fullWidth />}
        </DetailGrid>
      </SectionCard>

      {/* Return Line Items */}
      <SectionCard title={`Return Line Items (${rtv.items?.length ?? 0})`} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {["#", "Material", "UOM", "Return Qty", "Unit Price", "Value", "Reason"].map(h => (
                  <th key={h} className={cn(
                    "px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em]",
                    h === "#" || h === "UOM" || h === "Return Qty" ? "text-center" : h === "Unit Price" || h === "Value" ? "text-right" : "text-left"
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(rtv.items ?? []).map((item: any) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground text-xs text-center">{item.lineNo}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{item.materialName}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{item.uom}</td>
                  <td className="px-4 py-3 text-center font-semibold">{item.returnQty}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {Number(item.unitPrice || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {Number(item.returnValue || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{item.rejectionReason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Credit Note */}
      {rtv.creditNoteNumber && (
        <SectionCard title="Credit Note">
          <DetailGrid cols={3}>
            <DetailRow label="Credit Note #" value={rtv.creditNoteNumber} mono />
            <DetailRow label="Date" value={rtv.creditNoteDate} />
            <DetailRow label="Amount" value={Number(rtv.creditNoteAmount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })} />
          </DetailGrid>
        </SectionCard>
      )}

      {/* Dispatch Details */}
      {rtv.status === "Dispatched" && rtv.dispatchDate && (
        <SectionCard title="Dispatch Details">
          <DetailGrid cols={3}>
            <DetailRow label="Dispatch Date" value={rtv.dispatchDate} />
            {rtv.vehicleNumber && <DetailRow label="Vehicle Number" value={rtv.vehicleNumber} mono />}
            {rtv.dispatchRemarks && <DetailRow label="Notes" value={rtv.dispatchRemarks} fullWidth />}
          </DetailGrid>
        </SectionCard>
      )}

      {/* Audit Trail */}
      {rtv.auditLogs?.length > 0 && (
        <SectionCard title="Audit Trail">
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
                    <span className="text-sm font-semibold text-foreground">{log.action}</span>
                    {log.performedByName && (
                      <span className="text-xs text-muted-foreground">by {log.performedByName}</span>
                    )}
                  </div>
                  {log.remarks && <p className="text-xs text-muted-foreground mt-0.5">{log.remarks}</p>}
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Dialogs */}
      <Dialog open={submitDialog} onOpenChange={setSubmitDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit for Approval</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Are you sure you want to submit this return for approval?</p>
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
            <Button onClick={() => dispatchMut.mutate()} disabled={dispatchMut.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
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
            <Button onClick={() => closeMut.mutate()} disabled={closeMut.isPending} className="bg-foreground hover:bg-foreground/90 text-background">
              {closeMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Close Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
