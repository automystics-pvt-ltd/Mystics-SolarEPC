import { useState } from "react";
import { useRoute } from "wouter";
import {
  useGetDesignDocument,
  useApproveDesignDocument,
  useAddDesignRevision,
  getGetDesignDocumentQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, XCircle, History, ExternalLink, FileUp } from "lucide-react";
import { Link } from "wouter";

const statusConfig: Record<string, { label: string; className: string }> = {
  Draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  InternalApproved: { label: "Internal Approved", className: "bg-blue-50 text-blue-700" },
  ClientApproved: { label: "Client Approved", className: "bg-emerald-50 text-emerald-700" },
  Rejected: { label: "Rejected", className: "bg-red-50 text-red-700" },
};

export default function DesignDocDetail() {
  const [, params] = useRoute("/engineering/docs/:id");
  const id = Number(params?.id);
  const qc = useQueryClient();
  const [revOpen, setRevOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  const { data: doc, isPending } = useGetDesignDocument(id, { query: { queryKey: getGetDesignDocumentQueryKey(id), enabled: !!id } });
  const approveMut = useApproveDesignDocument();
  const revMut = useAddDesignRevision();
  const { register: revReg, handleSubmit: revSubmit, reset: revReset } = useForm<any>();
  const { register: appReg, handleSubmit: appSubmit, reset: appReset } = useForm<any>();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetDesignDocumentQueryKey(id) });

  const onApprove = (d: any) => {
    approveMut.mutate({ id, data: d }, { onSuccess: () => { invalidate(); setApproveOpen(false); appReset(); } });
  };

  const onRevision = (d: any) => {
    revMut.mutate({ id, data: d }, { onSuccess: () => { invalidate(); setRevOpen(false); revReset(); } });
  };

  if (isPending) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>;
  if (!doc) return <p className="text-slate-500">Document not found.</p>;

  const s = statusConfig[doc.internalStatus] ?? statusConfig["Draft"];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link href="/engineering/docs">
        <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Design Documents
        </button>
      </Link>

      {/* Header card */}
      <Card className="premium-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">{doc.version}</span>
                <span className="text-xs text-slate-400">{doc.docType}</span>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mt-2">{doc.title}</h1>
              {doc.description && <p className="text-sm text-slate-500 mt-1">{doc.description}</p>}
              <p className="text-xs text-slate-400 mt-2">Project #{doc.projectId} · Uploaded {new Date(doc.createdAt!).toLocaleDateString("en-IN")}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {doc.fileUrl && (
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> View File
                  </Button>
                </a>
              )}
              <Dialog open={revOpen} onOpenChange={setRevOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <FileUp className="w-3.5 h-3.5" /> New Revision
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Add Revision</DialogTitle></DialogHeader>
                  <form onSubmit={revSubmit(onRevision)} className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Version</Label><Input {...revReg("version")} placeholder="v2" className="mt-1" /></div>
                      <div><Label>File URL</Label><Input {...revReg("fileUrl")} placeholder="https://..." className="mt-1" /></div>
                    </div>
                    <div><Label>Change Notes</Label><Textarea {...revReg("changeNotes")} placeholder="What changed in this revision?" className="mt-1 min-h-[80px]" /></div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setRevOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={revMut.isPending}>{revMut.isPending ? "Saving…" : "Save Revision"}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              {doc.internalStatus === "Draft" && (
                <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Approve Document</DialogTitle></DialogHeader>
                    <form onSubmit={appSubmit(onApprove)} className="space-y-4 pt-2">
                      <div>
                        <Label>Approval Type</Label>
                        <select {...appReg("approvalType")} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                          <option value="internal">Internal Approval</option>
                          <option value="client">Client Approval</option>
                        </select>
                      </div>
                      <div><Label>Approved By</Label><Input {...appReg("approvedBy")} placeholder="Name or user ID" className="mt-1" /></div>
                      <div><Label>Rejection Reason (leave blank to approve)</Label><Input {...appReg("rejectionReason")} placeholder="Optional — fill to reject" className="mt-1" /></div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={approveMut.isPending}>{approveMut.isPending ? "Saving…" : "Submit"}</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* Approval timeline */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${doc.internalApprovedAt ? "bg-blue-100" : "bg-slate-100"}`}>
                <CheckCircle2 className={`w-4 h-4 ${doc.internalApprovedAt ? "text-blue-600" : "text-slate-400"}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700">Internal Sign-off</p>
                <p className="text-xs text-slate-400">{doc.internalApprovedAt ? new Date(doc.internalApprovedAt).toLocaleDateString("en-IN") : "Pending"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${doc.clientApprovedAt ? "bg-emerald-100" : "bg-slate-100"}`}>
                <CheckCircle2 className={`w-4 h-4 ${doc.clientApprovedAt ? "text-emerald-600" : "text-slate-400"}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700">Client Sign-off</p>
                <p className="text-xs text-slate-400">{doc.clientApprovedAt ? `${new Date(doc.clientApprovedAt).toLocaleDateString("en-IN")} · ${doc.clientApprovedBy ?? ""}` : "Pending"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revision history */}
      <Card className="premium-card">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><History className="w-4 h-4 text-slate-400" /> Revision History</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {(doc as any).revisions?.length ? (
            <div className="space-y-3">
              {(doc as any).revisions.map((rev: any) => (
                <div key={rev.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className="font-mono text-xs bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">{rev.version}</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{rev.changeNotes || "No notes"}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(rev.createdAt).toLocaleDateString("en-IN")}</p>
                  </div>
                  {rev.fileUrl && (
                    <a href={rev.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No revisions yet. Add a revision when designs are updated.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
