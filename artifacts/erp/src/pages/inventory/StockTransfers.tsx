import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, ArrowRightLeft, ChevronDown, ChevronRight,
  CheckCircle2, Loader2, Trash2, PackageX,
} from "lucide-react";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/shared";
import { cn } from "@/lib/utils";

const STATUS_TABS = ["All", "Draft", "Approved", "InTransit", "Completed", "Cancelled"];
const STATUS_COLOR: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  InTransit: "bg-blue-50 text-blue-700 border-blue-200",
  Completed: "bg-gray-100 text-gray-600 border-gray-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

type TransferItem = { materialName: string; uom: string; qty: string; fromBin: string; toBin: string };

export default function StockTransfers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newDialog, setNewDialog] = useState(false);
  const [completeDateDialog, setCompleteDateDialog] = useState<{ id: number } | null>(null);
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().slice(0, 10));

  // Form state
  const [fromWH, setFromWH] = useState("");
  const [toWH, setToWH] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<TransferItem[]>([{ materialName: "", uom: "Nos", qty: "", fromBin: "", toBin: "" }]);

  const { data: transfers = [], isPending } = useQuery({
    queryKey: ["stock-transfers", tab],
    queryFn: () => apiGet<any[]>("/stock-transfers", tab !== "All" ? { status: tab } : {}),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiGet<any[]>("/warehouses"),
    retry: false,
  });

  const filtered = (transfers as any[]).filter(t =>
    !search ||
    t.transferNumber?.toLowerCase().includes(search.toLowerCase()) ||
    t.fromWarehouseName?.toLowerCase().includes(search.toLowerCase()) ||
    t.toWarehouseName?.toLowerCase().includes(search.toLowerCase())
  );

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost("/stock-transfers", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      toast({ title: "Transfer created", description: "Stock transfer created successfully" });
      setNewDialog(false);
      setFromWH(""); setToWH(""); setReason(""); setItems([{ materialName: "", uom: "Nos", qty: "", fromBin: "", toBin: "" }]);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => apiPatch(`/stock-transfers/${id}/approve`, { userId: user?.id, userName: user?.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock-transfers"] }); toast({ title: "Approved" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const completeMut = useMutation({
    mutationFn: ({ id }: { id: number }) => apiPatch(`/stock-transfers/${id}/complete`, { userId: user?.id, userName: user?.name, completedDate }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock-transfers"] }); toast({ title: "Completed", description: "Transfer completed & stock updated" }); setCompleteDateDialog(null); },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => apiPatch(`/stock-transfers/${id}/cancel`, { userId: user?.id, userName: user?.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock-transfers"] }); toast({ title: "Cancelled" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const addItem = () => setItems(prev => [...prev, { materialName: "", uom: "Nos", qty: "", fromBin: "", toBin: "" }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof TransferItem, val: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const handleCreate = () => {
    if (!fromWH || !toWH) { toast({ variant: "destructive", title: "Required", description: "Both warehouses required" }); return; }
    if (fromWH === toWH) { toast({ variant: "destructive", title: "Error", description: "Source and destination must differ" }); return; }
    const validItems = items.filter(i => i.materialName.trim() && Number(i.qty) > 0);
    if (validItems.length === 0) { toast({ variant: "destructive", title: "Required", description: "At least one item with qty > 0" }); return; }

    const fromWarehouse = (warehouses as any[]).find(w => w.id === Number(fromWH) || w.name === fromWH);
    const toWarehouse = (warehouses as any[]).find(w => w.id === Number(toWH) || w.name === toWH);

    createMut.mutate({
      fromWarehouseId: fromWarehouse?.id || fromWH,
      toWarehouseId: toWarehouse?.id || toWH,
      reason, transferDate,
      items: validItems.map((item, idx) => ({
        lineNo: idx + 1, materialName: item.materialName, uom: item.uom,
        qty: Number(item.qty), fromBin: item.fromBin, toBin: item.toBin,
      })),
      userId: user?.id, userName: user?.name,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Transfers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Inter-warehouse material transfers</p>
        </div>
        <Button onClick={() => setNewDialog(true)} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow-sm">
          <Plus className="h-4 w-4" /> New Transfer
        </Button>
      </div>

      <Card className="border-gray-200/60 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-9">
              {STATUS_TABS.map(s => (
                <TabsTrigger key={s} value={s} className="text-xs font-medium">{s}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transfers..." className="pl-9 h-9 text-sm" />
            </div>
            <ExportButton
              config={{
                title: "Stock Transfers",
                module: "inventory",
                filename: "Inventory_StockTransfers",
                columns: [
                  { header: "Transfer #",    key: "transferNumber"   },
                  { header: "From",          key: "fromWarehouseName"},
                  { header: "To",            key: "toWarehouseName"  },
                  { header: "Items",         key: "totalItems"       },
                  { header: "Status",        key: "status"           },
                  { header: "Transfer Date", key: "transferDate"     },
                  { header: "Initiated By",  key: "initiatedByName"  },
                ],
                getRows: () => filtered as unknown as Record<string, unknown>[],
              }}
              size="sm"
              className="h-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="w-8" />
                {["Transfer #", "From Warehouse", "To Warehouse", "Items", "Status", "Transfer Date", "Initiated By"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={9} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <ArrowRightLeft className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">No stock transfers found</p>
                  </td>
                </tr>
              ) : filtered.map((t, i) => (
                <>
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-gray-50 hover:bg-orange-50/20 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  >
                    <td className="px-3 py-3">
                      {expandedId === t.id
                        ? <ChevronDown className="h-4 w-4 text-gray-400" />
                        : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-orange-600 text-xs">{t.transferNumber}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{t.fromWarehouseName}</td>
                    <td className="px-4 py-3 text-gray-700">{t.toWarehouseName}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="text-xs">{t.totalItems ?? 0}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("text-xs font-semibold", STATUS_COLOR[t.status] ?? "")}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.transferDate || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.initiatedByName || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {t.status === "Draft" && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => approveMut.mutate(t.id)}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => cancelMut.mutate(t.id)}>
                              Cancel
                            </Button>
                          </>
                        )}
                        {["Approved", "InTransit"].includes(t.status) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-blue-700 border-blue-200 hover:bg-blue-50"
                            onClick={() => setCompleteDateDialog({ id: t.id })}>
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                  <AnimatePresence>
                    {expandedId === t.id && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <td colSpan={9} className="bg-gray-50/50 px-8 py-4 border-b border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</p>
                          {t.items && t.items.length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400 uppercase tracking-wide">
                                  <th className="text-left py-1">#</th>
                                  <th className="text-left py-1">Material</th>
                                  <th className="text-center py-1">UOM</th>
                                  <th className="text-center py-1">Qty</th>
                                  <th className="text-left py-1">From Bin</th>
                                  <th className="text-left py-1">To Bin</th>
                                </tr>
                              </thead>
                              <tbody>
                                {t.items.map((item: any) => (
                                  <tr key={item.id} className="border-t border-gray-100">
                                    <td className="py-1.5 text-gray-400">{item.lineNo}</td>
                                    <td className="py-1.5 font-medium text-gray-800">{item.materialName}</td>
                                    <td className="py-1.5 text-center text-gray-500">{item.uom}</td>
                                    <td className="py-1.5 text-center font-semibold">{item.qty}</td>
                                    <td className="py-1.5 text-gray-500">{item.fromBin || "—"}</td>
                                    <td className="py-1.5 text-gray-500">{item.toBin || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : <p className="text-gray-400">No items loaded</p>}
                          {t.reason && <p className="text-xs text-gray-500 mt-3"><span className="font-semibold">Reason:</span> {t.reason}</p>}
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Transfer Dialog */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>From Warehouse <span className="text-red-500">*</span></Label>
                {(warehouses as any[]).length > 0 ? (
                  <Select value={fromWH} onValueChange={setFromWH}>
                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      {(warehouses as any[]).map(w => (
                        <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={fromWH} onChange={e => setFromWH(e.target.value)} placeholder="From warehouse name" />
                )}
              </div>
              <div className="space-y-1">
                <Label>To Warehouse <span className="text-red-500">*</span></Label>
                {(warehouses as any[]).length > 0 ? (
                  <Select value={toWH} onValueChange={setToWH}>
                    <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                    <SelectContent>
                      {(warehouses as any[]).filter(w => String(w.id) !== fromWH).map(w => (
                        <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={toWH} onChange={e => setToWH(e.target.value)} placeholder="To warehouse name" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Transfer Date</Label>
                <Input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Transfer reason" />
              </div>
            </div>

            <Separator />
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Items</p>
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1 h-7 text-xs">
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Input
                        value={item.materialName}
                        onChange={e => updateItem(i, "materialName", e.target.value)}
                        placeholder="Material name"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={item.uom}
                        onChange={e => updateItem(i, "uom", e.target.value)}
                        placeholder="UOM"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.qty}
                        onChange={e => updateItem(i, "qty", e.target.value)}
                        placeholder="Qty"
                        className="h-8 text-xs text-center"
                      />
                    </div>
                    <div className="col-span-1">
                      <Input value={item.fromBin} onChange={e => updateItem(i, "fromBin", e.target.value)} placeholder="Bin" className="h-8 text-xs" />
                    </div>
                    <div className="col-span-2">
                      <Input value={item.toBin} onChange={e => updateItem(i, "toBin", e.target.value)} placeholder="To Bin" className="h-8 text-xs" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {items.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeItem(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Date Dialog */}
      <Dialog open={!!completeDateDialog} onOpenChange={() => setCompleteDateDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Transfer Complete</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">This will update stock levels in both warehouses.</p>
            <div className="space-y-1">
              <Label>Completion Date</Label>
              <Input type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDateDialog(null)}>Cancel</Button>
            <Button onClick={() => completeDateDialog && completeMut.mutate({ id: completeDateDialog.id })}
              disabled={completeMut.isPending} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              {completeMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Complete Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
