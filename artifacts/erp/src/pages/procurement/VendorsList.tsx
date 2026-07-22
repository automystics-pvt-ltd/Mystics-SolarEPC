import { useState } from "react";
import { useGetVendors, useCreateVendor, useDeleteVendor, getGetVendorsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search, Building2, Phone, Mail, Shield, Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Inactive: "bg-slate-100 text-slate-600 border-slate-200",
  Blacklisted: "bg-red-50 text-red-700 border-red-200",
};

export default function VendorsList() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", status: "Active", billingCountry: "India" });
  const qc = useQueryClient();

  const { data: vendors = [], isLoading } = useGetVendors({ search: search || undefined });
  const createMut = useCreateVendor();
  const deleteMut = useDeleteVendor();

  const filtered = vendors.filter(v =>
    !search || v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.gstin?.toLowerCase().includes(search.toLowerCase()) ||
    v.primaryEmail?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    createMut.mutate({ data: form }, {
      onSuccess: (v) => { qc.invalidateQueries({ queryKey: getGetVendorsQueryKey() }); setOpen(false); setForm({ name: "", status: "Active", billingCountry: "India" }); setLocation(`/procurement/vendors/${v.id}`); }
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Master</h1>
          <p className="text-sm text-gray-500 mt-1">Manage approved vendors with GST, banking, and contact details</p>
        </div>
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
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, GSTIN, email…" className="pl-9" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Vendors", value: vendors.length },
          { label: "Active", value: vendors.filter(v => v.status === "Active").length, color: "text-emerald-600" },
          { label: "With GST", value: vendors.filter(v => v.gstin).length },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={cn("text-2xl font-bold mt-1", s.color ?? "text-slate-900")}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed border-slate-200 rounded-xl">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No vendors found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <div
                onClick={() => setLocation(`/procurement/vendors/${v.id}`)}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-orange-200 hover:shadow-sm transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900">{v.name}</span>
                    <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[v.status ?? "Active"] ?? "")}>{v.status}</Badge>
                    {v.isMsme && <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">MSME</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {v.gstin && <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {v.gstin}</span>}
                    {v.primaryEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {v.primaryEmail}</span>}
                    {v.primaryPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {v.primaryPhone}</span>}
                    {v.billingCity && <span>{v.billingCity}, {v.billingState}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">{v.code}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-400 transition-colors" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
