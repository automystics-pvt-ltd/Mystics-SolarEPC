import { useGetGRNs, useGetDeliveryChallans, useGetStockLedger, useGetStockValuation, useGetInventoryAudits } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Boxes, Truck, BookOpen, Scale, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export function GRNsList() {
  const { data, isLoading } = useGetGRNs();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Goods Receipt Notes</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">Track inbound material receipts against POs.</p>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 px-5">GRN No.</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">PO Ref</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Warehouse</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Received</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 px-5">QC Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((g) => (
                  <TableRow key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                          <Boxes className="h-4 w-4" />
                        </div>
                        <span className="font-mono font-bold text-sm text-gray-900">{g.grnNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 font-mono text-sm font-bold text-gray-600">PO-{g.poId}</TableCell>
                    <TableCell className="py-4 font-mono text-sm font-bold text-gray-600">WH-{g.warehouseId}</TableCell>
                    <TableCell className="py-4 text-sm font-semibold text-gray-700">{format(new Date(g.receivedDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="px-5 py-4">
                      <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                        g.qcStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        g.qcStatus === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' : 
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {g.qcStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function DeliveryChallansList() {
  const { data, isLoading } = useGetDeliveryChallans();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Delivery Challans</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">Track outbound material dispatches.</p>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 px-5">Challan No.</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Project Ref</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Issued To</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Purpose</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 px-5">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((c) => (
                  <TableRow key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                          <Truck className="h-4 w-4" />
                        </div>
                        <span className="font-mono font-bold text-sm text-gray-900">{c.challanNumber || `DC-${c.id}`}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 font-mono text-sm font-bold text-gray-600">{c.projectId ? `PRJ-${c.projectId}` : '-'}</TableCell>
                    <TableCell className="py-4 text-sm font-bold text-gray-900">{c.issuedTo}</TableCell>
                    <TableCell className="py-4 text-xs font-semibold text-gray-600">{c.purpose}</TableCell>
                    <TableCell className="px-5 py-4 text-sm font-semibold text-gray-700">{format(new Date(c.issuedDate), 'MMM d, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function StockLedgerList() {
  const { data, isLoading } = useGetStockLedger();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Stock Ledger</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">Chronological log of inventory movements.</p>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 px-5">Date</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Item</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Warehouse</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Txn Type</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Qty</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 text-right px-5">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((l) => (
                  <TableRow key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="px-5 py-4 text-xs font-semibold text-gray-500">{l.date}</TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-bold text-sm text-gray-900 leading-tight">{l.itemName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 font-mono text-xs font-bold text-gray-600">WH-{l.warehouseId}</TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                        l.txnType === 'Inward' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {l.txnType}
                      </Badge>
                    </TableCell>
                    <TableCell className={`py-4 text-right font-mono font-bold text-[15px] ${l.txnType === 'Inward' ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {l.txnType === 'Inward' ? '+' : '-'}{l.qty}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-right font-mono font-bold text-gray-900">{l.balanceQty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function StockValuationList() {
  const { data, isLoading } = useGetStockValuation();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Stock Valuation</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">Financial value of inventory on hand.</p>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 px-5">Item</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Warehouse</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Balance Qty</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Unit Value</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Total Value</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 px-5 text-right">As Of</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((v, i) => (
                  <TableRow key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Scale className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-bold text-sm text-gray-900 leading-tight">{v.itemName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 font-mono text-xs font-bold text-gray-600">WH-{v.warehouseId}</TableCell>
                    <TableCell className="py-4 text-right font-mono font-bold text-[15px] text-gray-900">{v.balanceQty}</TableCell>
                    <TableCell className="py-4 text-right font-mono text-sm font-semibold text-gray-500">₹{v.unitValue.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="py-4 text-right font-mono font-bold text-[15px] text-[#EA580C]">₹{v.totalValue.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="px-5 py-4 text-right text-xs font-semibold text-gray-500">{format(new Date(v.asOfDate), 'MMM d, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function InventoryAuditsList() {
  const { data, isLoading } = useGetInventoryAudits();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Inventory Audits</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">Physical stock reconciliation logs.</p>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 px-5">Audit ID</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Warehouse</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Date</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500">Status</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Variance Qty</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 text-right px-5">Variance Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((a) => (
                  <TableRow key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-gray-400" />
                        <span className="font-mono font-bold text-sm text-gray-900">AUD-{a.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 font-mono text-xs font-bold text-gray-600">WH-{a.warehouseId}</TableCell>
                    <TableCell className="py-4 text-sm font-semibold text-gray-700">{format(new Date(a.auditDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                        a.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className={`py-4 text-right font-mono font-bold text-[15px] ${a.varianceQty !== 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {a.varianceQty || 0}
                    </TableCell>
                    <TableCell className={`px-5 py-4 text-right font-mono font-bold text-[15px] ${a.varianceValue !== 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      ₹{Number(a.varianceValue || 0).toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
