import { Router, type IRouter } from "express";
import { requireAuth, requirePermission } from "../lib/rbac";
import {
  db, procurementPOsTable, procGRNsTable, procGRNItemsTable,
  procInvoicesTable, stockLedgerTable, stockValuationTable,
  projectsTable, budgetsTable, expensesTable,
  vendorsTable, procPOItemsTable,
} from "@workspace/db";
import { desc, sql, gte, lte, and, eq } from "drizzle-orm";
import { deriveCategory } from "../lib/category-rules";

const router: IRouter = Router();
router.use(requirePermission("reports", "view"));

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : 0; }

/** Parse from/to query params → Date objects */
function parseDateRange(query: Record<string, unknown>) {
  const { from, to } = query as { from?: string; to?: string };
  const fromDate = from ? new Date(from as string) : null;
  const toDate   = to   ? new Date((to as string) + "T23:59:59.999Z") : null;
  return { fromDate, toDate };
}

// ── GET /reports/procurement ─────────────────────────────────────────────────
router.get("/reports/procurement", async (req, res): Promise<void> => {
  try {
    const { fromDate, toDate } = parseDateRange(req.query);
    const dateCond = and(
      fromDate ? gte(procurementPOsTable.createdAt, fromDate) : undefined,
      toDate   ? lte(procurementPOsTable.createdAt, toDate)   : undefined,
    );
    const pos = await (dateCond
      ? db.select().from(procurementPOsTable).where(dateCond).orderBy(desc(procurementPOsTable.createdAt))
      : db.select().from(procurementPOsTable).orderBy(desc(procurementPOsTable.createdAt))
    );

    const byStatus = pos.reduce((acc: Record<string, { count: number; value: number }>, po) => {
      const s = po.status ?? "Unknown";
      if (!acc[s]) acc[s] = { count: 0, value: 0 };
      acc[s].count++;
      acc[s].value += n(po.totalAmount);
      return acc;
    }, {});

    const vendorMap: Record<string, { vendor: string; count: number; value: number }> = {};
    pos.forEach(po => {
      const v = po.vendorName ?? "Unknown";
      if (!vendorMap[v]) vendorMap[v] = { vendor: v, count: 0, value: 0 };
      vendorMap[v].count++;
      vendorMap[v].value += n(po.totalAmount);
    });
    const byVendor = Object.values(vendorMap).sort((a, b) => b.value - a.value).slice(0, 15);

    const monthlyMap: Record<string, { month: string; count: number; value: number }> = {};
    pos.forEach(po => {
      const d = new Date(po.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, count: 0, value: 0 };
      monthlyMap[key].count++;
      monthlyMap[key].value += n(po.totalAmount);
    });
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-24);

    const ACTIVE_STATUSES = ["Draft", "Submitted", "PendingApproval", "Approved", "Revised", "OnHold", "Issued", "Acknowledged", "PartiallyReceived"];
    const CLOSED_STATUSES = ["FullyReceived", "InvoiceMatched", "PaymentPending", "Paid", "Closed"];
    res.json({
      summary: {
        total: pos.length,
        totalValue:  pos.reduce((s, p) => s + n(p.totalAmount), 0),
        openValue:   pos.filter(p => ACTIVE_STATUSES.includes(p.status as string)).reduce((s, p) => s + n(p.totalAmount), 0),
        closedValue: pos.filter(p => CLOSED_STATUSES.includes(p.status as string)).reduce((s, p) => s + n(p.totalAmount), 0),
        avgPOValue:  pos.length > 0 ? pos.reduce((s, p) => s + n(p.totalAmount), 0) / pos.length : 0,
      },
      byStatus:  Object.entries(byStatus).map(([status, d]) => ({ status, ...d })),
      byVendor,
      monthly,
    });
  } catch (e) { console.error("[reports/procurement]", e); res.status(500).json({ error: String(e) }); }
});

// ── GET /reports/grn ─────────────────────────────────────────────────────────
router.get("/reports/grn", async (req, res): Promise<void> => {
  try {
    const { fromDate, toDate } = parseDateRange(req.query);
    const dateCond = and(
      fromDate ? gte(procGRNsTable.createdAt, fromDate) : undefined,
      toDate   ? lte(procGRNsTable.createdAt, toDate)   : undefined,
    );
    const grns = await (dateCond
      ? db.select().from(procGRNsTable).where(dateCond).orderBy(desc(procGRNsTable.createdAt))
      : db.select().from(procGRNsTable).orderBy(desc(procGRNsTable.createdAt))
    );
    const items = await db.select().from(procGRNItemsTable);

    const totalAccepted = items.reduce((s, i) => s + n(i.acceptedQty), 0);
    const totalRejected = items.reduce((s, i) => s + n(i.rejectedQty), 0);
    const totalReceived = items.reduce((s, i) => s + n(i.receivedQty), 0);

    const byStatus = grns.reduce((acc: Record<string, number>, g) => {
      acc[g.status] = (acc[g.status] || 0) + 1;
      return acc;
    }, {});

    // Monthly GRN trend
    const monthlyMap: Record<string, { month: string; grns: number; accepted: number; rejected: number }> = {};
    grns.forEach(g => {
      const d = new Date(g.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, grns: 0, accepted: 0, rejected: 0 };
      monthlyMap[key].grns++;
      const gItems = items.filter(i => i.grnId === g.id);
      monthlyMap[key].accepted += gItems.reduce((s, i) => s + n(i.acceptedQty), 0);
      monthlyMap[key].rejected += gItems.reduce((s, i) => s + n(i.rejectedQty), 0);
    });
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

    const vendorRejMap: Record<string, { vendor: string; received: number; rejected: number; grns: number }> = {};
    grns.forEach(g => {
      if (!vendorRejMap[g.vendorName]) vendorRejMap[g.vendorName] = { vendor: g.vendorName, received: 0, rejected: 0, grns: 0 };
      const gItems = items.filter(i => i.grnId === g.id);
      vendorRejMap[g.vendorName].grns++;
      vendorRejMap[g.vendorName].received += gItems.reduce((s, i) => s + n(i.receivedQty), 0);
      vendorRejMap[g.vendorName].rejected += gItems.reduce((s, i) => s + n(i.rejectedQty), 0);
    });
    const vendorRejections = Object.values(vendorRejMap)
      .map(v => ({ ...v, rejectionRate: v.received > 0 ? +((v.rejected / v.received) * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.rejectionRate - a.rejectionRate).slice(0, 15);

    res.json({
      summary: {
        totalGRNs: grns.length, totalReceived, totalAccepted, totalRejected,
        acceptanceRate: totalReceived > 0 ? +((totalAccepted / totalReceived) * 100).toFixed(1) : 0,
      },
      byStatus:  Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      vendorRejections,
      monthly,
      recent: grns.slice(0, 20).map(g => ({
        id: g.id, grnNumber: g.grnNumber, vendorName: g.vendorName, status: g.status,
        totalAcceptedQty: n(g.totalAcceptedQty), totalRejectedQty: n(g.totalRejectedQty),
        createdAt: g.createdAt.toISOString(),
      })),
    });
  } catch (e) { console.error("[reports/grn]", e); res.status(500).json({ error: String(e) }); }
});

// ── GET /reports/invoices ────────────────────────────────────────────────────
router.get("/reports/invoices", async (req, res): Promise<void> => {
  try {
    const { fromDate, toDate } = parseDateRange(req.query);
    const dateCond = and(
      fromDate ? gte(procInvoicesTable.createdAt, fromDate) : undefined,
      toDate   ? lte(procInvoicesTable.createdAt, toDate)   : undefined,
    );
    const invoices = await (dateCond
      ? db.select().from(procInvoicesTable).where(dateCond).orderBy(desc(procInvoicesTable.createdAt))
      : db.select().from(procInvoicesTable).orderBy(desc(procInvoicesTable.createdAt))
    );

    const totalPayable  = invoices.reduce((s, i) => s + n(i.netPayable), 0);
    const totalPaid     = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + n(i.netPayable), 0);
    const totalPending  = invoices.filter(i => ["PendingApproval", "Approved"].includes(i.status ?? "")).reduce((s, i) => s + n(i.netPayable), 0);

    const now = Date.now();
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    invoices.filter(i => i.status !== "Paid").forEach(i => {
      const daysDue = i.dueDate ? Math.floor((now - new Date(i.dueDate).getTime()) / 86400000) : 0;
      if (daysDue <= 0)       aging.current += n(i.netPayable);
      else if (daysDue <= 30) aging.days30  += n(i.netPayable);
      else if (daysDue <= 60) aging.days60  += n(i.netPayable);
      else if (daysDue <= 90) aging.days90  += n(i.netPayable);
      else                    aging.over90  += n(i.netPayable);
    });

    // Monthly payment trend
    const monthlyMap: Record<string, { month: string; invoiced: number; paid: number }> = {};
    invoices.forEach(i => {
      const d = new Date(i.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, invoiced: 0, paid: 0 };
      monthlyMap[key].invoiced += n(i.netPayable);
      if (i.status === "Paid") monthlyMap[key].paid += n(i.netPayable);
    });
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

    const vendorMap: Record<string, { vendor: string; total: number; paid: number; pending: number; count: number }> = {};
    invoices.forEach(i => {
      if (!vendorMap[i.vendorName]) vendorMap[i.vendorName] = { vendor: i.vendorName, total: 0, paid: 0, pending: 0, count: 0 };
      vendorMap[i.vendorName].total += n(i.netPayable);
      vendorMap[i.vendorName].count++;
      if (i.status === "Paid") vendorMap[i.vendorName].paid += n(i.netPayable);
      else vendorMap[i.vendorName].pending += n(i.netPayable);
    });
    const byVendor = Object.values(vendorMap).sort((a, b) => b.total - a.total).slice(0, 15);

    const byStatus = invoices.reduce((acc: Record<string, { count: number; value: number }>, i) => {
      const s = i.status ?? "Unknown";
      if (!acc[s]) acc[s] = { count: 0, value: 0 };
      acc[s].count++; acc[s].value += n(i.netPayable);
      return acc;
    }, {});

    res.json({
      summary: { total: invoices.length, totalPayable, totalPaid, totalPending },
      aging,
      byStatus: Object.entries(byStatus).map(([status, d]) => ({ status, ...d })),
      byVendor,
      monthly,
      recent: invoices.slice(0, 20).map(i => ({
        id: i.id, invoiceNumber: i.invoiceNumber, vendorName: i.vendorName,
        status: i.status, netPayable: n(i.netPayable), dueDate: i.dueDate,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (e) { console.error("[reports/invoices]", e); res.status(500).json({ error: String(e) }); }
});

// ── GET /reports/inventory ───────────────────────────────────────────────────
router.get("/reports/inventory", async (req, res): Promise<void> => {
  try {
    const { fromDate, toDate } = parseDateRange(req.query);
    const ledgerDateCond = and(
      fromDate ? gte(stockLedgerTable.createdAt, fromDate) : undefined,
      toDate   ? lte(stockLedgerTable.createdAt, toDate)   : undefined,
    );
    const valuation = await db.select().from(stockValuationTable);
    const ledger = await (ledgerDateCond
      ? db.select().from(stockLedgerTable).where(ledgerDateCond).orderBy(desc(stockLedgerTable.createdAt)).limit(500)
      : db.select().from(stockLedgerTable).orderBy(desc(stockLedgerTable.createdAt)).limit(500)
    );

    const totalValue = valuation.reduce((s, v) => s + n(v.totalValue), 0);

    const byWarehouse: Record<number, { warehouseId: number; items: number; totalValue: number }> = {};
    valuation.forEach(v => {
      if (!byWarehouse[v.warehouseId]) byWarehouse[v.warehouseId] = { warehouseId: v.warehouseId, items: 0, totalValue: 0 };
      byWarehouse[v.warehouseId].items++;
      byWarehouse[v.warehouseId].totalValue += n(v.totalValue);
    });

    const lowStock = valuation
      .filter(v => n(v.balanceQty) >= 0 && n(v.balanceQty) < 10)
      .sort((a, b) => n(a.balanceQty) - n(b.balanceQty))
      .map(v => ({ itemName: v.itemName, balanceQty: n(v.balanceQty), totalValue: n(v.totalValue), warehouseId: v.warehouseId }));

    const txnByType = ledger.reduce((acc: Record<string, number>, l) => {
      acc[l.txnType] = (acc[l.txnType] || 0) + 1;
      return acc;
    }, {});

    // Top items by value
    const topByValue = [...valuation]
      .sort((a, b) => n(b.totalValue) - n(a.totalValue))
      .slice(0, 15)
      .map(v => ({ itemName: v.itemName, balanceQty: n(v.balanceQty), totalValue: n(v.totalValue), warehouseId: v.warehouseId }));

    res.json({
      summary: {
        totalItems: valuation.length,
        totalValue,
        warehouses: Object.keys(byWarehouse).length,
        lowStockItems: lowStock.length,
        totalTransactions: ledger.length,
      },
      byWarehouse: Object.values(byWarehouse).sort((a, b) => b.totalValue - a.totalValue),
      lowStock: lowStock.slice(0, 20),
      txnByType: Object.entries(txnByType).map(([type, count]) => ({ type, count })),
      topByValue: topByValue.slice(0, 15),
      recentMovements: ledger.slice(0, 20).map(l => ({
        id: l.id, itemName: l.itemName, txnType: l.txnType,
        qty: n(l.qty), balanceQty: n(l.balanceQty), date: l.date,
      })),
    });
  } catch (e) { console.error("[reports/inventory]", e); res.status(500).json({ error: String(e) }); }
});

// ── GET /reports/vendor-performance ─────────────────────────────────────────
router.get("/reports/vendor-performance", async (req, res): Promise<void> => {
  try {
    const { fromDate, toDate } = parseDateRange(req.query);
    const { from, to } = req.query as { from?: string; to?: string };

    const poDateCond = and(
      fromDate ? gte(procurementPOsTable.createdAt, fromDate) : undefined,
      toDate   ? lte(procurementPOsTable.createdAt, toDate)   : undefined,
    );
    const grnDateCond = and(
      fromDate ? gte(procGRNsTable.createdAt, fromDate) : undefined,
      toDate   ? lte(procGRNsTable.createdAt, toDate)   : undefined,
    );
    const invoiceDateCond = and(
      fromDate ? gte(procInvoicesTable.createdAt, fromDate) : undefined,
      toDate   ? lte(procInvoicesTable.createdAt, toDate)   : undefined,
    );

    const [vendors, pos, poItems, grns, grnItems, invoices] = await Promise.all([
      db.select().from(vendorsTable),
      poDateCond ? db.select().from(procurementPOsTable).where(poDateCond) : db.select().from(procurementPOsTable),
      db.select({ poId: procPOItemsTable.poId, materialName: procPOItemsTable.materialName }).from(procPOItemsTable),
      grnDateCond ? db.select().from(procGRNsTable).where(grnDateCond) : db.select().from(procGRNsTable),
      db.select().from(procGRNItemsTable),
      invoiceDateCond ? db.select().from(procInvoicesTable).where(invoiceDateCond) : db.select().from(procInvoicesTable),
    ]);

    function topCategoryForPOs(vPos: typeof pos): string {
      const cats: Record<string, number> = {};
      for (const po of vPos) {
        const items = poItems.filter(i => i.poId === po.id);
        for (const item of items) {
          const cat = deriveCategory(item.materialName);
          cats[cat] = (cats[cat] ?? 0) + 1;
        }
      }
      const entries = Object.entries(cats);
      if (!entries.length) return "";
      return entries.sort((a, b) => b[1] - a[1])[0][0];
    }

    function posForVendor(vendorId: number, vendorName: string) {
      return pos.filter(p => (p.vendorId !== null && p.vendorId === vendorId) || (p.vendorId === null && p.vendorName === vendorName));
    }
    function grnsForVendor(vendorId: number, vendorName: string) {
      return grns.filter(g => (g.vendorId !== null && g.vendorId === vendorId) || (g.vendorId === null && g.vendorName === vendorName));
    }

    const registeredPerf = vendors.map(v => {
      const vPos = posForVendor(v.id, v.name);
      const vGrns = grnsForVendor(v.id, v.name);
      const vItems = grnItems.filter(i => vGrns.some(g => g.id === i.grnId));
      const vInvoices = invoices.filter(i => i.vendorId === v.id || (i.vendorId === null && (i as any).vendorName === v.name));
      const totalReceived  = vItems.reduce((s, i) => s + n(i.receivedQty), 0);
      const totalRejected  = vItems.reduce((s, i) => s + n(i.rejectedQty), 0);
      const acceptanceRate = totalReceived > 0 ? ((totalReceived - totalRejected) / totalReceived) * 100 : 100;
      const totalSpend     = vPos.reduce((s, p) => s + n(p.totalAmount), 0);
      const totalInvoiceSpend = vInvoices.reduce((s, i) => s + n(i.netPayable), 0);
      const onTimeGrns = vGrns.filter(g => {
        const po = vPos.find(p => p.id === g.poId);
        if (!po?.deliveryDeadline || !g.deliveryDate) return true;
        return g.deliveryDate <= po.deliveryDeadline;
      });
      const onTimeRate = vGrns.length > 0 ? (onTimeGrns.length / vGrns.length) * 100 : 100;
      return {
        id: v.id, name: v.name, linked: true,
        category: topCategoryForPOs(vPos),
        totalPOs: vPos.length, totalGRNs: vGrns.length, totalInvoices: vInvoices.length,
        totalSpend, totalInvoiceSpend,
        acceptanceRate: +acceptanceRate.toFixed(1),
        onTimeRate:     +onTimeRate.toFixed(1),
        rejectionRate:  totalReceived > 0 ? +((totalRejected / totalReceived) * 100).toFixed(1) : 0,
        score: Math.round((acceptanceRate * 0.5) + (onTimeRate * 0.5)),
      };
    }).filter(v => v.totalPOs > 0);

    const registeredNames = new Set(vendors.map(v => v.name));
    const unlinkedNames = [...new Set(
      pos.filter(p => p.vendorId === null && !registeredNames.has(p.vendorName)).map(p => p.vendorName)
    )];
    const unlinkedPerf = unlinkedNames.map(vName => {
      const vPos  = pos.filter(p => p.vendorId === null && p.vendorName === vName);
      const vGrns = grns.filter(g => g.vendorId === null && g.vendorName === vName);
      const vItems = grnItems.filter(i => vGrns.some(g => g.id === i.grnId));
      const vInvoices = invoices.filter(i => i.vendorId === null && i.vendorName === vName);
      const totalReceived  = vItems.reduce((s, i) => s + n(i.receivedQty), 0);
      const totalRejected  = vItems.reduce((s, i) => s + n(i.rejectedQty), 0);
      const acceptanceRate = totalReceived > 0 ? ((totalReceived - totalRejected) / totalReceived) * 100 : 100;
      const totalSpend     = vPos.reduce((s, p) => s + n(p.totalAmount), 0);
      const totalInvoiceSpend = vInvoices.reduce((s, i) => s + n(i.netPayable), 0);
      const onTimeGrns = vGrns.filter(g => {
        const po = vPos.find(p => p.id === g.poId);
        if (!po?.deliveryDeadline || !g.deliveryDate) return true;
        return g.deliveryDate <= po.deliveryDeadline;
      });
      const onTimeRate = vGrns.length > 0 ? (onTimeGrns.length / vGrns.length) * 100 : 100;
      return {
        id: null, name: vName, linked: false,
        category: topCategoryForPOs(vPos),
        totalPOs: vPos.length, totalGRNs: vGrns.length, totalInvoices: vInvoices.length,
        totalSpend, totalInvoiceSpend,
        acceptanceRate: +acceptanceRate.toFixed(1),
        onTimeRate:     +onTimeRate.toFixed(1),
        rejectionRate:  totalReceived > 0 ? +((totalRejected / totalReceived) * 100).toFixed(1) : 0,
        score: Math.round((acceptanceRate * 0.5) + (onTimeRate * 0.5)),
      };
    });

    const performance = [...registeredPerf, ...unlinkedPerf].sort((a, b) => b.score - a.score);
    res.json({ vendors: performance });
  } catch (e) { console.error("[reports/vendor-performance]", e); res.status(500).json({ error: String(e) }); }
});

// ── GET /reports/projects ────────────────────────────────────────────────────
router.get("/reports/projects", async (req, res): Promise<void> => {
  try {
    const projects  = await db.select().from(projectsTable);
    const budgets   = await db.select().from(budgetsTable);
    const expenses  = await db.select().from(expensesTable);
    const pos       = await db.select().from(procurementPOsTable);

    const summary = projects.map(p => {
      const pBudget   = budgets.filter(b => b.projectId === p.id).reduce((s, b) => s + n(b.budgetedAmount), 0);
      const pExpenses = expenses.filter(e => e.projectId === p.id && e.approvalStatus === "Approved").reduce((s, e) => s + n(e.amount), 0);
      const pPOValue  = pos.filter(po => po.projectId === p.id).reduce((s, po) => s + n(po.totalAmount), 0);
      const pPOCount  = pos.filter(po => po.projectId === p.id).length;
      return {
        id: p.id, name: p.name, status: p.status,
        budget: pBudget, expenses: pExpenses, poValue: pPOValue, poCount: pPOCount,
        remaining:   pBudget - pExpenses,
        utilization: pBudget > 0 ? +((pExpenses / pBudget) * 100).toFixed(1) : 0,
      };
    });

    // By status breakdown
    const byStatus = projects.reduce((acc: Record<string, number>, p) => {
      const s = p.status ?? "Unknown";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    res.json({
      summary: {
        total:         projects.length,
        totalBudget:   summary.reduce((s, p) => s + p.budget, 0),
        totalExpenses: summary.reduce((s, p) => s + p.expenses, 0),
        totalPOValue:  summary.reduce((s, p) => s + p.poValue, 0),
      },
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      projects: summary.sort((a, b) => b.budget - a.budget),
    });
  } catch (e) { console.error("[reports/projects]", e); res.status(500).json({ error: String(e) }); }
});

export default router;
