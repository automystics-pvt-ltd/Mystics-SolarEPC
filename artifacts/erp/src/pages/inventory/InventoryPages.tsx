import { useGetGRNs, useGetDeliveryChallans, useGetStockLedger, useGetStockValuation, useGetInventoryAudits } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export function GRNsList() {
  const { data, isLoading } = useGetGRNs();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Goods Receipt Notes (GRN)</h2>
        <p className="text-muted-foreground mt-1">Track inbound material receipts against POs.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>GRN No.</TableHead>
                  <TableHead>PO Ref</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>QC Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium font-mono">{g.grnNumber}</TableCell>
                    <TableCell>PO-{g.poId}</TableCell>
                    <TableCell>WH-{g.warehouseId}</TableCell>
                    <TableCell>{format(new Date(g.receivedDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={g.qcStatus === 'Approved' ? 'default' : g.qcStatus === 'Rejected' ? 'destructive' : 'secondary'}>
                        {g.qcStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DeliveryChallansList() {
  const { data, isLoading } = useGetDeliveryChallans();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Delivery Challans</h2>
        <p className="text-muted-foreground mt-1">Track outbound material dispatches.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Challan No.</TableHead>
                  <TableHead>Project Ref</TableHead>
                  <TableHead>Issued To</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium font-mono">{c.challanNumber || `DC-${c.id}`}</TableCell>
                    <TableCell>{c.projectId ? `PRJ-${c.projectId}` : '-'}</TableCell>
                    <TableCell>{c.issuedTo}</TableCell>
                    <TableCell>{c.purpose}</TableCell>
                    <TableCell>{format(new Date(c.issuedDate), 'MMM d, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StockLedgerList() {
  const { data, isLoading } = useGetStockLedger();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Stock Ledger</h2>
        <p className="text-muted-foreground mt-1">Chronological log of inventory movements.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Txn Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-muted-foreground">{l.date}</TableCell>
                    <TableCell className="font-medium">{l.itemName}</TableCell>
                    <TableCell>WH-{l.warehouseId}</TableCell>
                    <TableCell>
                      <Badge variant={l.txnType === 'Inward' ? 'default' : 'outline'} className={l.txnType === 'Inward' ? 'bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30' : ''}>
                        {l.txnType}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${l.txnType === 'Inward' ? 'text-emerald-600' : 'text-destructive'}`}>
                      {l.txnType === 'Inward' ? '+' : '-'}{l.qty}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{l.balanceQty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StockValuationList() {
  const { data, isLoading } = useGetStockValuation();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Stock Valuation</h2>
        <p className="text-muted-foreground mt-1">Financial value of inventory on hand.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Balance Qty</TableHead>
                  <TableHead className="text-right">Unit Value</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>As Of</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{v.itemName}</TableCell>
                    <TableCell>WH-{v.warehouseId}</TableCell>
                    <TableCell className="text-right">{v.balanceQty}</TableCell>
                    <TableCell className="text-right">${v.unitValue.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-primary">${v.totalValue.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(v.asOfDate), 'MMM d, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function InventoryAuditsList() {
  const { data, isLoading } = useGetInventoryAudits();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Inventory Audits</h2>
        <p className="text-muted-foreground mt-1">Physical stock reconciliation logs.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Audit ID</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Variance Qty</TableHead>
                  <TableHead className="text-right">Variance Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium font-mono">AUD-{a.id}</TableCell>
                    <TableCell>WH-{a.warehouseId}</TableCell>
                    <TableCell>{format(new Date(a.auditDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'Completed' ? 'default' : 'secondary'}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className={`text-right ${a.varianceQty !== 0 ? 'text-destructive font-bold' : ''}`}>
                      {a.varianceQty || 0}
                    </TableCell>
                    <TableCell className={`text-right ${a.varianceValue !== 0 ? 'text-destructive font-bold' : ''}`}>
                      ${a.varianceValue?.toLocaleString() || 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
