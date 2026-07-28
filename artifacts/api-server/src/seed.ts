/**
 * Solar EPC — Comprehensive production-realistic seed
 *
 * Represents Automystics Technologies Pvt Ltd (Solar EPC contractor)
 * running three live projects with a complete procurement chain:
 *   Lead → Quotation → Client PO → Project
 *   → Material Request → Proc Quotation → PO → GRN → Invoice → Stock Ledger
 *
 * Run:  pnpm --filter @workspace/api-server exec tsx src/seed.ts
 */

import {
  db,
  usersTable, leadsTable, quotationsTable, clientPOsTable,
  projectsTable, activitiesTable, budgetsTable, paymentMilestonesTable,
  expensesTable, dprsTable, contractorsTable, warehousesTable,
  escalationsTable, tasksTable, materialRequestsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const q = (sql: string, params: unknown[] = []) => client.query(sql, params);

/* ══════════════════════════════════════════════════════════════════════════
   CLEAR  — truncate all tables in dependency order (children first)
══════════════════════════════════════════════════════════════════════════ */
async function truncateAll() {
  await q(`TRUNCATE
    invoice_payments,
    proc_invoice_items, proc_invoices,
    grn_return_audit_logs, grn_return_items, grn_returns,
    proc_grn_audit_logs, proc_grn_items, proc_grns,
    po_comments, po_versions, proc_po_audit_logs, proc_po_items, procurement_pos,
    quotation_audit_logs, quotation_attachments, quotation_versions,
    proc_quotation_items, procurement_quotations,
    material_suppliers, materials, material_categories,
    vendor_contacts, vendors,
    reorder_alerts, material_audit_logs, stock_ledger,
    material_stock_levels, stock_transfer_items, stock_transfers,
    warehouse_locations,
    snag_logs, inspection_checklists, testing_commissioning,
    commissioning_items, commissioning_checklists,
    design_revisions, design_documents,
    project_site_surveys, project_risk_register, project_closure,
    project_handover, project_warranty, project_boq_items,
    project_material_allocations, project_milestones, project_phases,
    project_documents, project_inspections,
    change_requests, compliance_documents, resource_allocations,
    inventory_audit_items, inventory_audits,
    maintenance_schedules, service_tickets, amc_contracts,
    approval_actions, approval_request_steps, approval_requests,
    approval_workflow_steps, approval_workflows, approval_delegates,
    notifications, crm_invoices, role_permissions,
    dprs, expenses, payment_milestones, budgets, activities,
    material_requests, escalations, tasks,
    projects, client_pos, quotations, leads,
    contractors, warehouses, users
  RESTART IDENTITY CASCADE`);
}

/* ══════════════════════════════════════════════════════════════════════════
   SEED
══════════════════════════════════════════════════════════════════════════ */
async function seed() {
  await client.connect();
  console.log("🔌 Connected. Truncating all tables...");
  await truncateAll();
  console.log("✅ All tables cleared.\n");

  /* ── 1. USERS ─────────────────────────────────────────────────────────── */
  const [admin] = await db.insert(usersTable).values({ name: "Arjun Kapoor",   email: "admin@automystics.com",   passwordHash: "admin123", role: "admin"     }).returning();
  const [salesUser] = await db.insert(usersTable).values({ name: "Meera Nair",    email: "meera@automystics.com",   passwordHash: "sales123", role: "sales"     }).returning();
  const [pmUser]    = await db.insert(usersTable).values({ name: "Vikram Rathod", email: "vikram@automystics.com",  passwordHash: "pm123",    role: "pm"        }).returning();
  const [whUser]    = await db.insert(usersTable).values({ name: "Santosh Pawar", email: "santosh@automystics.com", passwordHash: "wh123",    role: "warehouse" }).returning();
  console.log("✅ Users:", admin.id, salesUser.id, pmUser.id, whUser.id);

  /* ── 2. LEADS ─────────────────────────────────────────────────────────── */
  const [lead1] = await db.insert(leadsTable).values({
    source: "IndiaMART", ownerId: salesUser.id, territory: "Gujarat",
    companyName: "NTPC Renewable Energy Ltd",
    contactName: "Suresh Agarwal", contactPhone: "+91-9810001234",
    contactEmail: "s.agarwal@ntpcrenewable.com",
    productInterest: "2 MW Ground Mount Solar EPC — Rajkot site",
    estimatedValue: "12500000", score: 88, status: "Qualified",
    notes: "LOA received. Site survey completed. Turnkey EPC. BOQ under final review.",
  }).returning();
  const [lead2] = await db.insert(leadsTable).values({
    source: "Referral", ownerId: salesUser.id, territory: "Maharashtra",
    companyName: "Torrent Power Ltd",
    contactName: "Priya Desai", contactPhone: "+91-9823456789",
    contactEmail: "p.desai@torrentpower.com",
    productInterest: "500 kW Rooftop Solar EPC — Chakan Industrial Estate",
    estimatedValue: "3800000", score: 79, status: "Proposal",
    notes: "Technical specs shared. Client sign-off pending. Net metering application to be filed.",
  }).returning();
  const [lead3] = await db.insert(leadsTable).values({
    source: "Tender", ownerId: salesUser.id, territory: "Rajasthan",
    companyName: "Solar Energy Corporation of India (SECI)",
    contactName: "Ramesh Sharma", contactPhone: "+91-9811223344",
    contactEmail: "r.sharma@seci.co.in",
    productInterest: "5 MW Solar Farm EPC — Jaisalmer",
    estimatedValue: "29000000", score: 72, status: "Negotiation",
    notes: "SECI Tender TN-2026-047. Technical bid qualified. Price bid due 15-Aug-2026.",
  }).returning();
  const [lead4] = await db.insert(leadsTable).values({
    source: "Website", ownerId: salesUser.id, territory: "Karnataka",
    companyName: "Adani Ports & SEZ Ltd",
    contactName: "Kiran Bhat", contactPhone: "+91-9900112233",
    contactEmail: "k.bhat@adaniports.com",
    productInterest: "1.5 MW Captive Solar — Mundra Port facility",
    estimatedValue: "9200000", score: 65, status: "Contacted",
    notes: "Initial meeting done. Awaiting NOC from Mundra Port Authority.",
  }).returning();
  const [lead5] = await db.insert(leadsTable).values({
    source: "Card-scan", ownerId: salesUser.id, territory: "Maharashtra",
    companyName: "Maharashtra State Power Generation Company",
    contactName: "Dilip Kulkarni", contactPhone: "+91-9812399000",
    contactEmail: "d.kulkarni@mahagenco.in",
    productInterest: "HT Panel & Transformer supply 11kV — 3 units",
    estimatedValue: "4500000", score: 55, status: "New",
    notes: "Met at Elecrama 2026. Follow-up call scheduled for next week.",
  }).returning();
  console.log("✅ Leads:", lead1.id, lead2.id, lead3.id, lead4.id, lead5.id);

  /* ── 3. CRM QUOTATIONS ────────────────────────────────────────────────── */
  const boq1 = [
    { description: "Waaree Bifacial 550Wp Mono PERC Module", qty: 4000, unit: "Nos", unitPrice: 14500, amount: 58000000 },
    { description: "SMA Sunny Central 630CP-XT Central Inverter", qty: 4, unit: "Nos", unitPrice: 840000, amount: 3360000 },
    { description: "GI Pile-Foundation Mounting Structure", qty: 4000, unit: "Set", unitPrice: 3200, amount: 12800000 },
    { description: "DC Solar Cable 4mm² H1Z2Z2-K", qty: 28000, unit: "Mtr", unitPrice: 38, amount: 1064000 },
    { description: "11kV/415V DTR 1250 kVA (ONAN)", qty: 2, unit: "Nos", unitPrice: 1250000, amount: 2500000 },
    { description: "Civil, Foundation, Erection & Commissioning", qty: 1, unit: "Lot", unitPrice: 3500000, amount: 3500000 },
  ];
  const [quot1] = await db.insert(quotationsTable).values({
    leadId: lead1.id, boqItems: boq1, version: 1, markupPct: "16",
    totalAmount: "81224000", approvalStatus: "Approved", validTill: "2026-10-31",
    notes: "Turnkey 2 MW. CAPEX ₹4.06 Cr/MWp. Includes 10-year O&M. 25-year module warranty (Waaree).",
  }).returning();

  const boq2 = [
    { description: "Waaree 500Wp Mono PERC Rooftop Module", qty: 1000, unit: "Nos", unitPrice: 13800, amount: 13800000 },
    { description: "SMA Sunny Tripower 25000TL-30 String Inverter", qty: 6, unit: "Nos", unitPrice: 178000, amount: 1068000 },
    { description: "Aluminium Rail Rooftop Mounting System", qty: 1200, unit: "Mtr", unitPrice: 850, amount: 1020000 },
    { description: "AC/DC Cables, ACDB, Protection & Safety Gear", qty: 1, unit: "Lot", unitPrice: 480000, amount: 480000 },
    { description: "Erection, Testing, Commissioning & DISCOM Sync", qty: 1, unit: "Lot", unitPrice: 620000, amount: 620000 },
  ];
  const [quot2] = await db.insert(quotationsTable).values({
    leadId: lead2.id, boqItems: boq2, version: 2, markupPct: "14",
    totalAmount: "16988000", approvalStatus: "Approved", validTill: "2026-09-15",
    notes: "Net metering connection facilitation included. 5-year AMC. MSEDCL approval support.",
  }).returning();
  console.log("✅ CRM Quotations:", quot1.id, quot2.id);

  /* ── 4. PROJECTS & CLIENT POs ─────────────────────────────────────────── */
  const [proj1] = await db.insert(projectsTable).values({
    name: "2 MW Ground Mount Solar — Rajkot, Gujarat",
    siteLocation: "Survey No. 142, Shapar-Veraval Road, Rajkot, Gujarat 360024",
    pmOwnerId: pmUser.id, startDate: "2026-03-01", plannedEnd: "2026-09-30",
    status: "Active", contractValue: "12500000", percentComplete: 45,
  }).returning();
  const [cpo1] = await db.insert(clientPOsTable).values({
    quotationId: quot1.id, clientPoNumber: "NTPC-RE-PO-2026-0412",
    contractValue: "12500000",
    paymentTerms: "20% advance on PO issuance, 30% on equipment delivery, 30% on mechanical completion, 20% on COD",
    status: "Active", projectId: proj1.id,
  }).returning();
  await db.update(projectsTable).set({ clientPoId: cpo1.id }).where(eq(projectsTable.id, proj1.id));

  const [proj2] = await db.insert(projectsTable).values({
    name: "500 kW Rooftop Solar — Chakan Industrial Estate, Pune",
    siteLocation: "Plot D-14, Chakan Industrial Estate, Pune, Maharashtra 410501",
    pmOwnerId: pmUser.id, startDate: "2026-01-15", plannedEnd: "2026-07-31",
    status: "Active", contractValue: "3800000", percentComplete: 78,
  }).returning();
  const [cpo2] = await db.insert(clientPOsTable).values({
    quotationId: quot2.id, clientPoNumber: "TPL-PO-2026-0089",
    contractValue: "3800000",
    paymentTerms: "25% advance, 50% on material delivery at site, 25% on commissioning",
    status: "Active", projectId: proj2.id,
  }).returning();
  await db.update(projectsTable).set({ clientPoId: cpo2.id }).where(eq(projectsTable.id, proj2.id));

  const [proj3] = await db.insert(projectsTable).values({
    name: "5 MW Solar Farm — Jaisalmer, Rajasthan",
    siteLocation: "Khasra No. 88/1, Sam Road, Jaisalmer, Rajasthan 345001",
    pmOwnerId: pmUser.id, startDate: "2026-09-01", plannedEnd: "2027-04-30",
    status: "Planning", contractValue: "29000000", percentComplete: 8,
  }).returning();
  console.log("✅ Projects:", proj1.id, proj2.id, proj3.id);

  /* ── 5. PROJECT ACTIVITIES (Proj 1 — WBS schedule) ───────────────────── */
  const acts = [
    { wbsCode: "1.0", name: "Design & Engineering",              plannedStart: "2026-03-01", plannedEnd: "2026-03-31", actualStart: "2026-03-01", actualEnd: "2026-03-28", percentComplete: 100, status: "Completed" },
    { wbsCode: "2.1", name: "Civil — Land Development & Fencing", plannedStart: "2026-04-01", plannedEnd: "2026-04-25", actualStart: "2026-04-01", actualEnd: "2026-04-24", percentComplete: 100, status: "Completed" },
    { wbsCode: "2.2", name: "Civil — Pile Foundation",            plannedStart: "2026-04-20", plannedEnd: "2026-05-31", actualStart: "2026-04-20", percentComplete: 80,  status: "InProgress" },
    { wbsCode: "3.1", name: "Module Mounting Structure Erection", plannedStart: "2026-05-15", plannedEnd: "2026-07-15", percentComplete: 35,  status: "InProgress" },
    { wbsCode: "3.2", name: "Module Installation & DC Wiring",    plannedStart: "2026-06-15", plannedEnd: "2026-08-15", percentComplete: 10,  status: "InProgress" },
    { wbsCode: "4.1", name: "Inverter & Transformer Installation", plannedStart: "2026-07-01", plannedEnd: "2026-08-31", percentComplete: 0,   status: "NotStarted" },
    { wbsCode: "5.1", name: "Commissioning, Testing & SCADA",     plannedStart: "2026-08-15", plannedEnd: "2026-09-25", percentComplete: 0,   status: "NotStarted" },
    { wbsCode: "6.0", name: "DISCOM Synchronisation & COD",       plannedStart: "2026-09-20", plannedEnd: "2026-09-30", percentComplete: 0,   status: "NotStarted" },
  ];
  for (const a of acts) await db.insert(activitiesTable).values({ projectId: proj1.id, ...a, dependencyIds: [] });

  /* ── 6. BUDGETS (Proj 1) ─────────────────────────────────────────────── */
  const budgetLines = [
    { costHead: "Solar Modules",                  budgetedAmount: "5800000",  committedAmount: "5800000",  actualAmount: "2900000" },
    { costHead: "Inverters & Power Electronics",  budgetedAmount: "1350000",  committedAmount: "1350000",  actualAmount: "1350000" },
    { costHead: "Mounting Structures",            budgetedAmount: "1280000",  committedAmount: "1280000",  actualAmount: "640000"  },
    { costHead: "Cables & Electrical BOS",        budgetedAmount: "950000",   committedAmount: "820000",   actualAmount: "0"       },
    { costHead: "Civil & Foundation",             budgetedAmount: "1400000",  committedAmount: "1350000",  actualAmount: "1050000" },
    { costHead: "Transformer & HT Interconnect",  budgetedAmount: "750000",   committedAmount: "700000",   actualAmount: "0"       },
    { costHead: "Engineering, PMC & Overheads",   budgetedAmount: "480000",   committedAmount: "480000",   actualAmount: "290000"  },
  ];
  for (const b of budgetLines) await db.insert(budgetsTable).values({ projectId: proj1.id, ...b, revisionNo: 0 });

  /* ── 7. PAYMENT MILESTONES (Proj 1) ──────────────────────────────────── */
  await db.insert(paymentMilestonesTable).values([
    { projectId: proj1.id, milestoneName: "Mobilisation Advance",   triggerCondition: "On PO issuance & bank guarantee submission",     amount: "2500000",  dueDate: "2026-03-15", status: "Paid"      },
    { projectId: proj1.id, milestoneName: "Equipment Supply",        triggerCondition: "Modules & inverters delivered — GRN accepted",   amount: "3750000",  dueDate: "2026-06-15", status: "Triggered" },
    { projectId: proj1.id, milestoneName: "Mechanical Completion",   triggerCondition: "All modules mounted & cabled — QC sign-off",     amount: "3750000",  dueDate: "2026-08-31", status: "Pending"   },
    { projectId: proj1.id, milestoneName: "COD & Handover",          triggerCondition: "Commissioning report & DISCOM sync certificate", amount: "2500000",  dueDate: "2026-09-30", status: "Pending"   },
  ]);

  /* ── 8. DPRs (last 7 days, Proj 1) ──────────────────────────────────── */
  const today = new Date();
  const dprData = [
    { pct: 38, summary: "Pile boring: 12 piles complete. MMS erection started on Row A." },
    { pct: 40, summary: "40 mounting frames installed. DC cable tray laying started." },
    { pct: 41, summary: "Row A: 120 modules installed. Concrete curing Rows D–F." },
    { pct: 42, summary: "Row B erection in progress. Inverter room civil foundation." },
    { pct: 43, summary: "DC cable trays complete to inverter room. 160 modules installed total." },
    { pct: 44, summary: "Row B modules 60%. Earthing conductor laying for inverter room." },
    { pct: 45, summary: "Inverter room structure complete. 220 modules installed. DC wiring in progress." },
  ];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const idx = 6 - i;
    await db.insert(dprsTable).values({
      projectId: proj1.id, reportDate: d.toISOString().split("T")[0],
      submittedBy: pmUser.id, workSummary: dprData[idx].summary,
      manpowerCount: 14 + (idx % 5), weather: idx % 3 === 0 ? "Partly Cloudy" : "Clear & Sunny",
      percentComplete: dprData[idx].pct, photos: [],
    });
  }

  /* ── 9. EXPENSES ─────────────────────────────────────────────────────── */
  await db.insert(expensesTable).values([
    { projectId: proj1.id, category: "Travel & Accommodation", amount: "28500",  incurredBy: pmUser.id, date: "2026-05-10", approvalStatus: "Approved", notes: "Site visit Rajkot — PM + site engineer, 4 nights" },
    { projectId: proj1.id, category: "Subcontractor",          amount: "480000", incurredBy: pmUser.id, date: "2026-05-31", approvalStatus: "Approved", notes: "Bondada Engineering — pile foundation advance payment" },
    { projectId: proj1.id, category: "Material (Misc)",        amount: "67200",  incurredBy: pmUser.id, date: "2026-06-18", approvalStatus: "Pending",  notes: "PPE kits, safety gear & consumables for 20-person team" },
    { projectId: proj2.id, category: "Travel & Accommodation", amount: "8400",   incurredBy: pmUser.id, date: "2026-04-22", approvalStatus: "Approved", notes: "Site visits Chakan — PM, 3 trips" },
    { projectId: proj2.id, category: "Subcontractor",          amount: "195000", incurredBy: pmUser.id, date: "2026-05-15", approvalStatus: "Approved", notes: "Rooftop civil & waterproofing subcontractor payment" },
  ]);

  /* ── 10. MATERIAL REQUESTS ───────────────────────────────────────────── */
  const [mr1] = await db.insert(materialRequestsTable).values({
    projectId: proj1.id, raisedBy: pmUser.id, mrNumber: "MR-2026-001",
    items: [{ itemName: "Waaree Bifacial 550Wp Mono PERC Module", qty: 4000, unit: "Nos", specifications: "Bifacial, 550Wp, MBB, IEC 61215 certified, Tier-1" }],
    requiredByDate: "2026-05-15", status: "POGenerated",
  }).returning();
  const [mr2] = await db.insert(materialRequestsTable).values({
    projectId: proj2.id, raisedBy: pmUser.id, mrNumber: "MR-2026-002",
    items: [{ itemName: "SMA Sunny Tripower 25000TL-30 String Inverter", qty: 6, unit: "Nos", specifications: "25 kW, 3-Phase, IP65, 10-year warranty" }],
    requiredByDate: "2026-03-01", status: "POGenerated",
  }).returning();
  const [mr3] = await db.insert(materialRequestsTable).values({
    projectId: proj1.id, raisedBy: pmUser.id, mrNumber: "MR-2026-003",
    items: [
      { itemName: "DC Solar Cable 4mm² H1Z2Z2-K", qty: 28000, unit: "Mtr", specifications: "1.5kV DC, UV-resistant, TÜV certified" },
      { itemName: "AC XLPE Cable 4C×25mm² SWA",  qty: 1200,  unit: "Mtr", specifications: "1.1kV, armoured, 90°C" },
    ],
    requiredByDate: "2026-06-01", status: "POGenerated",
  }).returning();
  const [mr4] = await db.insert(materialRequestsTable).values({
    projectId: proj3.id, raisedBy: pmUser.id, mrNumber: "MR-2026-004",
    items: [{ itemName: "Waaree Bifacial 550Wp Module", qty: 9500, unit: "Nos", specifications: "Same spec as MR-2026-001" }],
    requiredByDate: "2026-10-01", status: "Open",
  }).returning();
  console.log("✅ Material Requests:", mr1.id, mr2.id, mr3.id, mr4.id);

  /* ── 11. ESCALATIONS ─────────────────────────────────────────────────── */
  await db.insert(escalationsTable).values([
    { sourceEntityType: "project", sourceEntityId: proj1.id, projectId: proj1.id, module: "project", raisedBy: pmUser.id,
      reason: "Pile boring contractor (Bondada Engineering) behind schedule by 6 days — rock formation at Survey No. 142/3 requires additional rock-cutting equipment.", severity: "High", assignedTo: admin.id, status: "InProgress" },
    { sourceEntityType: "project", sourceEntityId: proj2.id, projectId: proj2.id, module: "project", raisedBy: pmUser.id,
      reason: "MSEDCL net metering approval delayed — application filed 10-Feb-2026, no response after 90+ days. Formal escalation to MSEDCL SE office required.", severity: "Medium", assignedTo: admin.id, status: "Pending" },
    { sourceEntityType: "lead",    sourceEntityId: lead3.id, module: "crm", raisedBy: salesUser.id,
      reason: "SECI price bid deadline 15-Aug-2026. Civil cost revision with Bondada Engineering pending — risk of missing bid.", severity: "Critical", assignedTo: admin.id, status: "InProgress" },
  ]);

  /* ── 12. TASKS ───────────────────────────────────────────────────────── */
  await db.insert(tasksTable).values([
    { sourceModule: "project", sourceRefId: proj1.id, title: "Confirm Lot 2 dispatch date with Waaree — 2000 modules balance on PO-2026-0001", ownerId: pmUser.id,    priority: "Critical", dueDate: "2026-08-05", status: "InProgress" },
    { sourceModule: "project", sourceRefId: proj2.id, title: "Submit MSEDCL net metering follow-up letter — ref AMR-PUNE-2026-0192",          ownerId: pmUser.id,    priority: "High",     dueDate: "2026-07-30", status: "Open"       },
    { sourceModule: "crm",     sourceRefId: lead3.id, title: "Revise civil cost estimate for SECI 5 MW tender before price bid deadline",     ownerId: salesUser.id, priority: "Critical", dueDate: "2026-08-10", status: "Open"       },
    { sourceModule: "crm",     sourceRefId: lead4.id, title: "Follow up with Kiran Bhat — Mundra port NOC status update",                     ownerId: salesUser.id, priority: "Medium",   dueDate: "2026-08-15", status: "Open"       },
    { sourceModule: "project", sourceRefId: proj1.id, title: "Submit ITP (Inspection & Test Plan) to NTPC RE for approval",                   ownerId: pmUser.id,    priority: "High",     dueDate: "2026-08-01", status: "Open"       },
    { sourceModule: "project", sourceRefId: proj2.id, title: "Arrange third-party EL test for installed modules before final handover",        ownerId: pmUser.id,    priority: "Medium",   dueDate: "2026-08-20", status: "Open"       },
  ]);

  /* ── 13. CONTRACTORS ─────────────────────────────────────────────────── */
  await db.insert(contractorsTable).values([
    { name: "Bondada Engineering Ltd",   trade: "Civil & Pile Foundation",         contractValue: "1350000", contact: "+91-4027809000", rating: 4.3 },
    { name: "Electrotech Systems Pvt Ltd", trade: "HV Electrical Erection",        contractValue: "720000",  contact: "+91-9845670011", rating: 4.1 },
    { name: "Solartech Infra Pvt Ltd",   trade: "Module Mounting & Installation",  contractValue: "890000",  contact: "+91-9988776601", rating: 3.9 },
    { name: "K.B. Cable Works",          trade: "DC/AC Cable Laying & Termination", contractValue: "340000", contact: "+91-9823400112", rating: 4.0 },
    { name: "PowerTrans Services",       trade: "Transformer & Switchgear Erection", contractValue: "280000", contact: "+91-9900334466", rating: 4.6 },
  ]);

  /* ── 14. WAREHOUSES ──────────────────────────────────────────────────── */
  const [wh1] = await db.insert(warehousesTable).values({ name: "Central Store — Automystics HQ, Pune",         location: "Plot 7-A, Pimpri-Chinchwad Industrial Area, Pune 411019",              type: "Central", custodianId: whUser.id }).returning();
  const [wh2] = await db.insert(warehousesTable).values({ name: "Site Store — Rajkot Solar Farm",                location: "Survey No. 142, Shapar-Veraval Road, Rajkot, Gujarat 360024",          type: "Site",    projectId: proj1.id, custodianId: whUser.id }).returning();
  const [wh3] = await db.insert(warehousesTable).values({ name: "Site Store — Chakan Rooftop, Pune",             location: "Plot D-14, Chakan Industrial Estate, Pune, Maharashtra 410501",         type: "Site",    projectId: proj2.id, custodianId: whUser.id }).returning();
  console.log("✅ Warehouses:", wh1.id, wh2.id, wh3.id);

  /* ══════════════════════════════════════════════════════════════════════
     From here: raw SQL via pg.Client (procurement & inventory tables)
  ══════════════════════════════════════════════════════════════════════ */

  /* ── 15. VENDORS ─────────────────────────────────────────────────────── */
  const vRes = await q(`
    INSERT INTO vendors
      (code, name, trade_name, status, gstin, pan, gst_registered_state, gst_state_code,
       billing_address, billing_city, billing_state, billing_pincode,
       primary_email, primary_phone, website,
       bank_name, bank_branch, bank_account_number, bank_ifsc, bank_account_type,
       payment_terms, tags, notes, created_by)
    VALUES
      ('VND-001','Waaree Energies Ltd','Waaree','Active',
       '24AABCW9856D1Z5','AABCW9856D','Gujarat','24',
       'Waaree House, Surat-Hazira Road, Surat','Surat','Gujarat','394510',
       'procurement@waaree.com','+91-2637289900','www.waaree.com',
       'HDFC Bank','Surat Branch','50200012345678','HDFC0001234','Current',
       'Net 60 days from GRN acceptance',
       ARRAY['Tier-1 Module','Preferred Vendor'],
       'India''s largest solar module manufacturer. Dedicated KAM assigned. Bifacial stock available ex-Surat.',
       $1),
      ('VND-002','SMA Solar Technology India Pvt Ltd','SMA Solar','Active',
       '27AADCS2481Q1ZN','AADCS2481Q','Maharashtra','27',
       '4th Floor, One BKC, Bandra Kurla Complex, Mumbai','Mumbai','Maharashtra','400051',
       'india@sma.de','+91-2261234500','www.sma.de/in',
       'Deutsche Bank','Mumbai Branch','0019234567','DEUT0784BBB','Current',
       'Net 45 days from delivery',
       ARRAY['Inverter','Tier-1 OEM','German MNC'],
       'SMA Germany subsidiary. 10-yr standard warranty, extendable to 20 yr. Indian service centre Pune.',
       $1),
      ('VND-003','Polycab India Ltd','Polycab','Active',
       '25AAACL8109B1ZN','AAACL8109B','Gujarat','25',
       'Polycab House, LBS Road, Daman','Daman','Daman & Diu','396210',
       'solar@polycab.com','+91-2607256000','www.polycab.com',
       'ICICI Bank','Daman Branch','628701234567','ICIC0006287','Current',
       'Net 45 days from invoice',
       ARRAY['Cable','BIS Certified','Preferred Vendor'],
       'India''s largest cable manufacturer. TÜV-certified solar DC cables stocked Pune warehouse.',
       $1),
      ('VND-004','Kirloskar Electric Company Ltd','Kirloskar Electric','Active',
       '29AABCK5878N1ZG','AABCK5878N','Karnataka','29',
       'Kirloskar Electric, Rajajinagar Industrial Estate, Bangalore','Bangalore','Karnataka','560044',
       'transformers@kirloskarelectric.com','+91-8023374444','www.kirloskarelectric.com',
       'State Bank of India','Rajajinagar Branch','10032456789','SBIN0040277','Current',
       'Net 60 days; 50% advance for custom orders',
       ARRAY['Transformer','BEE 5-Star','Switchgear'],
       'Leading transformer & switchgear manufacturer. 25kV isolators available.',
       $1),
      ('VND-005','Bondada Engineering Ltd','Bondada Engg','Active',
       '36AABCB6754E1ZP','AABCB6754E','Telangana','36',
       'Plot 15, IDA Mallapur, Hyderabad','Hyderabad','Telangana','500076',
       'info@bondadaengineering.com','+91-4027809000','www.bondadaengineering.com',
       'Axis Bank','Hyderabad Branch','9180200456789','UTIB0000098','Current',
       'Progressive milestone-linked payment',
       ARRAY['Civil','EPC','MSME'],
       'MSME civil & foundation specialist. Empanelled with SECI and NTPC. Also mounting structures.',
       $1)
    RETURNING id
  `, [admin.id]);
  const [vnd1, vnd2, vnd3, vnd4, vnd5] = vRes.rows.map((r: any) => r.id as number);
  console.log("✅ Vendors:", vnd1, vnd2, vnd3, vnd4, vnd5);

  /* ── 16. VENDOR CONTACTS ─────────────────────────────────────────────── */
  await q(`
    INSERT INTO vendor_contacts (vendor_id, name, designation, email, phone, is_primary) VALUES
    ($1,'Rajesh Mehta','Key Account Manager','r.mehta@waaree.com','+91-9081234567',true),
    ($1,'Sunita Patel','Sales Coordinator','s.patel@waaree.com','+91-9081234568',false),
    ($2,'Tobias Müller','Sales Manager – South Asia','t.mueller@sma.de','+91-9820011234',true),
    ($2,'Prathima Reddy','Service Engineer – India','p.reddy@sma.de','+91-9876500123',false),
    ($3,'Ashok Sharma','Regional Sales Manager','a.sharma@polycab.com','+91-9822345678',true),
    ($4,'Girish Rao','Product Manager – Transformers','g.rao@kirloskarelectric.com','+91-9845012345',true),
    ($5,'Venkatesh B.','Business Development Manager','v.b@bondadaengineering.com','+91-9948700123',true)
  `, [vnd1, vnd2, vnd3, vnd4, vnd5]);

  /* ── 17. MATERIAL CATEGORIES ─────────────────────────────────────────── */
  const catRes = await q(`
    INSERT INTO material_categories (name, code, description) VALUES
    ('Solar Modules',               'CAT-SM',  'PV modules: mono, poly, bifacial'),
    ('Inverters & Power Electronics','CAT-INV', 'String, central inverters, PCUs'),
    ('Cables & Wiring',             'CAT-CAB', 'DC solar, AC power, control, HT cables'),
    ('Mounting Structures',         'CAT-MNT', 'GI ground-mount, aluminium rooftop systems'),
    ('Transformers & Switchgear',   'CAT-TRX', 'DTRs, LT/HT panels, MCCBs, ACBs')
    RETURNING id
  `);
  const [cat1, cat2, cat3, cat4, cat5] = catRes.rows.map((r: any) => r.id as number);

  /* ── 18. MATERIALS ───────────────────────────────────────────────────── */
  const matRes = await q(`
    INSERT INTO materials
      (code, name, description, category_id, uom, hsn_sac_code, gst_rate,
       base_price, brand, model, specifications,
       min_order_qty, lead_time_days, min_stock_level, reorder_point, created_by)
    VALUES
    ('MAT-001','Solar Module 550Wp Bifacial Mono PERC',
     'Waaree bifacial 550Wp MBB module — ground mount',
     $1,'Nos','85414011',5,14500,'Waaree','WS-550TG',
     'Bifacial 550Wp, Voc 49.8V, Isc 14.1A, IP68, IEC 61215, half-cell MBB',
     100,21,200,400,$6),
    ('MAT-002','Solar Module 500Wp Mono PERC Rooftop',
     'Waaree mono PERC 500Wp — rooftop installations',
     $1,'Nos','85414011',5,13800,'Waaree','WS-500MW',
     'Mono PERC 500Wp, Voc 47.2V, Isc 13.4A, IP68, half-cell',
     50,18,50,100,$6),
    ('MAT-003','String Inverter 25 kW 3-Phase',
     'SMA Sunny Tripower 25000TL-30 for string arrays',
     $2,'Nos','85044090',18,178000,'SMA','STP25000TL-30',
     '25kW 3-Phase, 2×MPPT, IP65, 98.5% CEC efficiency, OptiTrack Global Peak',
     1,60,2,4,$6),
    ('MAT-004','Central Inverter 630 kW',
     'SMA Sunny Central 630CP-XT for MW-scale plants',
     $2,'Nos','85044090',18,840000,'SMA','SC630CP-XT',
     '630kW 3-Phase, IGBT, remote monitoring, grid guard, indoor',
     1,90,0,1,$6),
    ('MAT-005','DC Solar Cable 4mm² H1Z2Z2-K',
     'Polycab 4mm² UV-resistant DC solar cable — per metre',
     $3,'Mtr','85447090',18,38,'Polycab','H1Z2Z2-K-4',
     '4mm², 1.5kV DC, UV-resistant, TÜV, red/black',
     500,14,2000,5000,$6),
    ('MAT-006','AC XLPE Cable 4C×25mm² SWA',
     'Polycab AC XLPE 4-core 25mm² armoured — per metre',
     $3,'Mtr','85447090',18,620,'Polycab','4CX25XLPE-SWA',
     '1.1kV, 4C 25mm², XLPE insulated, SWA, 90°C',
     100,14,200,500,$6),
    ('MAT-007','HT XLPE Cable 11kV 3C×95mm²',
     'Polycab HT 11kV underground cable — per metre',
     $3,'Mtr','85447090',18,3200,'Polycab','3CX95HT11KV',
     '11kV, 3C 95mm², XLPE, DSTA, copper conductor',
     100,30,50,150,$6),
    ('MAT-008','GI Pile-Foundation Mounting Structure',
     'Hot-dip galvanised pile-based mounting structure — per module set',
     $4,'Set','73089090',18,3200,'Mounting Masters','MM-GM-550',
     'GI 75μm, 2.5° fixed tilt, wind 150 kmph, 25-yr design life',
     100,45,100,300,$6),
    ('MAT-009','Aluminium Rail Rooftop Mounting System',
     'Anodised aluminium rail + GI hook — per metre',
     $4,'Mtr','76109090',18,850,'Ksolare','KS-RT-40',
     'Anodised aluminium 40×40mm, 6m lengths, metal sheet roof',
     50,30,100,200,$6),
    ('MAT-010','DTR 1000 kVA 11kV/415V ONAN',
     'Kirloskar oil-cooled distribution transformer',
     $5,'Nos','85042300',18,1250000,'Kirloskar Electric','ONAN-1000-11/0.415',
     '1000kVA ONAN, 11kV/415V, CRGO core, BEE 5-star, OTI+WTI',
     1,60,0,1,$6),
    ('MAT-011','Main LT Panel 415V 1600A (MLDB)',
     'LT panel with ACB incomer + MCCB feeders for inverter output',
     $5,'Nos','85371090',18,380000,'L&T Electrical','MLDB-1600A-415',
     '415V, 1600A ACB incomer, 8×200A MCCB feeders, IP43, form 3b',
     1,45,0,1,$6),
    ('MAT-012','AC Distribution Box 8-Way (ACDB)',
     'Pre-wired 8-way ACDB for string inverter outputs',
     $5,'Nos','85371090',18,28500,'Socomec','ACDB-8W-32A',
     '8×32A MCB in, 1×63A MCCB out, SPD class II, IP55',
     2,21,5,10,$6)
    RETURNING id
  `, [cat1, cat2, cat3, cat4, cat5, admin.id]);
  const [m1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11,m12] = matRes.rows.map((r: any) => r.id as number);
  console.log("✅ Materials: 12 items");

  /* ── 19. MATERIAL ↔ SUPPLIER LINKS ───────────────────────────────────── */
  const supplierLinks = [
    [m1, vnd1, "Waaree Energies Ltd",               14500,   true ],
    [m2, vnd1, "Waaree Energies Ltd",               13800,   true ],
    [m3, vnd2, "SMA Solar Technology India Pvt Ltd",178000,  true ],
    [m4, vnd2, "SMA Solar Technology India Pvt Ltd",840000,  true ],
    [m5, vnd3, "Polycab India Ltd",                  38,     true ],
    [m6, vnd3, "Polycab India Ltd",                  620,    true ],
    [m7, vnd3, "Polycab India Ltd",                  3200,   true ],
    [m8, vnd5, "Bondada Engineering Ltd",            3200,   true ],
    [m9, vnd5, "Bondada Engineering Ltd",            850,    false],
    [m10,vnd4, "Kirloskar Electric Company Ltd",     1250000,true ],
    [m11,vnd4, "Kirloskar Electric Company Ltd",     380000, false],
    [m12,vnd4, "Kirloskar Electric Company Ltd",     28500,  false],
  ];
  for (const [mid, vid, vname, price, pref] of supplierLinks) {
    await q(`INSERT INTO material_suppliers (material_id, vendor_id, vendor_name, unit_price, is_preferred) VALUES ($1,$2,$3,$4,$5)`,
      [mid, vid, vname, price, pref]);
  }

  /* ── 20. PROCUREMENT QUOTATIONS ──────────────────────────────────────── */
  const pq1 = (await q(`
    INSERT INTO procurement_quotations
      (reference_id, mr_id, vendor_id, vendor_snapshot_name, status,
       subtotal, total_gst, total_amount, validity_date, delivery_lead_days,
       payment_terms, internal_notes, is_l1, is_recommended, po_generated,
       created_by, created_by_name, approved_by, approved_by_name, approved_at)
    VALUES ('VQ-2026-0001',$1,$2,$3,'Approved',
      58000000,2900000,60900000,'2026-08-31',21,
      'Net 60 days from GRN acceptance',
      'Quoted per approved BOM. 550Wp bifacial with bifaciality factor 0.70. Price includes L&F ex-Surat.',
      true,true,true,$4,'Arjun Kapoor',$4,'Arjun Kapoor',NOW()-INTERVAL '70 days')
    RETURNING id
  `, [mr1.id, vnd1, 'Waaree Energies Ltd', admin.id])).rows[0].id as number;

  await q(`INSERT INTO proc_quotation_items (quotation_id,line_no,material_id,material_code,material_name,uom,qty,unit_price,taxable_amount,gst_rate,total_gst,line_total)
    VALUES ($1,1,$2,'MAT-001','Solar Module 550Wp Bifacial Mono PERC','Nos',4000,14500,58000000,5,2900000,60900000)`, [pq1, m1]);

  const pq2 = (await q(`
    INSERT INTO procurement_quotations
      (reference_id, mr_id, vendor_id, vendor_snapshot_name, status,
       subtotal, total_gst, total_amount, validity_date, delivery_lead_days,
       payment_terms, internal_notes, is_l1, is_recommended, po_generated,
       created_by, created_by_name, approved_by, approved_by_name, approved_at)
    VALUES ('VQ-2026-0002',$1,$2,$3,'Approved',
      1068000,192240,1260240,'2026-08-15',60,
      'Net 45 days from delivery',
      'Price includes freight to Pune. 10-yr standard warranty. Pre-commissioning support included.',
      true,true,true,$4,'Arjun Kapoor',$4,'Arjun Kapoor',NOW()-INTERVAL '145 days')
    RETURNING id
  `, [mr2.id, vnd2, 'SMA Solar Technology India Pvt Ltd', admin.id])).rows[0].id as number;

  await q(`INSERT INTO proc_quotation_items (quotation_id,line_no,material_id,material_code,material_name,uom,qty,unit_price,taxable_amount,gst_rate,total_gst,line_total)
    VALUES ($1,1,$2,'MAT-003','String Inverter 25 kW 3-Phase','Nos',6,178000,1068000,18,192240,1260240)`, [pq2, m3]);

  const pq3 = (await q(`
    INSERT INTO procurement_quotations
      (reference_id, mr_id, vendor_id, vendor_snapshot_name, status,
       subtotal, total_gst, total_amount, validity_date, delivery_lead_days,
       payment_terms, internal_notes, is_l1, is_recommended, po_generated,
       created_by, created_by_name, approved_by, approved_by_name, approved_at)
    VALUES ('VQ-2026-0003',$1,$2,$3,'Approved',
      1808000,325440,2133440,'2026-09-01',14,
      'Net 45 days from invoice',
      'DC cable in 500m drum rolls. AC cable in 100m coils. Delivery to Rajkot site.',
      true,true,true,$4,'Arjun Kapoor',$4,'Arjun Kapoor',NOW()-INTERVAL '38 days')
    RETURNING id
  `, [mr3.id, vnd3, 'Polycab India Ltd', admin.id])).rows[0].id as number;

  await q(`INSERT INTO proc_quotation_items (quotation_id,line_no,material_id,material_code,material_name,uom,qty,unit_price,taxable_amount,gst_rate,total_gst,line_total)
    VALUES ($1,1,$2,'MAT-005','DC Solar Cable 4mm² H1Z2Z2-K','Mtr',28000,38,1064000,18,191520,1255520),
           ($1,2,$3,'MAT-006','AC XLPE Cable 4C×25mm² SWA','Mtr',1200,620,744000,18,133920,877920)`, [pq3, m5, m6]);
  console.log("✅ Proc Quotations:", pq1, pq2, pq3);

  /* ── 21. PURCHASE ORDERS ─────────────────────────────────────────────── */
  // PO-2026-0001: Waaree — 4000 modules, PartiallyReceived (2000 done, 2000 pending)
  const po1 = (await q(`
    INSERT INTO procurement_pos
      (po_number, quotation_id, project_id, vendor_id, vendor_name, vendor_gstin, vendor_address,
       status, po_date, delivery_deadline, delivery_address, payment_terms, warranty_months,
       subtotal, total_gst, total_amount, special_terms,
       created_by, created_by_name, approved_by, approved_by_name, approved_at,
       submitted_at, submitted_by, submitted_by_name)
    VALUES
    ('PO-2026-0001',$1,$2,$3,'Waaree Energies Ltd','24AABCW9856D1Z5',
     'Waaree House, Surat-Hazira Road, Surat 394510',
     'PartiallyReceived','2026-04-10','2026-06-30',
     'Survey No. 142, Shapar-Veraval Road, Rajkot, Gujarat 360024',
     'Net 60 days from GRN acceptance',300,
     58000000,2900000,60900000,
     'Two lots: Lot 1 — 2000 Nos by 31-May; Lot 2 — 2000 Nos by 30-Jun. All modules must be accompanied by factory test reports, EL images and flash reports.',
     $4,'Arjun Kapoor',$4,'Arjun Kapoor',NOW()-INTERVAL '80 days',
     NOW()-INTERVAL '83 days',$4,'Arjun Kapoor')
    RETURNING id
  `, [pq1, proj1.id, vnd1, admin.id])).rows[0].id as number;

  await q(`INSERT INTO proc_po_items (po_id,line_no,material_id,material_code,material_name,uom,qty,unit_price,taxable_amount,gst_rate,total_gst,line_total,delivered_qty)
    VALUES ($1,1,$2,'MAT-001','Solar Module 550Wp Bifacial Mono PERC','Nos',4000,14500,58000000,5,2900000,60900000,2000)`, [po1, m1]);

  // PO-2026-0002: SMA — 6 inverters, FullyReceived
  const po2 = (await q(`
    INSERT INTO procurement_pos
      (po_number, quotation_id, project_id, vendor_id, vendor_name, vendor_gstin,
       status, po_date, delivery_deadline, delivery_address, payment_terms, warranty_months,
       subtotal, total_gst, total_amount,
       created_by, created_by_name, approved_by, approved_by_name, approved_at,
       submitted_at, submitted_by, submitted_by_name)
    VALUES
    ('PO-2026-0002',$1,$2,$3,'SMA Solar Technology India Pvt Ltd','27AADCS2481Q1ZN',
     'FullyReceived','2026-01-20','2026-03-15',
     'Plot D-14, Chakan Industrial Estate, Pune 410501',
     'Net 45 days from delivery',120,
     1068000,192240,1260240,
     $4,'Arjun Kapoor',$4,'Arjun Kapoor',NOW()-INTERVAL '150 days',
     NOW()-INTERVAL '153 days',$4,'Arjun Kapoor')
    RETURNING id
  `, [pq2, proj2.id, vnd2, admin.id])).rows[0].id as number;

  await q(`INSERT INTO proc_po_items (po_id,line_no,material_id,material_code,material_name,uom,qty,unit_price,taxable_amount,gst_rate,total_gst,line_total,delivered_qty)
    VALUES ($1,1,$2,'MAT-003','String Inverter 25 kW 3-Phase','Nos',6,178000,1068000,18,192240,1260240,6)`, [po2, m3]);

  // PO-2026-0003: Polycab cables — Issued (in transit)
  const po3 = (await q(`
    INSERT INTO procurement_pos
      (po_number, quotation_id, project_id, vendor_id, vendor_name, vendor_gstin,
       status, po_date, delivery_deadline, delivery_address, payment_terms,
       subtotal, total_gst, total_amount,
       created_by, created_by_name, approved_by, approved_by_name, approved_at,
       submitted_at, submitted_by, submitted_by_name)
    VALUES
    ('PO-2026-0003',$1,$2,$3,'Polycab India Ltd','25AAACL8109B1ZN',
     'Issued','2026-06-01','2026-07-15',
     'Survey No. 142, Shapar-Veraval Road, Rajkot, Gujarat 360024',
     'Net 45 days from invoice',
     1808000,325440,2133440,
     $4,'Arjun Kapoor',$4,'Arjun Kapoor',NOW()-INTERVAL '40 days',
     NOW()-INTERVAL '42 days',$4,'Arjun Kapoor')
    RETURNING id
  `, [pq3, proj1.id, vnd3, admin.id])).rows[0].id as number;

  await q(`INSERT INTO proc_po_items (po_id,line_no,material_id,material_code,material_name,uom,qty,unit_price,taxable_amount,gst_rate,total_gst,line_total,delivered_qty)
    VALUES ($1,1,$2,'MAT-005','DC Solar Cable 4mm² H1Z2Z2-K','Mtr',28000,38,1064000,18,191520,1255520,0),
           ($1,2,$3,'MAT-006','AC XLPE Cable 4C×25mm² SWA','Mtr',1200,620,744000,18,133920,877920,0)`, [po3, m5, m6]);
  console.log("✅ POs:", po1, po2, po3);

  /* ── 22. GRNs ────────────────────────────────────────────────────────── */
  // GRN-2026-0001: 2000 Waaree modules → Rajkot site store — Accepted
  const grn1 = (await q(`
    INSERT INTO proc_grns
      (grn_number, po_id, vendor_id, vendor_name, status, is_locked,
       warehouse_id, warehouse_name, delivery_date, vehicle_number, dc_number, dc_date,
       received_by, received_by_name, received_at,
       inspected_by, inspected_by_name, inspected_at,
       approved_by, approved_by_name, approved_at,
       total_ordered_qty, total_received_qty, total_accepted_qty, total_rejected_qty, total_accepted_value,
       remarks, created_by, created_by_name)
    VALUES
    ('GRN-2026-0001',$1,$2,'Waaree Energies Ltd','Accepted',true,
     $3,'Site Store — Rajkot Solar Farm',
     '2026-05-28','GJ04AZ7823','WAA-DC-2026-0412','2026-05-27',
     $4,'Santosh Pawar',NOW()-INTERVAL '60 days',
     $4,'Santosh Pawar',NOW()-INTERVAL '59 days',
     $5,'Vikram Rathod',NOW()-INTERVAL '58 days',
     4000,2000,2000,0,29000000,
     'Lot 1 of 2. All 2000 modules checked — EL test passed, flash reports verified. No transit damage. Stored in designated module yard.',
     $4,'Santosh Pawar')
    RETURNING id
  `, [po1, vnd1, wh2.id, whUser.id, pmUser.id])).rows[0].id as number;

  const po1Item = (await q(`SELECT id FROM proc_po_items WHERE po_id=$1 AND line_no=1`, [po1])).rows[0].id as number;
  await q(`INSERT INTO proc_grn_items (grn_id,po_item_id,line_no,material_id,material_code,material_name,uom,ordered_qty,received_qty,accepted_qty,rejected_qty,qc_status,unit_price,accepted_value)
    VALUES ($1,$2,1,$3,'MAT-001','Solar Module 550Wp Bifacial Mono PERC','Nos',4000,2000,2000,0,'Accepted',14500,29000000)`, [grn1, po1Item, m1]);

  // GRN-2026-0002: 6 SMA inverters → Chakan site store — Accepted
  const grn2 = (await q(`
    INSERT INTO proc_grns
      (grn_number, po_id, vendor_id, vendor_name, status, is_locked,
       warehouse_id, warehouse_name, delivery_date, vehicle_number, dc_number, dc_date,
       received_by, received_by_name, received_at,
       inspected_by, inspected_by_name, inspected_at,
       approved_by, approved_by_name, approved_at,
       total_ordered_qty, total_received_qty, total_accepted_qty, total_rejected_qty, total_accepted_value,
       remarks, created_by, created_by_name)
    VALUES
    ('GRN-2026-0002',$1,$2,'SMA Solar Technology India Pvt Ltd','Accepted',true,
     $3,'Site Store — Chakan Rooftop, Pune',
     '2026-03-10','MH12GH3456','SMA-IN-2026-0089','2026-03-09',
     $4,'Santosh Pawar',NOW()-INTERVAL '140 days',
     $4,'Santosh Pawar',NOW()-INTERVAL '139 days',
     $5,'Vikram Rathod',NOW()-INTERVAL '138 days',
     6,6,6,0,1068000,
     'All 6 inverters received. Serial nos verified against PO. No transit damage. Factory test reports checked. SMA service engineer present during unboxing.',
     $4,'Santosh Pawar')
    RETURNING id
  `, [po2, vnd2, wh3.id, whUser.id, pmUser.id])).rows[0].id as number;

  const po2Item = (await q(`SELECT id FROM proc_po_items WHERE po_id=$1 AND line_no=1`, [po2])).rows[0].id as number;
  await q(`INSERT INTO proc_grn_items (grn_id,po_item_id,line_no,material_id,material_code,material_name,uom,ordered_qty,received_qty,accepted_qty,rejected_qty,qc_status,unit_price,accepted_value)
    VALUES ($1,$2,1,$3,'MAT-003','String Inverter 25 kW 3-Phase','Nos',6,6,6,0,'Accepted',178000,1068000)`, [grn2, po2Item, m3]);
  console.log("✅ GRNs:", grn1, grn2);

  /* ── 23. PROCUREMENT INVOICES ────────────────────────────────────────── */
  // Invoice 1: Waaree — 2000 modules — Approved (due 2026-07-28)
  const inv1 = (await q(`
    INSERT INTO proc_invoices
      (invoice_number, invoice_type, po_id, grn_id, vendor_id, vendor_name,
       vendor_invoice_number, vendor_invoice_date, status, is_locked, match_status,
       subtotal, total_gst, total_amount, tds_amount, net_payable,
       payment_terms, payment_terms_days, due_date,
       bank_name, bank_account, bank_ifsc,
       submitted_at, submitted_by, submitted_by_name,
       approved_by, approved_by_name, approved_at)
    VALUES
    ('PINV-2026-0001','Standard',$1,$2,$3,'Waaree Energies Ltd',
     'WAA-INV-2026-1842','2026-05-30','Approved',true,'Matched',
     29000000,1450000,30450000,0,30450000,
     'Net 60 days from GRN acceptance',60,'2026-07-28',
     'HDFC Bank','50200012345678','HDFC0001234',
     NOW()-INTERVAL '57 days',$4,'Santosh Pawar',
     $4,'Arjun Kapoor',NOW()-INTERVAL '55 days')
    RETURNING id
  `, [po1, grn1, vnd1, admin.id])).rows[0].id as number;

  await q(`INSERT INTO proc_invoice_items (invoice_id,line_no,material_name,uom,ordered_qty,received_qty,invoiced_qty,unit_price,taxable_amount,gst_rate,gst_amount,line_total)
    VALUES ($1,1,'Solar Module 550Wp Bifacial Mono PERC','Nos',4000,2000,2000,14500,29000000,5,1450000,30450000)`, [inv1]);

  // Invoice 2: SMA — 6 inverters — Paid
  const inv2 = (await q(`
    INSERT INTO proc_invoices
      (invoice_number, invoice_type, po_id, grn_id, vendor_id, vendor_name,
       vendor_invoice_number, vendor_invoice_date, status, is_locked, match_status,
       subtotal, total_gst, total_amount, tds_amount, net_payable, paid_amount,
       payment_terms, payment_terms_days, due_date,
       bank_name, bank_account, bank_ifsc,
       submitted_at, submitted_by, submitted_by_name,
       approved_by, approved_by_name, approved_at,
       paid_at, paid_by, paid_by_name, payment_reference, payment_mode)
    VALUES
    ('PINV-2026-0002','Standard',$1,$2,$3,'SMA Solar Technology India Pvt Ltd',
     'SMA-2026-IN-00214','2026-03-12','Paid',true,'Matched',
     1068000,192240,1260240,0,1260240,1260240,
     'Net 45 days from delivery',45,'2026-04-24',
     'Deutsche Bank','0019234567','DEUT0784BBB',
     NOW()-INTERVAL '136 days',$4,'Santosh Pawar',
     $4,'Arjun Kapoor',NOW()-INTERVAL '134 days',
     NOW()-INTERVAL '95 days',$4,'Arjun Kapoor',
     'NEFT/AUTOMYSTICS/20260424/001','NEFT')
    RETURNING id
  `, [po2, grn2, vnd2, admin.id])).rows[0].id as number;

  await q(`INSERT INTO proc_invoice_items (invoice_id,line_no,material_name,uom,ordered_qty,received_qty,invoiced_qty,unit_price,taxable_amount,gst_rate,gst_amount,line_total)
    VALUES ($1,1,'String Inverter 25 kW 3-Phase','Nos',6,6,6,178000,1068000,18,192240,1260240)`, [inv2]);
  console.log("✅ Invoices:", inv1, inv2);

  /* ── 24. STOCK LEDGER ────────────────────────────────────────────────── */
  const todayStr = today.toISOString().split("T")[0];
  // Rajkot: 2000 received (GRN), 800 issued to installation, 1200 balance
  await q(`INSERT INTO stock_ledger (warehouse_id,item_id,item_name,txn_type,qty,balance_qty,ref_doc_type,ref_doc_id,date)
    VALUES ($1,$2,'Solar Module 550Wp Bifacial Mono PERC','Inward',2000,2000,'GRN',$3,$4::date - INTERVAL '60 days')`,
    [wh2.id, m1, grn1, todayStr]);
  await q(`INSERT INTO stock_ledger (warehouse_id,item_id,item_name,txn_type,qty,balance_qty,ref_doc_type,ref_doc_id,date)
    VALUES ($1,$2,'Solar Module 550Wp Bifacial Mono PERC','Outward',-800,1200,'DeliveryChallan',NULL,$3::date - INTERVAL '30 days')`,
    [wh2.id, m1, todayStr]);

  // Chakan: 6 inverters received, all 6 issued (installed)
  await q(`INSERT INTO stock_ledger (warehouse_id,item_id,item_name,txn_type,qty,balance_qty,ref_doc_type,ref_doc_id,date)
    VALUES ($1,$2,'String Inverter 25 kW 3-Phase','Inward',6,6,'GRN',$3,$4::date - INTERVAL '140 days')`,
    [wh3.id, m3, grn2, todayStr]);
  await q(`INSERT INTO stock_ledger (warehouse_id,item_id,item_name,txn_type,qty,balance_qty,ref_doc_type,ref_doc_id,date)
    VALUES ($1,$2,'String Inverter 25 kW 3-Phase','Outward',-6,0,'DeliveryChallan',NULL,$3::date - INTERVAL '100 days')`,
    [wh3.id, m3, todayStr]);

  /* ── 25. MATERIAL STOCK LEVELS ───────────────────────────────────────── */
  // 1200 modules at Rajkot (800 allocated to ongoing installation, 400 available)
  await q(`INSERT INTO material_stock_levels
    (warehouse_id,material_id,material_code,material_name,uom,current_qty,allocated_qty,available_qty,
     unit_cost,total_value,min_stock_level,reorder_qty,is_below_reorder,is_out_of_stock)
    VALUES ($1,$2,'MAT-001','Solar Module 550Wp Bifacial Mono PERC','Nos',1200,800,400,14500,17400000,200,400,false,false)`,
    [wh2.id, m1]);
  // 0 inverters at Chakan (all installed)
  await q(`INSERT INTO material_stock_levels
    (warehouse_id,material_id,material_code,material_name,uom,current_qty,allocated_qty,available_qty,
     unit_cost,total_value,min_stock_level,reorder_qty,is_below_reorder,is_out_of_stock)
    VALUES ($1,$2,'MAT-003','String Inverter 25 kW 3-Phase','Nos',0,0,0,178000,0,2,4,true,true)`,
    [wh3.id, m3]);

  console.log("\n🎉 Seed complete!");
  console.log("   4 users | 5 leads | 2 CRM quotations | 3 projects | 5 contractors | 3 warehouses");
  console.log("   5 vendors | 12 materials | 3 proc quotations | 3 POs | 2 GRNs | 2 invoices");
  console.log("   Stock ledger updated · Complete procurement chain seeded");
  console.log("\n   Login credentials:");
  console.log("   admin@automystics.com   / admin123  (Admin)");
  console.log("   meera@automystics.com   / sales123  (Sales)");
  console.log("   vikram@automystics.com  / pm123     (Project Manager)");
  console.log("   santosh@automystics.com / wh123     (Warehouse)");
}

seed()
  .catch(e => { console.error("❌ Seed failed:", e.message); process.exit(1); })
  .finally(() => { client.end(); process.exit(0); });
