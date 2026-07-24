import { Router, type IRouter } from "express";
import {
  db, procurementPOsTable, procGRNsTable, procGRNItemsTable,
  procInvoicesTable, stockLedgerTable, stockValuationTable,
  projectsTable, budgetsTable, expensesTable,
  vendorsTable, procPOItemsTable,
} from "@workspace/db";
import { desc, sql, gte, lte, and, eq } from "drizzle-orm";
import { deriveCategory } from "../lib/category-rules";

const router: IRouter = Router();

function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : 0; }

// GET /reports/procurement — PO summary by status & vendor
router.get("/reports/procurement", async (req, res): Promise<void> => {
  try {
    const pos = await db.select().from(procurementPOsTable).orderBy(desc(procurementPOsTable.createdAt));

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
    const byVendor = Object.values(vendorMap).sort((a, b) => b.value - a.value).slice(0, 10);

    // Monthly trend (last 12 months)
    const monthlyMap: Record<string, { month: string; count: number; value: number }> = {};
    pos.forEach(po => {
      const d = new Date(po.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, count: 0, value: 0 };
      monthlyMap[key].count++;
      monthlyMap[key].value += n(po.totalAmount);
    });
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

    const ACTIVE_STATUSES = ["Draft", "Submitted", "PendingApproval", "Approved", "Revised", "OnHold", "Issued", "Acknowledged", "PartiallyReceived"];
    res.json({
      summary: {
        total: pos.length,
        totalValue: pos.reduce((s, p) => s + n(p.totalAmount), 0),
        openValue: pos.filter(p => ACTIVE_STATUSES.includes(p.status as string)).reduce((s, p) => s + n(p.totalAmount), 0),
        closedValue: pos.filter(p => ["FullyReceived", "InvoiceMatched", "PaymentPending", "Paid", "Closed"].includes(p.status as string)).reduce((s, p) => s + n(p.totalAmount), 0),
      },
      byStatus: Object.entries(byStatus).map(([status, d]) => ({ status, ...d })),
      byVendor,
      monthly,
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// GET /reports/grn — GRN quality & receipt analysis
router.get("/reports/grn", async (req, res): Promise<void> => {
  try {
    const grns = await db.select().from(procGRNsTable).orderBy(desc(procGRNsTable.createdAt));
    const items = await db.select().from(procGRNItemsTable);

    const totalAccepted = items.reduce((s, i) => s + n(i.acceptedQty), 0);
    const totalRejected = items.reduce((s, i) => s + n(i.rejectedQty), 0);
    const totalReceived = items.reduce((s, i) => s + n(i.receivedQty), 0);

    const byStatus = grns.reduce((acc: Record<string, number>, g) => {
      acc[g.status] = (acc[g.status] || 0) + 1;
      return acc;
    }, {});

    // Vendor rejection rates
    const vendorRejMap: Record<string, { vendor: string; received: number; rejected: number }> = {};
    grns.forEach(g => {
      if (!vendorRejMap[g.vendorName]) vendorRejMap[g.vendorName] = { vendor: g.vendorName, received: 0, rejected: 0 };
      const gItems = items.filter(i => i.grnId === g.id);
      vendorRejMap[g.vendorName].received += gItems.reduce((s, i) => s + n(i.receivedQty), 0);
      vendorRejMap[g.vendorName].rejected += gItems.reduce((s, i) => s + n(i.rejectedQty), 0);
    });
    const vendorRejections = Object.values(vendorRejMap)
      .map(v => ({ ...v, rejectionRate: v.received > 0 ? ((v.rejected / v.received) * 100).toFixed(1) : "0.0" }))
      .sort((a, b) => Number(b.rejectionRate) - Number(a.rejectionRate)).slice(0, 10);

    res.json({
      summary: {
        totalGRNs: grns.length,
        totalReceived,
        totalAccepted,
        totalRejected,
        acceptanceRate: totalReceived > 0 ? ((totalAccepted / totalReceived) * 100).toFixed(1) : "0.0",
      },
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      vendorRejections,
      recent: grns.slice(0, 20).map(g => ({
        id: g.id, grnNumber: g.grnNumber, vendorName: g.vendorName, status: g.status,
        totalAcceptedQty: n(g.totalAcceptedQty), totalRejectedQty: n(g.totalRejectedQty),
        createdAt: g.createdAt.toISOString(),
      })),
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// GET /reports/invoices — invoice & payment summary
router.get("/reports/invoices", async (req, res): Promise<void> => {
  try {
    const invoices = await db.select().from(procInvoicesTable).orderBy(desc(procInvoicesTable.createdAt));

    const totalPayable = invoices.reduce((s, i) => s + n(i.netPayable), 0);
    const totalPaid = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + n(i.netPayable), 0);
    const totalPending = invoices.filter(i => ["PendingApproval", "Approved"].includes(i.status ?? "")).reduce((s, i) => s + n(i.netPayable), 0);

    // Aging buckets
    const now = Date.now();
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    invoices.filter(i => i.status !== "Paid").forEach(i => {
      const daysDue = i.dueDate ? Math.floor((now - new Date(i.dueDate).getTime()) / 86400000) : 0;
      if (daysDue <= 0) aging.current += n(i.netPayable);
      else if (daysDue <= 30) aging.days30 += n(i.netPayable);
      else if (daysDue <= 60) aging.days60 += n(i.netPayable);
      else if (daysDue <= 90) aging.days90 += n(i.netPayable);
      else aging.over90 += n(i.netPayable);
    });

    // Vendor payables
    const vendorMap: Record<string, { vendor: string; total: number; paid: number; pending: number }> = {};
    invoices.forEach(i => {
      if (!vendorMap[i.vendorName]) vendorMap[i.vendorName] = { vendor: i.vendorName, total: 0, paid: 0, pending: 0 };
      vendorMap[i.vendorName].total += n(i.netPayable);
      if (i.status === "Paid") vendorMap[i.vendorName].paid += n(i.netPayable);
      else vendorMap[i.vendorName].pending += n(i.netPayable);
    });
    const byVendor = Object.values(vendorMap).sort((a, b) => b.total - a.total).slice(0, 10);

    const byStatus = invoices.reduce((acc: Record<string, { count: number; value: number }>, i) => {
      const s = i.status ?? "Unknown";
      if (!acc[s]) acc[s] = { count: 0, value: 0 };
      acc[s].count++; acc[s].value += n(i.netPayable);
      return acc;
    }, {});

    res.json({
      summary: { total: invoices.length, totalPayable, totalPaid, totalPending, outstandingValue: totalPending },
      aging,
      byStatus: Object.entries(byStatus).map(([status, d]) => ({ status, ...d })),
      byVendor,
      recent: invoices.slice(0, 20).map(i => ({
        id: i.id, invoiceNumber: i.invoiceNumber, vendorName: i.vendorName,
        status: i.status, netPayable: n(i.netPayable), dueDate: i.dueDate,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// GET /reports/inventory — stock & warehouse summary
router.get("/reports/inventory", async (req, res): Promise<void> => {
  try {
    const valuation = await db.select().from(stockValuationTable);
    const ledger = await db.select().from(stockLedgerTable).orderBy(desc(stockLedgerTable.createdAt)).limit(100);

    const totalValue = valuation.reduce((s, v) => s + n(v.totalValue), 0);

    const byWarehouse: Record<number, { warehouseId: number; items: number; totalValue: number }> = {};
    valuation.forEach(v => {
      if (!byWarehouse[v.warehouseId]) byWarehouse[v.warehouseId] = { warehouseId: v.warehouseId, items: 0, totalValue: 0 };
      byWarehouse[v.warehouseId].items++;
      byWarehouse[v.warehouseId].totalValue += n(v.totalValue);
    });

    const lowStock = valuation.filter(v => n(v.balanceQty) > 0 && n(v.balanceQty) < 10)
      .map(v => ({ itemName: v.itemName, balanceQty: n(v.balanceQty), totalValue: n(v.totalValue), warehouseId: v.warehouseId }));

    const txnByType = ledger.reduce((acc: Record<string, number>, l) => {
      acc[l.txnType] = (acc[l.txnType] || 0) + 1;
      return acc;
    }, {});

    res.json({
      summary: {
        totalItems: valuation.length,
        totalValue,
        warehouses: Object.keys(byWarehouse).length,
        lowStockItems: lowStock.length,
      },
      byWarehouse: Object.values(byWarehouse),
      lowStock: lowStock.slice(0, 20),
      txnByType: Object.entries(txnByType).map(([type, count]) => ({ type, count })),
      recentMovements: ledger.slice(0, 20).map(l => ({
        id: l.id, itemName: l.itemName, txnType: l.txnType,
        qty: n(l.qty), balanceQty: n(l.balanceQty), date: l.date,
      })),
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// GET /reports/vendor-performance — vendor scorecard
router.get("/reports/vendor-performance", async (req, res): Promise<void> => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to + "T23:59:59.999Z") : null;

    // Build date conditions for each table
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
      poDateCond
        ? db.select().from(procurementPOsTable).where(poDateCond)
        : db.select().from(procurementPOsTable),
      db.select({ poId: procPOItemsTable.poId, materialName: procPOItemsTable.materialName }).from(procPOItemsTable),
      grnDateCond
        ? db.select().from(procGRNsTable).where(grnDateCond)
        : db.select().from(procGRNsTable),
      db.select().from(procGRNItemsTable),
      invoiceDateCond
        ? db.select().from(procInvoicesTable).where(invoiceDateCond)
        : db.select().from(procInvoicesTable),
    ]);

    // Derive the dominant procurement category for a set of POs
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

    // Helper: match POs to a vendor by ID or by name snapshot (when PO was
    // created without linking to a vendor record).
    function posForVendor(vendorId: number, vendorName: string) {
      return pos.filter(p =>
        (p.vendorId !== null && p.vendorId === vendorId) ||
        (p.vendorId === null && p.vendorName === vendorName),
      );
    }
    function grnsForVendor(vendorId: number, vendorName: string) {
      return grns.filter(g =>
        (g.vendorId !== null && g.vendorId === vendorId) ||
        (g.vendorId === null && g.vendorName === vendorName),
      );
    }

    // Build entries for registered vendors
    const registeredPerf = vendors.map(v => {
      const vPos     = posForVendor(v.id, v.name);
      const vGrns    = grnsForVendor(v.id, v.name);
      const vItems   = grnItems.filter(i => vGrns.some(g => g.id === i.grnId));
      const vInvoices = invoices.filter(i => i.vendorId === v.id || (i.vendorId === null && (i as any).vendorName === v.name));

      const totalReceived  = vItems.reduce((s, i) => s + n(i.receivedQty),  0);
      const totalRejected  = vItems.reduce((s, i) => s + n(i.rejectedQty),  0);
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
        acceptanceRate: acceptanceRate.toFixed(1),
        onTimeRate:     onTimeRate.toFixed(1),
        rejectionRate:  totalReceived > 0 ? ((totalRejected / totalReceived) * 100).toFixed(1) : "0.0",
        score: Math.round((acceptanceRate * 0.5) + (onTimeRate * 0.5)),
      };
    }).filter(v => v.totalPOs > 0);

    // Also surface unlinked POs (vendorId = null, name not in registered vendors)
    const registeredNames = new Set(vendors.map(v => v.name));
    const unlinkedNames = [...new Set(
      pos.filter(p => p.vendorId === null && !registeredNames.has(p.vendorName)).map(p => p.vendorName)
    )];
    const unlinkedPerf = unlinkedNames.map(vName => {
      const vPos  = pos.filter(p => p.vendorId === null && p.vendorName === vName);
      const vGrns = grns.filter(g => g.vendorId === null && g.vendorName === vName);
      const vItems = grnItems.filter(i => vGrns.some(g => g.id === i.grnId));
      // Match invoices by name when vendorId is null (unlinked invoices)
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
        acceptanceRate: acceptanceRate.toFixed(1),
        onTimeRate:     onTimeRate.toFixed(1),
        rejectionRate:  totalReceived > 0 ? ((totalRejected / totalReceived) * 100).toFixed(1) : "0.0",
        score: Math.round((acceptanceRate * 0.5) + (onTimeRate * 0.5)),
      };
    });

    const performance = [...registeredPerf, ...unlinkedPerf].sort((a, b) => b.score - a.score);
    res.json({ vendors: performance });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// GET /reports/projects — project cost & budget summary
router.get("/reports/projects", async (req, res): Promise<void> => {
  try {
    const projects = await db.select().from(projectsTable);
    const budgets = await db.select().from(budgetsTable);
    const expenses = await db.select().from(expensesTable);
    const pos = await db.select().from(procurementPOsTable);

    const summary = projects.map(p => {
      const pBudget = budgets.filter(b => b.projectId === p.id).reduce((s, b) => s + n(b.budgetedAmount), 0);
      const pExpenses = expenses.filter(e => e.projectId === p.id && e.approvalStatus === "Approved").reduce((s, e) => s + n(e.amount), 0);
      const pPOValue = pos.filter(po => po.projectId === p.id).reduce((s, po) => s + n(po.totalAmount), 0);
      const utilization = pBudget > 0 ? ((pExpenses / pBudget) * 100).toFixed(1) : "0.0";
      return {
        id: p.id, name: p.name, status: p.status,
        budget: pBudget, expenses: pExpenses, poValue: pPOValue,
        remaining: pBudget - pExpenses,
        utilization,
      };
    });

    res.json({
      summary: {
        total: projects.length,
        totalBudget: summary.reduce((s, p) => s + p.budget, 0),
        totalExpenses: summary.reduce((s, p) => s + p.expenses, 0),
        totalPOValue: summary.reduce((s, p) => s + p.poValue, 0),
      },
      projects: summary,
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
