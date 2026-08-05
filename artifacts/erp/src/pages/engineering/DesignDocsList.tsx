import { useState } from "react";
import { useLocation } from "wouter";
import { useGetDesignDocuments, useCreateDesignDocument } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDesignDocumentsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/components/ui/use-toast";
import { FileText, Plus, CheckCircle2, Clock, XCircle, Layers } from "lucide-react";
import { motion } from "framer-motion";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader, StatCard, DataTable, StatusBadge } from "@/components/shared";

const DOC_TYPES = ["Layout", "SLD", "Structural", "Other"] as const;

const docTypeIcon: Record<string, string> = {
  Layout: "🏗️",
  SLD: "⚡",
  Structural: "🔩",
  Other: "📄",
};

const STATUS_OPTIONS = [
  { label: "Draft", value: "Draft" },
  { label: "Internal Approved", value: "InternalApproved" },
  { label: "Client Approved", value: "ClientApproved" },
  { label: "Rejected", value: "Rejected" },
];

const DOC_TYPE_OPTIONS = DOC_TYPES.map(t => ({ label: t, value: t }));

type DesignDoc = {
  id: number;
  title: string;
  projectId: number;
  docType: string;
  internalStatus: string;
  version?: string | null;
  uploadedBy?: number | null;
  createdAt?: string | null;
};

export default function DesignDocsList() {
  const [open, setOpen] = useState(false);
  const [projectIdFilter, setProjectIdFilter] = useState("");
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const queryParams = projectIdFilter ? { projectId: Number(projectIdFilter) } : undefined;
  const { data: docs = [], isPending } = useGetDesignDocuments(queryParams);
  const createMut = useCreateDesignDocument();

  const { register, handleSubmit, setValue, reset } = useForm<any>();

  const onSubmit = (d: any) => {
    createMut.mutate({ data: { ...d, projectId: Number(d.projectId) } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDesignDocumentsQueryKey() });
        toast({ title: "Design document created" });
        setOpen(false);
        reset();
      },
      onError: (e: any) => toast({ variant: "destructive", title: "Failed to create document", description: e?.message }),
    });
  };

  const columns: ColumnDef<DesignDoc, any>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <span className="text-lg shrink-0">{docTypeIcon[row.original.docType] ?? "📄"}</span>
          <span className="font-semibold text-sm text-foreground leading-tight">{row.original.title}</span>
        </div>
      ),
    },
    {
      accessorKey: "projectId",
      header: "Project",
      meta: { responsive: "sm" } as any,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground font-mono">
          #{row.original.projectId}
        </span>
      ),
    },
    {
      accessorKey: "docType",
      header: "Document Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-muted/50 text-muted-foreground border-border">
          {row.original.docType}
        </Badge>
      ),
    },
    {
      accessorKey: "internalStatus",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.internalStatus} size="sm" />
      ),
    },
    {
      accessorKey: "version",
      header: "Version",
      meta: { responsive: "md" } as any,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground font-mono">
          {row.original.version || "v1"}
        </span>
      ),
    },
    {
      accessorKey: "uploadedBy",
      header: "Uploaded By",
      meta: { responsive: "lg" } as any,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.uploadedBy ? `User #${row.original.uploadedBy}` : "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      meta: { responsive: "md" } as any,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString("en-IN")
            : "—"}
        </span>
      ),
    },
  ];

  const uploadDialog = (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> Upload Document
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Upload Design Document" maxWidth="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div>
            <Label>Project ID</Label>
            <Input {...register("projectId")} placeholder="e.g. 4" className="mt-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </ResponsiveDialog>
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Design Documents"
        subtitle="Engineering drawings, SLDs, and technical documentation"
        actions={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by Project ID"
              className="w-44 h-8 text-sm"
              value={projectIdFilter}
              onChange={e => setProjectIdFilter(e.target.value)}
            />
            {uploadDialog}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Documents"
          value={docs.length}
          icon={FileText}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Client Approved"
          value={docs.filter(d => d.internalStatus === "ClientApproved").length}
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Pending Approval"
          value={docs.filter(d => d.internalStatus === "Draft" || d.internalStatus === "InternalApproved").length}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Rejected"
          value={docs.filter(d => d.internalStatus === "Rejected").length}
          icon={XCircle}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
      </div>

      <DataTable
        data={docs as DesignDoc[]}
        columns={columns}
        loading={isPending}
        searchPlaceholder="Search documents..."
        onRowClick={(row) => setLocation(`/engineering/docs/${row.id}`)}
        exportFilename="design-documents"
        filterOptions={[
          { key: "docType", label: "Type", options: DOC_TYPE_OPTIONS },
          { key: "internalStatus", label: "Status", options: STATUS_OPTIONS },
        ]}
        emptyIcon={Layers}
        emptyTitle="No design documents yet"
        emptyDescription="Upload layout drawings, SLDs, and structural documents"
      />
    </motion.div>
  );
}
