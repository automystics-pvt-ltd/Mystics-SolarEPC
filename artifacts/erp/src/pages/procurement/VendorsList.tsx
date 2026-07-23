import { useState } from "react";
import { useGetVendors, useCreateVendor, getGetVendorsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Building2 } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
  { label: "Blacklisted", value: "Blacklisted" },
];

export default function VendorsList() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", status: "Active", billingCountry: "India" });
  const qc = useQueryClient();

  const { data: vendors = [], isLoading } = useGetVendors({});
  const createMut = useCreateVendor();

  const handleCreate = () => {
    createMut.mutate({ data: form }, {
      onSuccess: (v) => {
        qc.invalidateQueries({ queryKey: getGetVendorsQueryKey() });
        setOpen(false);
        setForm({ name: "", status: "Active", billingCountry: "India" });
        setLocation(`/procurement/vendors/${v.id}`);
      }
    });
  };

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-sm text-foreground">{row.original.name}</p>
          {row.original.tradeName && (
            <p className="text-xs text-muted-foreground">{row.original.tradeName}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "gstin",
      header: "Category / GSTIN",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground font-mono">
          {row.original.gstin ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "contactPerson",
      header: "Contact Person",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.contactPerson ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "primaryPhone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.primaryPhone ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "primaryEmail",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.primaryEmail ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={row.original.status ?? "Active"} size="sm" />
          {row.original.isMsme && (
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">MSME</Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Vendors"
        subtitle="Approved supplier and contractor registry"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Add Vendor</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>New Vendor</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Vendor Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Waaree Energies Ltd" className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Trade Name</Label><Input value={form.tradeName ?? ""} onChange={e => setForm({ ...form, tradeName: e.target.value })} className="mt-1" /></div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>GSTIN</Label><Input value={form.gstin ?? ""} onChange={e => setForm({ ...form, gstin: e.target.value })} placeholder="27AABCU9603R1ZX" className="mt-1" /></div>
                  <div><Label>PAN</Label><Input value={form.pan ?? ""} onChange={e => setForm({ ...form, pan: e.target.value })} placeholder="AABCU9603R" className="mt-1" /></div>
                </div>
                <div><Label>Primary Email</Label><Input type="email" value={form.primaryEmail ?? ""} onChange={e => setForm({ ...form, primaryEmail: e.target.value })} className="mt-1" /></div>
                <div><Label>Primary Phone</Label><Input value={form.primaryPhone ?? ""} onChange={e => setForm({ ...form, primaryPhone: e.target.value })} className="mt-1" /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={!form.name || createMut.isPending}>{createMut.isPending ? "Creating…" : "Create & Open"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <DataTable
        data={vendors as any[]}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search by name, GSTIN, email…"
        onRowClick={(row) => setLocation(`/procurement/vendors/${row.id}`)}
        exportFilename="vendors"
        filterOptions={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        emptyIcon={Building2}
        emptyTitle="No vendors found"
        emptyDescription="Add vendors to start raising purchase orders"
      />
    </motion.div>
  );
}
