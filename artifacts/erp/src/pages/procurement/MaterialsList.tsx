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
import { Plus, Package, Tag } from "lucide-react";
import { PageHeader, DataTable, SectionCard } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

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

  const materialColumns: ColumnDef<any, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-sm text-foreground">{row.original.name}</p>
          {row.original.brand && (
            <p className="text-xs text-muted-foreground">{row.original.brand} {row.original.model}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.code ?? "—"}</span>
      ),
    },
    {
      accessorKey: "categoryId",
      header: "Category",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.categoryId ? catMap[row.original.categoryId] ?? "—" : "—"}
        </span>
      ),
    },
    {
      accessorKey: "uom",
      header: "Unit",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">{row.original.uom}</Badge>
      ),
    },
    {
      accessorKey: "hsnSacCode",
      header: "HSN Code",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.hsnSacCode ?? "—"}</span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Materials Catalogue"
        subtitle="Master list of materials and components"
        actions={
          <>
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
          </>
        }
      />

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="materials">Materials ({materials.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="mt-4">
          <DataTable
            data={materials as any[]}
            columns={materialColumns}
            loading={isLoading}
            searchPlaceholder="Search by name, code, HSN…"
            exportFilename="materials-catalogue"
            emptyIcon={Package}
            emptyTitle="No materials found"
            emptyDescription="Add materials to the catalogue to use them in purchase orders"
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <SectionCard noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border/60">
                  <tr>
                    {["Code", "Name", "Description"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {categories.map(c => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.code ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">{c.description ?? "—"}</td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-muted-foreground">No categories yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
