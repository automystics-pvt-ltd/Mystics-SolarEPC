import { useState } from "react";
import { useGetMaterials, useCreateMaterial, useGetMaterialCategories, useCreateMaterialCategory, getGetMaterialsQueryKey, getGetMaterialCategoriesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search, Package, Tag, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

const UOM_OPTIONS = ["Nos", "Pcs", "Set", "Kg", "MT", "Mtr", "Sqm", "Sqft", "Ltr", "Box", "Carton", "Bundle", "KWp", "kWh", "KW", "KVA", "Other"];

export default function MaterialsList() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"materials" | "categories">("materials");
  const [matOpen, setMatOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [matForm, setMatForm] = useState<any>({ name: "", uom: "Nos", gstRate: 18, isActive: true });
  const [catForm, setCatForm] = useState<any>({ name: "" });
  const qc = useQueryClient();

  const { data: materials = [], isLoading } = useGetMaterials({ search: search || undefined });
  const { data: categories = [] } = useGetMaterialCategories();
  const createMatMut = useCreateMaterial();
  const createCatMut = useCreateMaterialCategory();

  const filtered = materials.filter(m =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.code?.toLowerCase().includes(search.toLowerCase()) || m.hsnSacCode?.includes(search)
  );

  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  const handleCreateMat = () => {
    createMatMut.mutate({ data: matForm }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetMaterialsQueryKey() }); setMatOpen(false); setMatForm({ name: "", uom: "Nos", gstRate: 18, isActive: true }); }
    });
  };

  const handleCreateCat = () => {
    createCatMut.mutate({ data: catForm }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetMaterialCategoriesQueryKey() }); setCatOpen(false); setCatForm({ name: "" }); }
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Material Master</h1>
          <p className="text-sm text-gray-500 mt-1">Manage materials with HSN codes, UoM, pricing, and tax rates</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><Tag className="w-3.5 h-3.5" /> Add Category</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Name *</Label><Input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className="mt-1" /></div>
                <div><Label>Code</Label><Input value={catForm.code ?? ""} onChange={e => setCatForm({ ...catForm, code: e.target.value })} className="mt-1" /></div>
                <div><Label>Description</Label><Textarea value={catForm.description ?? ""} onChange={e => setCatForm({ ...catForm, description: e.target.value })} className="mt-1" /></div>
                <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCatOpen(false)}>Cancel</Button><Button onClick={handleCreateCat} disabled={!catForm.name || createCatMut.isPending}>{createCatMut.isPending ? "Creating…" : "Create"}</Button></div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={matOpen} onOpenChange={setMatOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Add Material</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader><DialogTitle>New Material</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="col-span-2"><Label>Name *</Label><Input value={matForm.name} onChange={e => setMatForm({ ...matForm, name: e.target.value })} className="mt-1" /></div>
                <div><Label>Category</Label>
                  <Select value={matForm.categoryId?.toString() ?? ""} onValueChange={v => setMatForm({ ...matForm, categoryId: Number(v) })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id!.toString()}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>UoM</Label>
                  <Select value={matForm.uom} onValueChange={v => setMatForm({ ...matForm, uom: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>HSN/SAC Code</Label><Input value={matForm.hsnSacCode ?? ""} onChange={e => setMatForm({ ...matForm, hsnSacCode: e.target.value })} placeholder="85414011" className="mt-1" /></div>
                <div><Label>GST Rate (%)</Label><Input type="number" value={matForm.gstRate} onChange={e => setMatForm({ ...matForm, gstRate: Number(e.target.value) })} className="mt-1" /></div>
                <div><Label>Base Price (₹)</Label><Input type="number" value={matForm.basePrice ?? ""} onChange={e => setMatForm({ ...matForm, basePrice: Number(e.target.value) })} className="mt-1" /></div>
                <div><Label>Brand</Label><Input value={matForm.brand ?? ""} onChange={e => setMatForm({ ...matForm, brand: e.target.value })} className="mt-1" /></div>
                <div className="col-span-2"><Label>Specifications</Label><Textarea value={matForm.specifications ?? ""} onChange={e => setMatForm({ ...matForm, specifications: e.target.value })} className="mt-1" rows={2} /></div>
                <div className="col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={() => setMatOpen(false)}>Cancel</Button><Button onClick={handleCreateMat} disabled={!matForm.name || createMatMut.isPending}>{createMatMut.isPending ? "Creating…" : "Create Material"}</Button></div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="materials">Materials ({materials.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, HSN…" className="pl-9" />
          </div>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>{["Code", "Name", "Category", "UoM", "HSN/SAC", "GST %", "Base Price", "Status"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((m, i) => (
                    <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.code}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{m.name}</p>
                        {m.brand && <p className="text-xs text-slate-400">{m.brand} {m.model}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{m.categoryId ? catMap[m.categoryId] ?? "—" : "—"}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{m.uom}</Badge></td>
                      <td className="px-4 py-3 font-mono text-xs">{m.hsnSacCode ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold">{m.gstRate}%</td>
                      <td className="px-4 py-3 font-mono">{m.basePrice ? `₹${Number(m.basePrice).toLocaleString("en-IN")}` : "—"}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={m.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500"}>{m.isActive ? "Active" : "Inactive"}</Badge></td>
                    </motion.tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-slate-400">No materials found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["Code", "Name", "Description"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.code ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{c.description ?? "—"}</td>
                  </tr>
                ))}
                {categories.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-slate-400">No categories yet</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
