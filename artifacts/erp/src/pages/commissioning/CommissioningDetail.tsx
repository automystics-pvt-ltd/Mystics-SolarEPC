import { useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetCommissioningChecklist,
  useUpdateCommissioningItem,
  useSignoffCommissioningChecklist,
  useAddCommissioningItem,
  useGetComplianceDocuments,
  useCreateComplianceDocument,
  getGetCommissioningChecklistQueryKey,
  getGetComplianceDocumentsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ArrowLeft, CheckCircle2, Circle, UserCheck, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Electrical", "Safety", "NetMetering", "Civil", "Documentation"] as const;
const CAT_COLORS: Record<string, string> = {
  Electrical: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Safety: "bg-red-50 text-red-700 border-red-200",
  NetMetering: "bg-blue-50 text-blue-700 border-blue-200",
  Civil: "bg-stone-50 text-stone-700 border-stone-200",
  Documentation: "bg-purple-50 text-purple-700 border-purple-200",
};
const DOC_TYPES = ["DISCOM", "Subsidy", "NetMetering", "Inspection", "Handover", "Other"];

export default function CommissioningDetail() {
  const [, params] = useRoute("/commissioning/:id");
  const id = Number(params?.id);
  const qc = useQueryClient();
  const [signoffOpen, setSignoffOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addDocOpen, setAddDocOpen] = useState(false);

  const { data, isPending, isLoading } = useGetCommissioningChecklist(id, { query: { queryKey: getGetCommissioningChecklistQueryKey(id), enabled: !!id } });
  const cl = data as any;

  const toggleMut = useUpdateCommissioningItem();
  const signoffMut = useSignoffCommissioningChecklist();
  const addItemMut = useAddCommissioningItem();
  const createDocMut = useCreateComplianceDocument();

  const { data: compDocs = [] } = useGetComplianceDocuments(
    cl ? { projectId: cl.projectId } : undefined,
    { query: { queryKey: getGetComplianceDocumentsQueryKey(cl ? { projectId: cl.projectId } : undefined), enabled: !!cl } }
  );

  const { register: siReg, handleSubmit: siSubmit, reset: siReset } = useForm<any>();
  const { register: aiReg, handleSubmit: aiSubmit, setValue: aiSet, reset: aiReset } = useForm<any>();
  const { register: adReg, handleSubmit: adSubmit, setValue: adSet, reset: adReset } = useForm<any>();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetCommissioningChecklistQueryKey(id) });
  const invalidateDocs = () => qc.invalidateQueries({ queryKey: getGetComplianceDocumentsQueryKey(cl ? { projectId: cl.projectId } : undefined) });

  const toggle = (itemId: number, isDone: boolean) => {
    toggleMut.mutate({ itemId, data: { isDone } }, { onSuccess: invalidate });
  };

  const onSignoff = (d: any) => {
    signoffMut.mutate({ id, data: d }, { onSuccess: () => { invalidate(); setSignoffOpen(false); siReset(); } });
  };

  const onAddItem = (d: any) => {
    addItemMut.mutate({ id, data: d }, { onSuccess: () => { invalidate(); setAddItemOpen(false); aiReset(); } });
  };

  const onAddDoc = (d: any) => {
    createDocMut.mutate({ data: { ...d, projectId: cl.projectId } }, { onSuccess: () => { invalidateDocs(); setAddDocOpen(false); adReset(); } });
  };

  if (isPending) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>;
  if (!cl) return <p className="text-slate-500">Checklist not found.</p>;

  const items: any[] = cl.items ?? [];
  const total = items.length;
  const done = items.filter((i: any) => i.isDone).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const grouped = CATEGORIES.reduce<Record<string, any[]>>((acc, cat) => {
    acc[cat] = items.filter((i: any) => i.category === cat);
    return acc;
  }, {} as any);

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/commissioning">
        <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Commissioning
        </button>
      </Link>

      {/* Header */}
      <Card className="premium-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">Project #{cl.projectId}</p>
              <h1 className="text-xl font-semibold text-slate-900">Commissioning Checklist</h1>
              {cl.remarks && <p className="text-sm text-slate-500 mt-1">{cl.remarks}</p>}
            </div>
            <div className="flex gap-2">
              {cl.status !== "Completed" && (
                <Dialog open={signoffOpen} onOpenChange={setSignoffOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5" disabled={pct < 100}>
                      <UserCheck className="w-3.5 h-3.5" /> Client Sign-off
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Record Client Sign-off</DialogTitle></DialogHeader>
                    <form onSubmit={siSubmit(onSignoff)} className="space-y-4 pt-2">
                      <div><Label>Client Signatory Name</Label><Input {...siReg("clientSignatoryName")} placeholder="Full name" className="mt-1" /></div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setSignoffOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={signoffMut.isPending}>{signoffMut.isPending ? "Saving…" : "Confirm"}</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
              {cl.status === "Completed" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Completed · {cl.clientSignatoryName}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>{done}/{total} items completed</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist by category */}
      <Card className="premium-card">
        <CardHeader className="pb-0 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Checklist Items</CardTitle>
          <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><Plus className="w-3 h-3" /> Add Item</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Add Checklist Item</DialogTitle></DialogHeader>
              <form onSubmit={aiSubmit(onAddItem)} className="space-y-4 pt-2">
                <div>
                  <Label>Category</Label>
                  <Select onValueChange={v => aiSet("category", v)} defaultValue="Electrical">
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Input {...aiReg("description")} placeholder="e.g. Check earthing resistance" className="mt-1" /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={addItemMut.isPending}>{addItemMut.isPending ? "Adding…" : "Add"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {CATEGORIES.map(cat => {
            const catItems = grouped[cat];
            if (!catItems?.length) return null;
            return (
              <div key={cat}>
                <h4 className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border mb-3 ${CAT_COLORS[cat] || "bg-slate-50 text-slate-600 border-slate-200"}`}>{cat}</h4>
                <div className="space-y-2">
                  {catItems.map((item: any) => (
                    <div key={item.id} className={cn("flex items-start gap-3 p-3 rounded-lg border transition-colors", item.isDone ? "bg-emerald-50/50 border-emerald-100" : "bg-white border-slate-100 hover:border-slate-200")}>
                      <button onClick={() => toggle(item.id, !item.isDone)} className="mt-0.5 shrink-0">
                        {item.isDone ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" /> : <Circle className="w-4.5 h-4.5 text-slate-300 hover:text-slate-400" />}
                      </button>
                      <div className="flex-1">
                        <p className={cn("text-sm", item.isDone ? "text-slate-500 line-through" : "text-slate-800")}>{item.description}</p>
                        {item.doneAt && <p className="text-xs text-slate-400 mt-0.5">Done {new Date(item.doneAt).toLocaleDateString("en-IN")}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Compliance Documents */}
      <Card className="premium-card">
        <CardHeader className="pb-0 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> Compliance Documents</CardTitle>
          <Dialog open={addDocOpen} onOpenChange={setAddDocOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><Plus className="w-3 h-3" /> Add Document</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Add Compliance Document</DialogTitle></DialogHeader>
              <form onSubmit={adSubmit(onAddDoc)} className="space-y-4 pt-2">
                <div>
                  <Label>Document Type</Label>
                  <Select onValueChange={v => adSet("docType", v)} defaultValue="DISCOM">
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Title</Label><Input {...adReg("title")} placeholder="e.g. DISCOM Approval Letter" className="mt-1" /></div>
                <div><Label>File URL</Label><Input {...adReg("fileUrl")} placeholder="https://..." className="mt-1" /></div>
                <div><Label>Submission Date</Label><Input {...adReg("submissionDate")} type="date" className="mt-1" /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setAddDocOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createDocMut.isPending}>{createDocMut.isPending ? "Saving…" : "Save"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="pt-4">
          {compDocs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No compliance documents. Add DISCOM approvals, subsidy paperwork, inspection reports, etc.</p>
          ) : (
            <div className="space-y-2">
              {compDocs.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className="text-xs bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-medium">{doc.docType}</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{doc.title}</p>
                    {doc.submissionDate && <p className="text-xs text-slate-400">Submitted: {doc.submissionDate}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${doc.status === "Approved" ? "bg-emerald-50 text-emerald-700" : doc.status === "Rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{doc.status}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
