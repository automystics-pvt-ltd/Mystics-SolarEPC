import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetDesignDocuments, useCreateDesignDocument } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDesignDocumentsQueryKey } from "@workspace/api-client-react";
import { FileText, Plus, CheckCircle2, Clock, XCircle, AlertCircle, Layers } from "lucide-react";
import { motion } from "framer-motion";

const DOC_TYPES = ["Layout", "SLD", "Structural", "Other"] as const;

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Draft: { label: "Draft", color: "bg-slate-100 text-slate-700", icon: <Clock className="w-3 h-3" /> },
  InternalApproved: { label: "Internal Approved", color: "bg-blue-50 text-blue-700", icon: <CheckCircle2 className="w-3 h-3" /> },
  ClientApproved: { label: "Client Approved", color: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 className="w-3 h-3" /> },
  Rejected: { label: "Rejected", color: "bg-red-50 text-red-700", icon: <XCircle className="w-3 h-3" /> },
};

const docTypeIcon: Record<string, string> = {
  Layout: "🏗️",
  SLD: "⚡",
  Structural: "🔩",
  Other: "📄",
};

export default function DesignDocsList() {
  const [open, setOpen] = useState(false);
  const [projectIdFilter, setProjectIdFilter] = useState("");
  const qc = useQueryClient();

  const queryParams = projectIdFilter ? { projectId: Number(projectIdFilter) } : undefined;
  const { data: docs = [], isLoading } = useGetDesignDocuments(queryParams);
  const createMut = useCreateDesignDocument();

  const { register, handleSubmit, setValue, reset } = useForm<any>();

  const onSubmit = (d: any) => {
    createMut.mutate({ data: { ...d, projectId: Number(d.projectId) } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDesignDocumentsQueryKey() });
        setOpen(false);
        reset();
      },
    });
  };

  const grouped = docs.reduce<Record<string, typeof docs>>((acc, doc) => {
    acc[doc.docType] = [...(acc[doc.docType] ?? []), doc];
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Engineering & Design</h1>
          <p className="text-sm text-slate-500 mt-0.5">Layout drawings, SLDs, structural documents, and revision history</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Filter by Project ID"
            className="w-44 h-8 text-sm"
            value={projectIdFilter}
            onChange={e => setProjectIdFilter(e.target.value)}
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Design Document</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <div>
                  <Label>Project ID</Label>
                  <Input {...register("projectId")} placeholder="e.g. 4" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Document Type</Label>
                    <Select onValueChange={v => setValue("docType", v)} defaultValue="Layout">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Version</Label>
                    <Input {...register("version")} placeholder="v1" defaultValue="v1" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input {...register("title")} placeholder="e.g. Rooftop Layout — Block A" className="mt-1" />
                </div>
                <div>
                  <Label>File URL</Label>
                  <Input {...register("fileUrl")} placeholder="https://..." className="mt-1" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea {...register("description")} placeholder="Brief notes..." className="mt-1 min-h-[80px]" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending ? "Uploading…" : "Upload"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Documents", value: docs.length, color: "text-slate-900" },
          { label: "Client Approved", value: docs.filter(d => d.internalStatus === "ClientApproved").length, color: "text-emerald-600" },
          { label: "Pending Approval", value: docs.filter(d => d.internalStatus === "Draft" || d.internalStatus === "InternalApproved").length, color: "text-amber-600" },
          { label: "Rejected", value: docs.filter(d => d.internalStatus === "Rejected").length, color: "text-red-600" },
        ].map((s, i) => (
          <Card key={i} className="premium-card">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Doc type groups */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>
      ) : docs.length === 0 ? (
        <Card className="premium-card">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Layers className="w-10 h-10 text-slate-300" />
            <p className="text-slate-500 font-medium">No design documents yet</p>
            <p className="text-slate-400 text-sm">Upload layout drawings, SLDs, and structural documents</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {DOC_TYPES.filter(t => grouped[t]?.length).map(type => (
            <div key={type}>
              <h3 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                <span>{docTypeIcon[type]}</span> {type} <span className="text-slate-400">({grouped[type]?.length ?? 0})</span>
              </h3>
              <div className="space-y-2">
                {(grouped[type] ?? []).map((doc, i) => {
                  const s = statusConfig[doc.internalStatus] ?? statusConfig["Draft"];
                  return (
                    <motion.div key={doc.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <Link href={`/engineering/docs/${doc.id}`}>
                        <Card className="premium-card hover:shadow-md transition-shadow cursor-pointer">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">
                              {docTypeIcon[doc.docType]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
                              <p className="text-xs text-slate-400 mt-0.5">Project #{doc.projectId} · {doc.version} · {new Date(doc.createdAt!).toLocaleDateString("en-IN")}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
                              {s.icon} {s.label}
                            </span>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
