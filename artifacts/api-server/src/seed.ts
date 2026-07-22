import { db, usersTable, leadsTable, quotationsTable, clientPOsTable, projectsTable, activitiesTable, budgetsTable, paymentMilestonesTable, expensesTable, dprsTable, contractorsTable, warehousesTable, escalationsTable, tasksTable, materialRequestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (in dependency order)
  await db.delete(materialRequestsTable);
  await db.delete(dprsTable);
  await db.delete(expensesTable);
  await db.delete(paymentMilestonesTable);
  await db.delete(budgetsTable);
  await db.delete(activitiesTable);
  await db.delete(escalationsTable);
  await db.delete(tasksTable);
  await db.delete(projectsTable);
  await db.delete(clientPOsTable);
  await db.delete(quotationsTable);
  await db.delete(leadsTable);
  await db.delete(contractorsTable);
  await db.delete(warehousesTable);
  await db.delete(usersTable);

  // Users
  const [admin] = await db.insert(usersTable).values({ name: "Admin User", email: "admin@automystics.com", passwordHash: "admin123", role: "admin" }).returning();
  const [salesUser] = await db.insert(usersTable).values({ name: "Rajan Sharma", email: "rajan@automystics.com", passwordHash: "sales123", role: "sales" }).returning();
  const [pmUser] = await db.insert(usersTable).values({ name: "Priya Iyer", email: "priya@automystics.com", passwordHash: "pm123", role: "pm" }).returning();
  const [whUser] = await db.insert(usersTable).values({ name: "Kiran Mehta", email: "kiran@automystics.com", passwordHash: "wh123", role: "warehouse" }).returning();

  console.log("Users seeded:", admin.id, salesUser.id, pmUser.id, whUser.id);

  // Leads
  const [lead1] = await db.insert(leadsTable).values({ source: "IndiaMART", ownerId: salesUser.id, territory: "Maharashtra", companyName: "Bharat Infra Pvt Ltd", contactName: "Suresh Patil", contactPhone: "+91-9812345678", contactEmail: "suresh@bharatinfra.com", productInterest: "Sub-station setup 33/11 kV", estimatedValue: "4500000", score: 82, status: "Qualified", notes: "High priority — site survey complete" }).returning();
  const [lead2] = await db.insert(leadsTable).values({ source: "Referral", ownerId: salesUser.id, territory: "Gujarat", companyName: "Ahmedabad Solar Corp", contactName: "Dhruv Modi", contactPhone: "+91-9876543210", contactEmail: "dhruv@ahmsolar.com", productInterest: "Solar EPC 500 kW", estimatedValue: "7200000", score: 65, status: "Proposal", notes: "Awaiting BOQ finalisation" }).returning();
  const [lead3] = await db.insert(leadsTable).values({ source: "Website", ownerId: salesUser.id, territory: "Karnataka", companyName: "Bangalore Metro Contractors", contactName: "Anita Rao", contactPhone: "+91-9900112233", contactEmail: "anita@bmcontractors.in", productInterest: "HT cable laying 2km", estimatedValue: "1800000", score: 55, status: "Contacted" }).returning();
  const [lead4] = await db.insert(leadsTable).values({ source: "JustDial", ownerId: salesUser.id, territory: "Rajasthan", companyName: "Jaipur Power House", contactName: "Vikram Singh", contactPhone: "+91-9811223344", contactEmail: "vikram@jphouse.com", productInterest: "Transformer supply & erection", estimatedValue: "3200000", score: 70, status: "Negotiation" }).returning();
  const [lead5] = await db.insert(leadsTable).values({ source: "Card-scan", ownerId: salesUser.id, territory: "UP", companyName: "Lucknow Distribution Ltd", contactName: "Ramesh Verma", contactPhone: "+91-9900998877", contactEmail: "ramesh@luckdist.com", productInterest: "Electrical panel manufacturing", estimatedValue: "2700000", score: 45, status: "New" }).returning();

  console.log("Leads seeded:", lead1.id, lead2.id, lead3.id, lead4.id, lead5.id);

  // Quotations
  const boqItems1 = [
    { description: "33/11 kV Transformer 1 MVA", qty: 2, unit: "nos", unitPrice: 850000, amount: 1700000 },
    { description: "Control Panel & Metering", qty: 1, unit: "lot", unitPrice: 450000, amount: 450000 },
    { description: "Civil Work & Foundation", qty: 1, unit: "lot", unitPrice: 350000, amount: 350000 },
    { description: "HT Cable 33 kV XLPE", qty: 500, unit: "m", unitPrice: 1200, amount: 600000 },
  ];
  const [quot1] = await db.insert(quotationsTable).values({ leadId: lead1.id, boqItems: boqItems1, version: 1, markupPct: "18", totalAmount: "3658000", approvalStatus: "Approved", validTill: "2026-09-30", notes: "Version 1 — approved" }).returning();

  const [quot2] = await db.insert(quotationsTable).values({ leadId: lead2.id, boqItems: [{ description: "Solar Panels 500W", qty: 1000, unit: "nos", unitPrice: 6000, amount: 6000000 }, { description: "Inverters 50 kW", qty: 10, unit: "nos", unitPrice: 75000, amount: 750000 }], version: 1, markupPct: "15", totalAmount: "7762500", approvalStatus: "Pending", validTill: "2026-10-15" }).returning();

  console.log("Quotations seeded:", quot1.id, quot2.id);

  // Client POs + Projects
  const [proj1] = await db.insert(projectsTable).values({ name: "Bharat Infra — 33/11 kV Sub-station, Pune", siteLocation: "Plot 47, Bhosari MIDC, Pune", pmOwnerId: pmUser.id, startDate: "2026-02-01", plannedEnd: "2026-08-31", status: "Active", contractValue: "4500000", percentComplete: 42 }).returning();

  const [cpo1] = await db.insert(clientPOsTable).values({ quotationId: quot1.id, clientPoNumber: "BIPL-PO-2026-001", contractValue: "4500000", paymentTerms: "30% advance, 40% milestone, 30% completion", status: "Active", projectId: proj1.id }).returning();

  await db.update(projectsTable).set({ clientPoId: cpo1.id }).where(eq(projectsTable.id, proj1.id));

  const [proj2] = await db.insert(projectsTable).values({ name: "Solar EPC 500 kW — Ahmedabad", siteLocation: "Sanand Industrial Area, Ahmedabad", pmOwnerId: pmUser.id, startDate: "2026-05-01", plannedEnd: "2026-11-30", status: "Planning", contractValue: "7200000", percentComplete: 5 }).returning();

  const [proj3] = await db.insert(projectsTable).values({ name: "HT Cable Laying — Bangalore Metro Phase 2", siteLocation: "Whitefield, Bangalore", pmOwnerId: pmUser.id, startDate: "2026-03-15", plannedEnd: "2026-07-15", status: "Active", contractValue: "1800000", percentComplete: 68 }).returning();

  console.log("Projects seeded:", proj1.id, proj2.id, proj3.id);

  // Activities for proj1
  const acts = [
    { projectId: proj1.id, wbsCode: "1.1", name: "Site Survey & Soil Testing", plannedStart: "2026-02-01", plannedEnd: "2026-02-15", actualStart: "2026-02-01", actualEnd: "2026-02-14", percentComplete: 100, status: "Completed" },
    { projectId: proj1.id, wbsCode: "1.2", name: "Foundation Design & Approval", plannedStart: "2026-02-16", plannedEnd: "2026-03-05", actualStart: "2026-02-16", percentComplete: 100, status: "Completed" },
    { projectId: proj1.id, wbsCode: "2.1", name: "Civil & Foundation Work", plannedStart: "2026-03-06", plannedEnd: "2026-04-15", actualStart: "2026-03-06", percentComplete: 85, status: "InProgress" },
    { projectId: proj1.id, wbsCode: "2.2", name: "Transformer Installation", plannedStart: "2026-04-16", plannedEnd: "2026-05-31", percentComplete: 0, status: "NotStarted" },
    { projectId: proj1.id, wbsCode: "3.1", name: "Control Panel Wiring", plannedStart: "2026-06-01", plannedEnd: "2026-07-15", percentComplete: 0, status: "NotStarted" },
    { projectId: proj1.id, wbsCode: "4.1", name: "Commissioning & Testing", plannedStart: "2026-07-16", plannedEnd: "2026-08-31", percentComplete: 0, status: "NotStarted" },
  ];
  for (const act of acts) {
    await db.insert(activitiesTable).values({ ...act, dependencyIds: [] });
  }

  // Budgets for proj1
  const budgetLines = [
    { projectId: proj1.id, costHead: "Equipment", budgetedAmount: "2200000", committedAmount: "1900000", actualAmount: "1650000", revisionNo: 0 },
    { projectId: proj1.id, costHead: "Civil Work", budgetedAmount: "500000", committedAmount: "480000", actualAmount: "420000", revisionNo: 0 },
    { projectId: proj1.id, costHead: "Electrical Erection", budgetedAmount: "800000", committedAmount: "600000", actualAmount: "310000", revisionNo: 0 },
    { projectId: proj1.id, costHead: "Engineering & PMC", budgetedAmount: "350000", committedAmount: "350000", actualAmount: "200000", revisionNo: 0 },
    { projectId: proj1.id, costHead: "Miscellaneous", budgetedAmount: "150000", committedAmount: "80000", actualAmount: "65000", revisionNo: 0 },
  ];
  for (const b of budgetLines) await db.insert(budgetsTable).values(b);

  // Payment milestones for proj1
  await db.insert(paymentMilestonesTable).values([
    { projectId: proj1.id, milestoneName: "Advance Payment", triggerCondition: "On PO issuance", amount: "1350000", dueDate: "2026-02-15", status: "Paid" },
    { projectId: proj1.id, milestoneName: "Foundation Complete", triggerCondition: "Civil foundation approved by client", amount: "1800000", dueDate: "2026-04-30", status: "Triggered" },
    { projectId: proj1.id, milestoneName: "Equipment Delivery", triggerCondition: "Transformer delivered & GRN done", amount: "900000", dueDate: "2026-05-15", status: "Pending" },
    { projectId: proj1.id, milestoneName: "Commissioning", triggerCondition: "System commissioned & tested", amount: "450000", dueDate: "2026-08-31", status: "Pending" },
  ]);

  // DPRs
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    await db.insert(dprsTable).values({ projectId: proj1.id, reportDate: date.toISOString().split("T")[0], submittedBy: pmUser.id, workSummary: `Day ${6 - i} — civil work progressing. RCC shuttering completed on south end.`, manpowerCount: 12 + (i % 4), weather: i % 7 === 0 ? "Rainy" : "Clear", percentComplete: 38 + (5 - i), photos: [] });
  }

  // Expenses
  await db.insert(expensesTable).values([
    { projectId: proj1.id, category: "Travel", amount: "12500", incurredBy: pmUser.id, date: "2026-06-15", approvalStatus: "Approved", notes: "Site visit Pune — 3 trips" },
    { projectId: proj1.id, category: "Material (Misc)", amount: "48000", incurredBy: pmUser.id, date: "2026-07-02", approvalStatus: "Pending", notes: "Consumables & safety gear" },
    { projectId: proj1.id, category: "Subcontractor", amount: "220000", incurredBy: pmUser.id, date: "2026-07-10", approvalStatus: "Approved", notes: "Civil sub-contractor advance" },
  ]);

  // Material Requests
  await db.insert(materialRequestsTable).values([
    { projectId: proj1.id, raisedBy: pmUser.id, mrNumber: "MR-0001", items: [{ itemName: "33 kV XLPE Cable", qty: 500, unit: "m", specifications: "3 core 150mm2" }], requiredByDate: "2026-05-01", status: "POGenerated" },
    { projectId: proj2.id, raisedBy: pmUser.id, mrNumber: "MR-0002", items: [{ itemName: "Monocrystalline Solar Panel 500W", qty: 1000, unit: "nos", specifications: "Tier-1 manufacturer" }], requiredByDate: "2026-06-15", status: "QuotationPending" },
    { projectId: proj1.id, raisedBy: pmUser.id, mrNumber: "MR-0003", items: [{ itemName: "Control Cable 2.5mm2", qty: 200, unit: "m" }, { itemName: "Junction Box IP65", qty: 10, unit: "nos" }], requiredByDate: "2026-07-01", status: "Open" },
  ]);

  // Escalations
  await db.insert(escalationsTable).values([
    { sourceEntityType: "project", sourceEntityId: proj1.id, projectId: proj1.id, module: "project", raisedBy: pmUser.id, reason: "Transformer delivery delayed by vendor — 3 weeks behind schedule", severity: "High", assignedTo: admin.id, status: "InProgress" },
    { sourceEntityType: "lead", sourceEntityId: lead2.id, module: "crm", raisedBy: salesUser.id, reason: "Client unresponsive for 2 weeks — quotation expiring", severity: "Medium", assignedTo: salesUser.id, status: "Pending" },
    { sourceEntityType: "project", sourceEntityId: proj3.id, projectId: proj3.id, module: "project", raisedBy: pmUser.id, reason: "Cable laying halted — BBMP permit expired", severity: "Critical", assignedTo: admin.id, status: "Pending" },
  ]);

  // Tasks
  await db.insert(tasksTable).values([
    { sourceModule: "crm", sourceRefId: lead2.id, title: "Follow up with Dhruv Modi on Solar BOQ review", ownerId: salesUser.id, priority: "High", dueDate: "2026-07-28", status: "Open" },
    { sourceModule: "project", sourceRefId: proj1.id, title: "Confirm transformer delivery date with vendor", ownerId: pmUser.id, priority: "Critical", dueDate: "2026-07-25", status: "InProgress" },
    { sourceModule: "project", sourceRefId: proj1.id, title: "Submit FAT report to client", ownerId: pmUser.id, priority: "Medium", dueDate: "2026-08-10", status: "Open" },
    { sourceModule: "crm", sourceRefId: lead4.id, title: "Send revised quotation to Vikram Singh", ownerId: salesUser.id, priority: "High", dueDate: "2026-07-26", status: "Open" },
  ]);

  // Contractors
  await db.insert(contractorsTable).values([
    { name: "Shinde Civil Works", trade: "Civil & Foundation", contractValue: "480000", contact: "+91-9812200011", rating: 4.2 },
    { name: "Kalbhor Electricals", trade: "HV Cable Installation", contractValue: "620000", contact: "+91-9988776655", rating: 3.8 },
    { name: "Joshi & Associates", trade: "Transformer Erection", contractValue: "350000", contact: "+91-9900334455", rating: 4.5 },
  ]);

  // Warehouses
  await db.insert(warehousesTable).values([
    { name: "Central Store — Automystics HQ", location: "Plot 12, MIDC Bhosari, Pune", type: "Central" },
    { name: "Site Store — Bharat Infra Pune", projectId: proj1.id, location: "Bhosari MIDC, Pune", type: "Site", custodianId: whUser.id },
  ]);

  console.log("Seeding complete!");
}

seed().catch(e => {
  console.error("Seed failed:", e);
  process.exit(1);
}).finally(() => process.exit(0));
