import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/fetch";
import { motion } from "framer-motion";
import { SectionCard, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileText, Upload, Download, Trash2, Loader2, Plus,
  Clock, Filter, FolderOpen, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ProjectDocument {
  id: number; projectId: number; documentType: string;
  title: string; version: string; fileUrl: string;
  fileSizeBytes: number | null; mimeType: string | null;
  uploadedBy: number | null; uploadedAt: string;
  phase: string | null; isCurrentVersion: boolean;
  previousVersionId: number | null; tags: string[];
  description: string | null; createdAt: string;
}

const DOC_TYPES = ["Drawing","Specification","Permit","Contract","Report","Certificate","Photo","Other"] as const;
const PHASES = ["SiteSurvey","Planning","BOQ","Procurement","Installation","QualityInspection","TestingCommissioning","Handover","Warranty","Closure"];

const TYPE_COLORS: Record<string, string> = {
  Drawing: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  Specification: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300",
  Permit: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  Contract: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300",
  Report: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
  Certificate: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  Photo: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300",
  Other: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
};

function fmtBytes(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function DocCard({
  doc, allDocs, onDelete, onViewHistory,
}: {
  doc: ProjectDocument;
  allDocs: ProjectDocument[];
  onDelete: (id: number) => void;
  onViewHistory: (docs: ProjectDocument[]) => void;
}) {
  const versions = [doc, ...allDocs.filter(d => !d.isCurrentVersion && d.title === doc.title)];
  const hasHistory = versions.length > 1;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 hover:border-primary/40 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground truncate">{doc.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", TYPE_COLORS[doc.documentType] ?? TYPE_COLORS.Other)}>
                {doc.documentType}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono">{doc.version}</span>
              {doc.phase && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{doc.phase}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {doc.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
      )}

      {doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {doc.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <p>{format(new Date(doc.uploadedAt), "MMM d, yyyy")}</p>
          {doc.fileSizeBytes && <p>{fmtBytes(doc.fileSizeBytes)}</p>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasHistory && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Version history" onClick={() => onViewHistory(versions)}>
              <Clock className="h-3.5 w-3.5" />
            </Button>
          )}
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </a>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" title="Delete"
            onClick={() => { if (confirm("Delete this document?")) onDelete(doc.id); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProjectDocuments({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [phaseFilter, setPhaseFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyDocs, setHistoryDocs] = useState<ProjectDocument[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    documentType: "Other", version: "v1", tags: [],
  });
  const [tagInput, setTagInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: allDocs = [], isPending } = useQuery<ProjectDocument[]>({
    queryKey: ["project-documents", projectId, phaseFilter, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (phaseFilter !== "All") params.set("phase", phaseFilter);
      if (typeFilter !== "All") params.set("documentType", typeFilter);
      return apiGet(`/projects/${projectId}/documents?${params}`);
    },
    enabled: !!projectId,
  });

  // Show only current versions in the grid; history drawer shows all
  const currentDocs = allDocs.filter(d => d.isCurrentVersion);

  const uploadMut = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/documents`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      setUploadOpen(false);
      setForm({ documentType: "Other", version: "v1", tags: [] });
      toast.success("Document uploaded");
    },
    onError: () => toast.error("Failed to save document"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/documents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-documents", projectId] }); toast.success("Document deleted"); },
    onError: () => toast.error("Failed to delete document"),
  });

  const handleUpload = async () => {
    if (!form.title || !form.fileUrl) {
      toast.error("Title and file URL are required");
      return;
    }
    uploadMut.mutate({ ...form });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm((f: any) => ({ ...f, tags: [...(f.tags ?? []), tagInput.trim()] }));
    setTagInput("");
  };

  // Simulate file upload: in real usage client POSTs to object storage and gets back a URL.
  // For now we ask for a URL directly (same pattern as quotation attachments).

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <SectionCard
        title="Project Documents"
        isLoading={isPending}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="h-7 w-36 text-xs">
                <Filter className="h-3 w-3 mr-1.5" /><SelectValue placeholder="Phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Phases</SelectItem>
                {PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Types</SelectItem>
                {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3 w-3" /> Upload Document
            </Button>
          </div>
        }
      >
        {currentDocs.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents uploaded"
            description="Upload drawings, permits, certificates, and reports for this project."
            size="sm"
            action={{ label: "Upload Document", onClick: () => setUploadOpen(true) }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {currentDocs.map(doc => (
              <DocCard
                key={doc.id}
                doc={doc}
                allDocs={allDocs}
                onDelete={id => deleteMut.mutate(id)}
                onViewHistory={docs => setHistoryDocs(docs)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Upload Sheet */}
      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle>Upload Document</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Title *</Label>
              <Input className="h-9" placeholder="e.g. As-Built Single Line Diagram" value={form.title ?? ""} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Document Type</Label>
                <Select value={form.documentType ?? "Other"} onValueChange={v => setForm((f: any) => ({ ...f, documentType: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Version</Label>
                <Input className="h-9" placeholder="v1" value={form.version ?? "v1"} onChange={e => setForm((f: any) => ({ ...f, version: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Phase</Label>
              <Select value={form.phase ?? "none"} onValueChange={v => setForm((f: any) => ({ ...f, phase: v === "none" ? null : v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select phase…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">File URL *</Label>
              <Input className="h-9" placeholder="https://…" value={form.fileUrl ?? ""} onChange={e => setForm((f: any) => ({ ...f, fileUrl: e.target.value }))} />
              <p className="text-[10px] text-muted-foreground mt-1">Upload to object storage first, then paste the URL here.</p>
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">File Size (bytes)</Label>
              <Input type="number" className="h-9" placeholder="optional" value={form.fileSizeBytes ?? ""} onChange={e => setForm((f: any) => ({ ...f, fileSizeBytes: Number(e.target.value) || null }))} />
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Description</Label>
              <Textarea className="resize-none h-16" value={form.description ?? ""} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Tags</Label>
              <div className="flex gap-2 mb-2">
                <Input className="h-8 text-xs flex-1" placeholder="Add tag…" value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={addTag}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(form.tags ?? []).map((t: string, i: number) => (
                  <Badge key={i} variant="secondary" className="gap-1 text-xs">
                    {t}
                    <button onClick={() => setForm((f: any) => ({ ...f, tags: f.tags.filter((_: string, idx: number) => idx !== i) }))}>×</button>
                  </Badge>
                ))}
              </div>
            </div>
            <Button className="w-full h-10" onClick={handleUpload} disabled={uploadMut.isPending}>
              {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-2" />Upload Document</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Version History Dialog */}
      <Dialog open={!!historyDocs} onOpenChange={() => setHistoryDocs(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Version History — {historyDocs?.[0]?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {historyDocs?.map(doc => (
              <div key={doc.id} className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                doc.isCurrentVersion ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border/60"
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{doc.version}</span>
                    {doc.isCurrentVersion && <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">Current</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(doc.uploadedAt), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
