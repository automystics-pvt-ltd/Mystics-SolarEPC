import { pgTable, serial, text, integer, numeric, timestamp, json, date, real, unique, boolean, foreignKey, varchar, jsonb, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const auditAction = pgEnum("audit_action", ['Created', 'Updated', 'Submitted', 'ReviewStarted', 'RevisionRequested', 'Approved', 'Rejected', 'Deleted', 'CommentAdded', 'DocumentUploaded', 'POGenerated', 'Reopened', 'Cancelled', 'AttachmentAdded', 'AttachmentRemoved', 'Escalated'])
export const grnReturnStatus = pgEnum("grn_return_status", ['Draft', 'Submitted', 'Approved', 'Dispatched', 'Closed', 'Cancelled'])
export const notificationType = pgEnum("notification_type", ['info', 'warning', 'success', 'error', 'approval'])
export const procGrnItemQcStatus = pgEnum("proc_grn_item_qc_status", ['Pending', 'Accepted', 'PartiallyAccepted', 'Rejected'])
export const procGrnStatus = pgEnum("proc_grn_status", ['Draft', 'Submitted', 'Accepted', 'PartiallyAccepted', 'Rejected'])
export const procInvoiceMatchStatus = pgEnum("proc_invoice_match_status", ['Matched', 'MismatchPending', 'MismatchApproved'])
export const procInvoiceStatus = pgEnum("proc_invoice_status", ['Draft', 'PendingApproval', 'Approved', 'OnHold', 'Paid', 'Cancelled'])
export const procPoStatus = pgEnum("proc_po_status", ['Draft', 'Issued', 'Acknowledged', 'PartiallyReceived', 'FullyReceived', 'Closed', 'Cancelled'])
export const procQuotationStatus = pgEnum("proc_quotation_status", ['Draft', 'Submitted', 'UnderReview', 'RevisionRequested', 'Approved', 'Rejected'])
export const stockTransferStatus = pgEnum("stock_transfer_status", ['Draft', 'Approved', 'InTransit', 'Completed', 'Cancelled'])
export const uom = pgEnum("uom", ['Nos', 'Pcs', 'Set', 'Pair', 'Kg', 'MT', 'Gm', 'Mtr', 'Cm', 'Mm', 'Ft', 'Inch', 'Sqm', 'Sqft', 'Ltr', 'ML', 'Box', 'Carton', 'Bundle', 'Roll', 'Bag', 'Drum', 'KVA', 'KW', 'KWp', 'kWh', 'VA', 'Other'])
export const vendorStatus = pgEnum("vendor_status", ['Active', 'Inactive', 'Blacklisted'])


export const leads = pgTable("leads", {
	id: serial().primaryKey().notNull(),
	source: text().default('Manual').notNull(),
	ownerId: integer("owner_id"),
	territory: text(),
	companyName: text("company_name"),
	contactName: text("contact_name"),
	contactPhone: text("contact_phone"),
	contactEmail: text("contact_email"),
	productInterest: text("product_interest"),
	estimatedValue: numeric("estimated_value", { precision: 15, scale:  2 }),
	score: integer().default(0),
	status: text().default('New').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const clientPos = pgTable("client_pos", {
	id: serial().primaryKey().notNull(),
	quotationId: integer("quotation_id").notNull(),
	clientPoNumber: text("client_po_number").notNull(),
	clientPoFileUrl: text("client_po_file_url"),
	contractValue: numeric("contract_value", { precision: 15, scale:  2 }).notNull(),
	paymentTerms: text("payment_terms"),
	status: text().default('Active').notNull(),
	projectId: integer("project_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const quotations = pgTable("quotations", {
	id: serial().primaryKey().notNull(),
	leadId: integer("lead_id").notNull(),
	boqItems: json("boq_items").default([]),
	version: integer().default(1).notNull(),
	markupPct: numeric("markup_pct", { precision: 5, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 15, scale:  2 }),
	approvalStatus: text("approval_status").default('Draft').notNull(),
	validTill: date("valid_till"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const crmInvoices = pgTable("crm_invoices", {
	id: serial().primaryKey().notNull(),
	clientPoId: integer("client_po_id").notNull(),
	projectId: integer("project_id"),
	type: text().default('Tax').notNull(),
	amount: numeric({ precision: 15, scale:  2 }).notNull(),
	taxDetails: text("tax_details"),
	dueDate: date("due_date"),
	paymentStatus: text("payment_status").default('Unpaid').notNull(),
	paidAmount: numeric("paid_amount", { precision: 15, scale:  2 }),
	paidDate: date("paid_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
	id: serial().primaryKey().notNull(),
	sourceModule: text("source_module"),
	sourceRefId: integer("source_ref_id"),
	title: text().notNull(),
	ownerId: integer("owner_id"),
	priority: text().default('Medium').notNull(),
	dueDate: date("due_date"),
	status: text().default('Open').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const escalations = pgTable("escalations", {
	id: serial().primaryKey().notNull(),
	sourceEntityType: text("source_entity_type"),
	sourceEntityId: integer("source_entity_id"),
	projectId: integer("project_id"),
	module: text(),
	raisedBy: integer("raised_by"),
	reason: text().notNull(),
	severity: text().default('Medium').notNull(),
	assignedTo: integer("assigned_to"),
	status: text().default('Pending').notNull(),
	resolution: text(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const activities = pgTable("activities", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	wbsCode: text("wbs_code"),
	name: text().notNull(),
	plannedStart: date("planned_start"),
	plannedEnd: date("planned_end"),
	actualStart: date("actual_start"),
	actualEnd: date("actual_end"),
	dependencyIds: integer("dependency_ids").array().default([]),
	percentComplete: real("percent_complete").default(0),
	status: text().default('NotStarted').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: text().default('sales').notNull(),
	orgId: integer("org_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const budgets = pgTable("budgets", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	costHead: text("cost_head").notNull(),
	budgetedAmount: numeric("budgeted_amount", { precision: 15, scale:  2 }).default('0').notNull(),
	committedAmount: numeric("committed_amount", { precision: 15, scale:  2 }).default('0').notNull(),
	actualAmount: numeric("actual_amount", { precision: 15, scale:  2 }).default('0').notNull(),
	revisionNo: integer("revision_no").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const contractors = pgTable("contractors", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	trade: text().notNull(),
	contractValue: numeric("contract_value", { precision: 15, scale:  2 }),
	contact: text(),
	rating: real(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const dprs = pgTable("dprs", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	reportDate: date("report_date").notNull(),
	submittedBy: integer("submitted_by"),
	workSummary: text("work_summary"),
	manpowerCount: integer("manpower_count"),
	weather: text(),
	percentComplete: real("percent_complete"),
	photos: text().array().default([""]),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	category: text().notNull(),
	amount: numeric({ precision: 15, scale:  2 }).notNull(),
	incurredBy: integer("incurred_by"),
	date: date().notNull(),
	receiptUrl: text("receipt_url"),
	approvalStatus: text("approval_status").default('Pending').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const paymentMilestones = pgTable("payment_milestones", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	milestoneName: text("milestone_name").notNull(),
	triggerCondition: text("trigger_condition"),
	amount: numeric({ precision: 15, scale:  2 }).notNull(),
	dueDate: date("due_date"),
	status: text().default('Pending').notNull(),
	invoiceRef: integer("invoice_ref"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
	id: serial().primaryKey().notNull(),
	clientPoId: integer("client_po_id"),
	name: text().notNull(),
	siteLocation: text("site_location"),
	pmOwnerId: integer("pm_owner_id"),
	startDate: date("start_date"),
	plannedEnd: date("planned_end"),
	status: text().default('Planning').notNull(),
	parentProjectId: integer("parent_project_id"),
	contractValue: numeric("contract_value", { precision: 15, scale:  2 }),
	percentComplete: real("percent_complete").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const materialRequests = pgTable("material_requests", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	activityId: integer("activity_id"),
	raisedBy: integer("raised_by"),
	mrNumber: text("mr_number").notNull(),
	items: json().default([]),
	requiredByDate: date("required_by_date"),
	status: text().default('Open').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const purchaseOrders = pgTable("purchase_orders", {
	id: serial().primaryKey().notNull(),
	vendorQuotationId: integer("vendor_quotation_id").notNull(),
	vendorId: integer("vendor_id"),
	vendorName: text("vendor_name").notNull(),
	projectId: integer("project_id"),
	poNumber: text("po_number").notNull(),
	poDate: date("po_date").notNull(),
	expectedDeliveryDate: date("expected_delivery_date"),
	amount: numeric({ precision: 15, scale:  2 }).notNull(),
	deliveryTerms: text("delivery_terms"),
	status: text().default('Open').notNull(),
	warehouseId: integer("warehouse_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const vendorInvoices = pgTable("vendor_invoices", {
	id: serial().primaryKey().notNull(),
	poId: integer("po_id").notNull(),
	invoiceNumber: text("invoice_number").notNull(),
	scannedFileUrl: text("scanned_file_url"),
	invoiceAmount: numeric("invoice_amount", { precision: 15, scale:  2 }).notNull(),
	invoiceDate: date("invoice_date"),
	dueDate: date("due_date"),
	approvalStatus: text("approval_status").default('Pending').notNull(),
	creditTermDays: integer("credit_term_days").default(30),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const vendorQuotations = pgTable("vendor_quotations", {
	id: serial().primaryKey().notNull(),
	mrId: integer("mr_id").notNull(),
	vendorId: integer("vendor_id"),
	vendorName: text("vendor_name").notNull(),
	quotationNumber: text("quotation_number").notNull(),
	quotedAmount: numeric("quoted_amount", { precision: 15, scale:  2 }).notNull(),
	itemPriceBreakup: json("item_price_breakup").default([]),
	validityDate: date("validity_date"),
	quotationFileUrl: text("quotation_file_url"),
	managerRemarks: text("manager_remarks"),
	mdRemarks: text("md_remarks"),
	isRecommended: boolean("is_recommended").default(false),
	l1Status: text("l1_status").default('Pending').notNull(),
	status: text().default('Submitted').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const deliveryChallans = pgTable("delivery_challans", {
	id: serial().primaryKey().notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	projectId: integer("project_id"),
	challanNumber: text("challan_number").notNull(),
	issuedTo: text("issued_to"),
	lineItems: json("line_items").default([]),
	issuedDate: date("issued_date").notNull(),
	purpose: text().default('SiteIssue').notNull(),
	referenceDoc: text("reference_doc"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const grns = pgTable("grns", {
	id: serial().primaryKey().notNull(),
	poId: integer("po_id").notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	grnNumber: text("grn_number").notNull(),
	receivedDate: date("received_date").notNull(),
	lineItems: json("line_items").default([]),
	qcStatus: text("qc_status").default('Pending').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const inventoryAudits = pgTable("inventory_audits", {
	id: serial().primaryKey().notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	auditDate: date("audit_date").notNull(),
	auditorId: integer("auditor_id"),
	systemQty: numeric("system_qty", { precision: 12, scale:  3 }),
	physicalQty: numeric("physical_qty", { precision: 12, scale:  3 }),
	varianceQty: numeric("variance_qty", { precision: 12, scale:  3 }),
	varianceValue: numeric("variance_value", { precision: 15, scale:  2 }),
	status: text().default('Open').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const qcChecks = pgTable("qc_checks", {
	id: serial().primaryKey().notNull(),
	grnId: integer("grn_id").notNull(),
	inspectedBy: integer("inspected_by"),
	checklistJson: text("checklist_json"),
	acceptedQty: numeric("accepted_qty", { precision: 12, scale:  3 }).notNull(),
	rejectedQty: numeric("rejected_qty", { precision: 12, scale:  3 }).default('0').notNull(),
	rejectionReason: text("rejection_reason"),
	status: text().default('Passed').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const stockLedger = pgTable("stock_ledger", {
	id: serial().primaryKey().notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	itemId: integer("item_id"),
	itemName: text("item_name").notNull(),
	txnType: text("txn_type").notNull(),
	qty: numeric({ precision: 12, scale:  3 }).notNull(),
	balanceQty: numeric("balance_qty", { precision: 12, scale:  3 }).notNull(),
	refDocType: text("ref_doc_type"),
	refDocId: integer("ref_doc_id"),
	date: date().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const stockValuation = pgTable("stock_valuation", {
	id: serial().primaryKey().notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	itemId: integer("item_id"),
	itemName: text("item_name").notNull(),
	valuationMethod: text("valuation_method").default('FIFO').notNull(),
	unitValue: numeric("unit_value", { precision: 15, scale:  4 }).default('0').notNull(),
	totalValue: numeric("total_value", { precision: 15, scale:  2 }).default('0').notNull(),
	balanceQty: numeric("balance_qty", { precision: 12, scale:  3 }).default('0').notNull(),
	asOfDate: date("as_of_date").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const warehouseLocations = pgTable("warehouse_locations", {
	id: serial().primaryKey().notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	zone: text().notNull(),
	rack: text().notNull(),
	bin: text().notNull(),
	currentItemId: integer("current_item_id"),
	currentItemName: text("current_item_name"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const siteSurveys = pgTable("site_surveys", {
	id: serial().primaryKey().notNull(),
	leadId: integer("lead_id").notNull(),
	surveyedBy: integer("surveyed_by"),
	surveyDate: date("survey_date"),
	roofType: text("roof_type"),
	roofArea: real("roof_area"),
	shadowAnalysis: text("shadow_analysis"),
	gpsLat: real("gps_lat"),
	gpsLng: real("gps_lng"),
	sanctionedLoad: real("sanctioned_load"),
	avgMonthlyBill: real("avg_monthly_bill"),
	proposedCapacity: real("proposed_capacity"),
	photos: text().array().default([""]),
	structuralNotes: text("structural_notes"),
	feasibilityStatus: text("feasibility_status").default('Pending').notNull(),
	feasibilityNotes: text("feasibility_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const snagLogs = pgTable("snag_logs", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	zone: text(),
	category: text().default('Civil').notNull(),
	description: text().notNull(),
	reportedBy: integer("reported_by"),
	photoUrl: text("photo_url"),
	severity: text().default('Medium').notNull(),
	status: text().default('Open').notNull(),
	assignedTo: integer("assigned_to"),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	resolution: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const warehouses = pgTable("warehouses", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	projectId: integer("project_id"),
	location: text(),
	custodianId: integer("custodian_id"),
	capacity: text(),
	type: text().default('Site').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const designDocuments = pgTable("design_documents", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	docType: text("doc_type").default('Layout').notNull(),
	title: text().notNull(),
	version: text().default('v1').notNull(),
	fileUrl: text("file_url"),
	uploadedBy: integer("uploaded_by"),
	description: text(),
	internalStatus: text("internal_status").default('Draft').notNull(),
	internalApprovedBy: integer("internal_approved_by"),
	internalApprovedAt: timestamp("internal_approved_at", { withTimezone: true, mode: 'string' }),
	clientApprovedAt: timestamp("client_approved_at", { withTimezone: true, mode: 'string' }),
	clientApprovedBy: text("client_approved_by"),
	rejectionReason: text("rejection_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const designRevisions = pgTable("design_revisions", {
	id: serial().primaryKey().notNull(),
	docId: integer("doc_id").notNull(),
	version: text().notNull(),
	fileUrl: text("file_url"),
	changeNotes: text("change_notes"),
	revisedBy: integer("revised_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const commissioningChecklists = pgTable("commissioning_checklists", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	status: text().default('Draft').notNull(),
	commissionedOn: date("commissioned_on"),
	commissionedBy: integer("commissioned_by"),
	clientSignatoryName: text("client_signatory_name"),
	clientSignedAt: timestamp("client_signed_at", { withTimezone: true, mode: 'string' }),
	remarks: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const commissioningItems = pgTable("commissioning_items", {
	id: serial().primaryKey().notNull(),
	checklistId: integer("checklist_id").notNull(),
	category: text().default('Electrical').notNull(),
	description: text().notNull(),
	isDone: boolean("is_done").default(false).notNull(),
	doneBy: integer("done_by"),
	doneAt: timestamp("done_at", { withTimezone: true, mode: 'string' }),
	remarks: text(),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const complianceDocuments = pgTable("compliance_documents", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	docType: text("doc_type").default('DISCOM').notNull(),
	title: text().notNull(),
	fileUrl: text("file_url"),
	submittedBy: integer("submitted_by"),
	submissionDate: date("submission_date"),
	status: text().default('Draft').notNull(),
	expiryDate: date("expiry_date"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const amcContracts = pgTable("amc_contracts", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	contractNumber: text("contract_number").notNull(),
	clientName: text("client_name").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	annualValue: numeric("annual_value", { precision: 15, scale:  2 }).notNull(),
	visitFrequency: text("visit_frequency").default('Quarterly').notNull(),
	status: text().default('Active').notNull(),
	terms: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const maintenanceSchedules = pgTable("maintenance_schedules", {
	id: serial().primaryKey().notNull(),
	amcContractId: integer("amc_contract_id"),
	projectId: integer("project_id").notNull(),
	visitType: text("visit_type").default('Preventive').notNull(),
	scheduledDate: date("scheduled_date").notNull(),
	assignedTechnicianId: integer("assigned_technician_id"),
	assignedTechnicianName: text("assigned_technician_name"),
	status: text().default('Scheduled').notNull(),
	completedDate: date("completed_date"),
	workDone: text("work_done"),
	observations: text(),
	nextScheduledDate: date("next_scheduled_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const serviceTickets = pgTable("service_tickets", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	amcContractId: integer("amc_contract_id"),
	ticketNumber: text("ticket_number").notNull(),
	raisedBy: text("raised_by"),
	issueCategory: text("issue_category").default('Performance').notNull(),
	description: text().notNull(),
	priority: text().default('Medium').notNull(),
	status: text().default('Open').notNull(),
	assignedTechnicianId: integer("assigned_technician_id"),
	assignedTechnicianName: text("assigned_technician_name"),
	slaHours: integer("sla_hours").default(48),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	resolution: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const vendorContacts = pgTable("vendor_contacts", {
	id: serial().primaryKey().notNull(),
	vendorId: integer("vendor_id").notNull(),
	name: text().notNull(),
	designation: text(),
	email: text(),
	phone: varchar({ length: 20 }),
	isPrimary: boolean("is_primary").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "vendor_contacts_vendor_id_vendors_id_fk"
		}).onDelete("cascade"),
]);

export const procurementQuotations = pgTable("procurement_quotations", {
	id: serial().primaryKey().notNull(),
	referenceId: varchar("reference_id", { length: 30 }).notNull(),
	version: integer().default(1).notNull(),
	status: procQuotationStatus().default('Draft').notNull(),
	mrId: integer("mr_id"),
	vendorId: integer("vendor_id"),
	vendorSnapshotName: text("vendor_snapshot_name"),
	quotationDate: varchar("quotation_date", { length: 20 }),
	validityDate: varchar("validity_date", { length: 20 }),
	currency: varchar({ length: 5 }).default('INR'),
	paymentTerms: text("payment_terms"),
	deliveryTerms: text("delivery_terms"),
	deliveryLeadDays: integer("delivery_lead_days"),
	warrantyMonths: integer("warranty_months"),
	subtotal: numeric({ precision: 16, scale:  2 }).default('0'),
	totalDiscount: numeric("total_discount", { precision: 16, scale:  2 }).default('0'),
	totalGst: numeric("total_gst", { precision: 16, scale:  2 }).default('0'),
	freightCharges: numeric("freight_charges", { precision: 14, scale:  2 }).default('0'),
	otherCharges: numeric("other_charges", { precision: 14, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 16, scale:  2 }).default('0'),
	fileUrl: text("file_url"),
	fileOriginalName: text("file_original_name"),
	vendorRemarks: text("vendor_remarks"),
	internalNotes: text("internal_notes"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	submittedBy: integer("submitted_by"),
	submittedByName: text("submitted_by_name"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	reviewedBy: integer("reviewed_by"),
	reviewedByName: text("reviewed_by_name"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	approvedBy: integer("approved_by"),
	approvedByName: text("approved_by_name"),
	rejectedAt: timestamp("rejected_at", { mode: 'string' }),
	rejectedBy: integer("rejected_by"),
	rejectedByName: text("rejected_by_name"),
	approvalRemarks: text("approval_remarks"),
	isL1: boolean("is_l1").default(false),
	isRecommended: boolean("is_recommended").default(false),
	recommendationNotes: text("recommendation_notes"),
	poGenerated: boolean("po_generated").default(false),
	createdBy: integer("created_by"),
	createdByName: text("created_by_name"),
	updatedBy: integer("updated_by"),
	updatedByName: text("updated_by_name"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	lockedAt: timestamp("locked_at", { mode: 'string' }),
	lockedBy: integer("locked_by"),
	reopenedAt: timestamp("reopened_at", { mode: 'string' }),
	reopenedBy: integer("reopened_by"),
	reopenReason: text("reopen_reason"),
	approvalRequestId: integer("approval_request_id"),
}, (table) => [
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "procurement_quotations_vendor_id_vendors_id_fk"
		}),
	unique("procurement_quotations_reference_id_unique").on(table.referenceId),
]);

export const procQuotationItems = pgTable("proc_quotation_items", {
	id: serial().primaryKey().notNull(),
	quotationId: integer("quotation_id").notNull(),
	lineNo: integer("line_no").notNull(),
	materialId: integer("material_id"),
	materialCode: varchar("material_code", { length: 30 }),
	materialName: text("material_name").notNull(),
	description: text(),
	uom: text().default('Nos'),
	hsnSacCode: varchar("hsn_sac_code", { length: 20 }),
	brand: text(),
	qty: numeric({ precision: 12, scale:  3 }).notNull(),
	unitPrice: numeric("unit_price", { precision: 14, scale:  2 }).notNull(),
	discountPct: numeric("discount_pct", { precision: 5, scale:  2 }).default('0'),
	discountAmount: numeric("discount_amount", { precision: 14, scale:  2 }).default('0'),
	taxableAmount: numeric("taxable_amount", { precision: 14, scale:  2 }).default('0'),
	gstRate: numeric("gst_rate", { precision: 5, scale:  2 }).default('18'),
	cgstAmount: numeric("cgst_amount", { precision: 14, scale:  2 }).default('0'),
	sgstAmount: numeric("sgst_amount", { precision: 14, scale:  2 }).default('0'),
	igstAmount: numeric("igst_amount", { precision: 14, scale:  2 }).default('0'),
	totalGst: numeric("total_gst", { precision: 14, scale:  2 }).default('0'),
	lineTotal: numeric("line_total", { precision: 14, scale:  2 }).default('0'),
	deliveryDays: integer("delivery_days"),
	remarks: text(),
}, (table) => [
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "proc_quotation_items_material_id_materials_id_fk"
		}),
	foreignKey({
			columns: [table.quotationId],
			foreignColumns: [procurementQuotations.id],
			name: "proc_quotation_items_quotation_id_procurement_quotations_id_fk"
		}).onDelete("cascade"),
]);

export const quotationAuditLogs = pgTable("quotation_audit_logs", {
	id: serial().primaryKey().notNull(),
	quotationId: integer("quotation_id").notNull(),
	action: auditAction().notNull(),
	performedBy: integer("performed_by"),
	performedByName: text("performed_by_name").notNull(),
	performedByRole: text("performed_by_role"),
	oldValues: jsonb("old_values"),
	newValues: jsonb("new_values"),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.quotationId],
			foreignColumns: [procurementQuotations.id],
			name: "quotation_audit_logs_quotation_id_procurement_quotations_id_fk"
		}).onDelete("cascade"),
]);

export const quotationVersions = pgTable("quotation_versions", {
	id: serial().primaryKey().notNull(),
	quotationId: integer("quotation_id").notNull(),
	version: integer().notNull(),
	snapshot: jsonb().notNull(),
	changedBy: integer("changed_by"),
	changedByName: text("changed_by_name"),
	changeSummary: text("change_summary"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.quotationId],
			foreignColumns: [procurementQuotations.id],
			name: "quotation_versions_quotation_id_procurement_quotations_id_fk"
		}).onDelete("cascade"),
]);

export const procPoItems = pgTable("proc_po_items", {
	id: serial().primaryKey().notNull(),
	poId: integer("po_id").notNull(),
	lineNo: integer("line_no").notNull(),
	materialId: integer("material_id"),
	materialCode: varchar("material_code", { length: 30 }),
	materialName: text("material_name").notNull(),
	description: text(),
	uom: text().default('Nos'),
	hsnSacCode: varchar("hsn_sac_code", { length: 20 }),
	brand: text(),
	qty: numeric({ precision: 12, scale:  3 }).notNull(),
	unitPrice: numeric("unit_price", { precision: 14, scale:  2 }).notNull(),
	discountPct: numeric("discount_pct", { precision: 5, scale:  2 }).default('0'),
	discountAmount: numeric("discount_amount", { precision: 14, scale:  2 }).default('0'),
	taxableAmount: numeric("taxable_amount", { precision: 14, scale:  2 }).default('0'),
	gstRate: numeric("gst_rate", { precision: 5, scale:  2 }).default('18'),
	totalGst: numeric("total_gst", { precision: 14, scale:  2 }).default('0'),
	lineTotal: numeric("line_total", { precision: 14, scale:  2 }).default('0'),
	deliveredQty: numeric("delivered_qty", { precision: 12, scale:  3 }).default('0'),
	remarks: text(),
}, (table) => [
	index("po_item_po_id_idx").using("btree", table.poId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.poId],
			foreignColumns: [procurementPos.id],
			name: "proc_po_items_po_id_procurement_pos_id_fk"
		}).onDelete("cascade"),
]);

export const vendors = pgTable("vendors", {
	id: serial().primaryKey().notNull(),
	code: varchar({ length: 20 }),
	name: text().notNull(),
	tradeName: text("trade_name"),
	status: vendorStatus().default('Active').notNull(),
	gstin: varchar({ length: 20 }),
	pan: varchar({ length: 15 }),
	gstRegisteredState: text("gst_registered_state"),
	gstStateCode: varchar("gst_state_code", { length: 4 }),
	isMsme: boolean("is_msme").default(false),
	msmeNumber: varchar("msme_number", { length: 30 }),
	billingAddress: text("billing_address"),
	billingCity: text("billing_city"),
	billingState: text("billing_state"),
	billingPincode: varchar("billing_pincode", { length: 10 }),
	billingCountry: text("billing_country").default('India'),
	primaryEmail: text("primary_email"),
	primaryPhone: varchar("primary_phone", { length: 20 }),
	website: text(),
	bankName: text("bank_name"),
	bankBranch: text("bank_branch"),
	bankAccountNumber: varchar("bank_account_number", { length: 30 }),
	bankIfsc: varchar("bank_ifsc", { length: 15 }),
	bankAccountType: text("bank_account_type"),
	upiId: text("upi_id"),
	paymentTerms: text("payment_terms"),
	creditLimit: text("credit_limit"),
	tags: text().array(),
	notes: text(),
	createdBy: integer("created_by"),
	updatedBy: integer("updated_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("vendors_code_unique").on(table.code),
]);

export const materialCategories = pgTable("material_categories", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	code: varchar({ length: 20 }),
	description: text(),
	parentId: integer("parent_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("material_categories_name_unique").on(table.name),
]);

export const procurementPos = pgTable("procurement_pos", {
	id: serial().primaryKey().notNull(),
	poNumber: varchar("po_number", { length: 30 }).notNull(),
	quotationId: integer("quotation_id"),
	vendorId: integer("vendor_id"),
	vendorName: text("vendor_name").notNull(),
	vendorGstin: varchar("vendor_gstin", { length: 20 }),
	vendorAddress: text("vendor_address"),
	vendorContact: text("vendor_contact"),
	status: procPoStatus().default('Draft').notNull(),
	poDate: varchar("po_date", { length: 20 }),
	deliveryDeadline: varchar("delivery_deadline", { length: 20 }),
	deliveryAddress: text("delivery_address"),
	paymentTerms: text("payment_terms"),
	warrantyMonths: integer("warranty_months"),
	freightCharges: numeric("freight_charges", { precision: 14, scale:  2 }).default('0'),
	otherCharges: numeric("other_charges", { precision: 14, scale:  2 }).default('0'),
	subtotal: numeric({ precision: 16, scale:  2 }).default('0'),
	totalGst: numeric("total_gst", { precision: 16, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 16, scale:  2 }).default('0'),
	specialTerms: text("special_terms"),
	internalNotes: text("internal_notes"),
	approvedBy: integer("approved_by"),
	approvedByName: text("approved_by_name"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	acknowledgedAt: timestamp("acknowledged_at", { mode: 'string' }),
	closedAt: timestamp("closed_at", { mode: 'string' }),
	createdBy: integer("created_by"),
	createdByName: text("created_by_name"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	vendorDispatchRef: varchar("vendor_dispatch_ref", { length: 50 }),
	trackingNumber: varchar("tracking_number", { length: 50 }),
	dispatchedAt: timestamp("dispatched_at", { mode: 'string' }),
	expectedDeliveryDate: varchar("expected_delivery_date", { length: 20 }),
}, (table) => [
	index("po_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("po_status_created_at_idx").using("btree", table.status.asc().nullsLast().op("enum_ops"), table.createdAt.asc().nullsLast().op("enum_ops")),
	index("po_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("po_vendor_id_idx").using("btree", table.vendorId.asc().nullsLast().op("int4_ops")),
	index("po_vendor_name_idx").using("btree", table.vendorName.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.quotationId],
			foreignColumns: [procurementQuotations.id],
			name: "procurement_pos_quotation_id_procurement_quotations_id_fk"
		}),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "procurement_pos_vendor_id_vendors_id_fk"
		}),
	unique("procurement_pos_po_number_unique").on(table.poNumber),
]);

export const procGrns = pgTable("proc_grns", {
	id: serial().primaryKey().notNull(),
	grnNumber: varchar("grn_number", { length: 30 }).notNull(),
	poId: integer("po_id").notNull(),
	vendorId: integer("vendor_id"),
	vendorName: text("vendor_name").notNull(),
	status: procGrnStatus().default('Draft').notNull(),
	deliveryDate: varchar("delivery_date", { length: 20 }),
	vehicleNumber: varchar("vehicle_number", { length: 30 }),
	dcNumber: varchar("dc_number", { length: 50 }),
	dcDate: varchar("dc_date", { length: 20 }),
	receivedBy: integer("received_by"),
	receivedByName: text("received_by_name"),
	receivedAt: timestamp("received_at", { mode: 'string' }),
	inspectedBy: integer("inspected_by"),
	inspectedByName: text("inspected_by_name"),
	inspectedAt: timestamp("inspected_at", { mode: 'string' }),
	approvedBy: integer("approved_by"),
	approvedByName: text("approved_by_name"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	rejectedBy: integer("rejected_by"),
	rejectedByName: text("rejected_by_name"),
	rejectedAt: timestamp("rejected_at", { mode: 'string' }),
	approvalRemarks: text("approval_remarks"),
	totalOrderedQty: numeric("total_ordered_qty", { precision: 12, scale:  3 }).default('0'),
	totalReceivedQty: numeric("total_received_qty", { precision: 12, scale:  3 }).default('0'),
	totalAcceptedQty: numeric("total_accepted_qty", { precision: 12, scale:  3 }).default('0'),
	totalRejectedQty: numeric("total_rejected_qty", { precision: 12, scale:  3 }).default('0'),
	totalAcceptedValue: numeric("total_accepted_value", { precision: 16, scale:  2 }).default('0'),
	remarks: text(),
	internalNotes: text("internal_notes"),
	createdBy: integer("created_by"),
	createdByName: text("created_by_name"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("grn_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("grn_po_id_idx").using("btree", table.poId.asc().nullsLast().op("int4_ops")),
	index("grn_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("grn_vendor_id_idx").using("btree", table.vendorId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.poId],
			foreignColumns: [procurementPos.id],
			name: "proc_grns_po_id_procurement_pos_id_fk"
		}),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "proc_grns_vendor_id_vendors_id_fk"
		}),
	unique("proc_grns_grn_number_unique").on(table.grnNumber),
]);

export const procGrnItems = pgTable("proc_grn_items", {
	id: serial().primaryKey().notNull(),
	grnId: integer("grn_id").notNull(),
	poItemId: integer("po_item_id"),
	lineNo: integer("line_no").notNull(),
	materialId: integer("material_id"),
	materialCode: varchar("material_code", { length: 30 }),
	materialName: text("material_name").notNull(),
	description: text(),
	uom: text().default('Nos'),
	hsnSacCode: varchar("hsn_sac_code", { length: 20 }),
	orderedQty: numeric("ordered_qty", { precision: 12, scale:  3 }).default('0'),
	receivedQty: numeric("received_qty", { precision: 12, scale:  3 }).default('0'),
	acceptedQty: numeric("accepted_qty", { precision: 12, scale:  3 }).default('0'),
	rejectedQty: numeric("rejected_qty", { precision: 12, scale:  3 }).default('0'),
	damagedQty: numeric("damaged_qty", { precision: 12, scale:  3 }).default('0'),
	excessQty: numeric("excess_qty", { precision: 12, scale:  3 }).default('0'),
	shortQty: numeric("short_qty", { precision: 12, scale:  3 }).default('0'),
	qcStatus: procGrnItemQcStatus("qc_status").default('Pending'),
	rejectionReason: text("rejection_reason"),
	itemRemarks: text("item_remarks"),
	unitPrice: numeric("unit_price", { precision: 14, scale:  2 }).default('0'),
	acceptedValue: numeric("accepted_value", { precision: 14, scale:  2 }).default('0'),
}, (table) => [
	index("grn_item_grn_id_idx").using("btree", table.grnId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.grnId],
			foreignColumns: [procGrns.id],
			name: "proc_grn_items_grn_id_proc_grns_id_fk"
		}).onDelete("cascade"),
]);

export const procInvoices = pgTable("proc_invoices", {
	id: serial().primaryKey().notNull(),
	invoiceNumber: varchar("invoice_number", { length: 30 }).notNull(),
	poId: integer("po_id").notNull(),
	grnId: integer("grn_id"),
	vendorId: integer("vendor_id"),
	vendorName: text("vendor_name").notNull(),
	vendorInvoiceNumber: varchar("vendor_invoice_number", { length: 50 }),
	vendorInvoiceDate: varchar("vendor_invoice_date", { length: 20 }),
	status: procInvoiceStatus().default('Draft').notNull(),
	matchStatus: procInvoiceMatchStatus("match_status").default('Matched'),
	mismatchDetails: text("mismatch_details"),
	mismatchApprovedBy: integer("mismatch_approved_by"),
	mismatchApprovedByName: text("mismatch_approved_by_name"),
	mismatchApprovedAt: timestamp("mismatch_approved_at", { mode: 'string' }),
	subtotal: numeric({ precision: 16, scale:  2 }).default('0'),
	totalGst: numeric("total_gst", { precision: 16, scale:  2 }).default('0'),
	freightCharges: numeric("freight_charges", { precision: 14, scale:  2 }).default('0'),
	otherCharges: numeric("other_charges", { precision: 14, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 16, scale:  2 }).default('0'),
	tdsAmount: numeric("tds_amount", { precision: 14, scale:  2 }).default('0'),
	netPayable: numeric("net_payable", { precision: 16, scale:  2 }).default('0'),
	paymentTerms: text("payment_terms"),
	dueDate: varchar("due_date", { length: 20 }),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	submittedBy: integer("submitted_by"),
	submittedByName: text("submitted_by_name"),
	approvedBy: integer("approved_by"),
	approvedByName: text("approved_by_name"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	rejectedBy: integer("rejected_by"),
	rejectedByName: text("rejected_by_name"),
	rejectedAt: timestamp("rejected_at", { mode: 'string' }),
	approvalRemarks: text("approval_remarks"),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	paidBy: integer("paid_by"),
	paidByName: text("paid_by_name"),
	paymentReference: varchar("payment_reference", { length: 100 }),
	paymentMode: varchar("payment_mode", { length: 30 }),
	internalNotes: text("internal_notes"),
	createdBy: integer("created_by"),
	createdByName: text("created_by_name"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("inv_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("inv_match_status_idx").using("btree", table.matchStatus.asc().nullsLast().op("enum_ops")),
	index("inv_po_id_idx").using("btree", table.poId.asc().nullsLast().op("int4_ops")),
	index("inv_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("inv_vendor_id_idx").using("btree", table.vendorId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.grnId],
			foreignColumns: [procGrns.id],
			name: "proc_invoices_grn_id_proc_grns_id_fk"
		}),
	foreignKey({
			columns: [table.poId],
			foreignColumns: [procurementPos.id],
			name: "proc_invoices_po_id_procurement_pos_id_fk"
		}),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "proc_invoices_vendor_id_vendors_id_fk"
		}),
	unique("proc_invoices_invoice_number_unique").on(table.invoiceNumber),
]);

export const procInvoiceAuditLogs = pgTable("proc_invoice_audit_logs", {
	id: serial().primaryKey().notNull(),
	invoiceId: integer("invoice_id").notNull(),
	action: varchar({ length: 50 }).notNull(),
	performedBy: integer("performed_by"),
	performedByName: text("performed_by_name"),
	remarks: text(),
	oldValues: json("old_values"),
	newValues: json("new_values"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("inv_audit_invoice_id_idx").using("btree", table.invoiceId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [procInvoices.id],
			name: "proc_invoice_audit_logs_invoice_id_proc_invoices_id_fk"
		}).onDelete("cascade"),
]);

export const procInvoiceItems = pgTable("proc_invoice_items", {
	id: serial().primaryKey().notNull(),
	invoiceId: integer("invoice_id").notNull(),
	poItemId: integer("po_item_id"),
	grnItemId: integer("grn_item_id"),
	lineNo: integer("line_no").notNull(),
	materialName: text("material_name").notNull(),
	materialCode: varchar("material_code", { length: 30 }),
	uom: text().default('Nos'),
	hsnSacCode: varchar("hsn_sac_code", { length: 20 }),
	orderedQty: numeric("ordered_qty", { precision: 12, scale:  3 }).default('0'),
	receivedQty: numeric("received_qty", { precision: 12, scale:  3 }).default('0'),
	invoicedQty: numeric("invoiced_qty", { precision: 12, scale:  3 }).default('0'),
	unitPrice: numeric("unit_price", { precision: 14, scale:  2 }).default('0'),
	discountPct: numeric("discount_pct", { precision: 5, scale:  2 }).default('0'),
	taxableAmount: numeric("taxable_amount", { precision: 14, scale:  2 }).default('0'),
	gstRate: numeric("gst_rate", { precision: 5, scale:  2 }).default('18'),
	gstAmount: numeric("gst_amount", { precision: 14, scale:  2 }).default('0'),
	lineTotal: numeric("line_total", { precision: 14, scale:  2 }).default('0'),
	isMatched: boolean("is_matched").default(true),
	mismatchNote: text("mismatch_note"),
}, (table) => [
	index("inv_item_invoice_id_idx").using("btree", table.invoiceId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [procInvoices.id],
			name: "proc_invoice_items_invoice_id_proc_invoices_id_fk"
		}).onDelete("cascade"),
]);

export const procPoAuditLogs = pgTable("proc_po_audit_logs", {
	id: serial().primaryKey().notNull(),
	poId: integer("po_id").notNull(),
	action: varchar({ length: 50 }).notNull(),
	performedBy: integer("performed_by"),
	performedByName: text("performed_by_name"),
	remarks: text(),
	oldValues: json("old_values"),
	newValues: json("new_values"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.poId],
			foreignColumns: [procurementPos.id],
			name: "proc_po_audit_logs_po_id_procurement_pos_id_fk"
		}).onDelete("cascade"),
]);

export const procGrnAuditLogs = pgTable("proc_grn_audit_logs", {
	id: serial().primaryKey().notNull(),
	grnId: integer("grn_id").notNull(),
	action: varchar({ length: 50 }).notNull(),
	performedBy: integer("performed_by"),
	performedByName: text("performed_by_name"),
	remarks: text(),
	oldValues: json("old_values"),
	newValues: json("new_values"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("grn_audit_grn_id_idx").using("btree", table.grnId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.grnId],
			foreignColumns: [procGrns.id],
			name: "proc_grn_audit_logs_grn_id_proc_grns_id_fk"
		}).onDelete("cascade"),
]);

export const notifications = pgTable("notifications", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	type: notificationType().default('info').notNull(),
	title: text().notNull(),
	message: text().notNull(),
	entityType: text("entity_type"),
	entityId: integer("entity_id"),
	entityRef: text("entity_ref"),
	isRead: boolean("is_read").default(false).notNull(),
	actionUrl: text("action_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const stockTransfers = pgTable("stock_transfers", {
	id: serial().primaryKey().notNull(),
	transferNumber: varchar("transfer_number", { length: 30 }).notNull(),
	fromWarehouseId: integer("from_warehouse_id").notNull(),
	fromWarehouseName: text("from_warehouse_name").notNull(),
	toWarehouseId: integer("to_warehouse_id").notNull(),
	toWarehouseName: text("to_warehouse_name").notNull(),
	status: stockTransferStatus().default('Draft').notNull(),
	reason: text(),
	transferDate: varchar("transfer_date", { length: 20 }),
	completedDate: varchar("completed_date", { length: 20 }),
	remarks: text(),
	initiatedBy: integer("initiated_by"),
	initiatedByName: text("initiated_by_name"),
	approvedBy: integer("approved_by"),
	approvedByName: text("approved_by_name"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	completedBy: integer("completed_by"),
	completedByName: text("completed_by_name"),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	totalItems: integer("total_items").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.fromWarehouseId],
			foreignColumns: [warehouses.id],
			name: "stock_transfers_from_warehouse_id_warehouses_id_fk"
		}),
	foreignKey({
			columns: [table.toWarehouseId],
			foreignColumns: [warehouses.id],
			name: "stock_transfers_to_warehouse_id_warehouses_id_fk"
		}),
	unique("stock_transfers_transfer_number_unique").on(table.transferNumber),
]);

export const stockTransferItems = pgTable("stock_transfer_items", {
	id: serial().primaryKey().notNull(),
	transferId: integer("transfer_id").notNull(),
	lineNo: integer("line_no").notNull(),
	materialId: integer("material_id"),
	materialCode: varchar("material_code", { length: 30 }),
	materialName: text("material_name").notNull(),
	uom: text().default('Nos'),
	qty: numeric({ precision: 12, scale:  3 }).default('0'),
	fromBin: varchar("from_bin", { length: 50 }),
	toBin: varchar("to_bin", { length: 50 }),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.transferId],
			foreignColumns: [stockTransfers.id],
			name: "stock_transfer_items_transfer_id_stock_transfers_id_fk"
		}).onDelete("cascade"),
]);

export const materials = pgTable("materials", {
	id: serial().primaryKey().notNull(),
	code: varchar({ length: 30 }),
	name: text().notNull(),
	description: text(),
	categoryId: integer("category_id"),
	uom: uom().default('Nos').notNull(),
	hsnSacCode: varchar("hsn_sac_code", { length: 20 }),
	gstRate: numeric("gst_rate", { precision: 5, scale:  2 }).default('18'),
	cessRate: numeric("cess_rate", { precision: 5, scale:  2 }).default('0'),
	basePrice: numeric("base_price", { precision: 14, scale:  2 }),
	lastPurchasePrice: numeric("last_purchase_price", { precision: 14, scale:  2 }),
	currency: varchar({ length: 5 }).default('INR'),
	brand: text(),
	model: text(),
	specifications: text(),
	minOrderQty: numeric("min_order_qty", { precision: 12, scale:  3 }),
	leadTimeDays: integer("lead_time_days"),
	isActive: boolean("is_active").default(true),
	createdBy: integer("created_by"),
	updatedBy: integer("updated_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	minStockLevel: numeric("min_stock_level", { precision: 12, scale:  3 }),
	maxStockLevel: numeric("max_stock_level", { precision: 12, scale:  3 }),
	reorderPoint: numeric("reorder_point", { precision: 12, scale:  3 }),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [materialCategories.id],
			name: "materials_category_id_material_categories_id_fk"
		}),
	unique("materials_code_unique").on(table.code),
]);

export const grnReturns = pgTable("grn_returns", {
	id: serial().primaryKey().notNull(),
	returnNumber: varchar("return_number", { length: 30 }).notNull(),
	grnId: integer("grn_id").notNull(),
	poId: integer("po_id"),
	vendorId: integer("vendor_id"),
	vendorName: text("vendor_name").notNull(),
	status: grnReturnStatus().default('Draft').notNull(),
	returnReason: text("return_reason").notNull(),
	returnType: text("return_type").default('Rejection').notNull(),
	returnDate: varchar("return_date", { length: 20 }),
	dispatchDate: varchar("dispatch_date", { length: 20 }),
	creditNoteNumber: varchar("credit_note_number", { length: 50 }),
	creditNoteDate: varchar("credit_note_date", { length: 20 }),
	creditNoteAmount: numeric("credit_note_amount", { precision: 14, scale:  2 }).default('0'),
	totalReturnQty: numeric("total_return_qty", { precision: 12, scale:  3 }).default('0'),
	totalReturnValue: numeric("total_return_value", { precision: 14, scale:  2 }).default('0'),
	remarks: text(),
	createdBy: integer("created_by"),
	createdByName: text("created_by_name"),
	submittedBy: integer("submitted_by"),
	submittedByName: text("submitted_by_name"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	approvedBy: integer("approved_by"),
	approvedByName: text("approved_by_name"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	approvalRemarks: text("approval_remarks"),
	dispatchedBy: integer("dispatched_by"),
	dispatchedByName: text("dispatched_by_name"),
	dispatchedAt: timestamp("dispatched_at", { mode: 'string' }),
	closedBy: integer("closed_by"),
	closedByName: text("closed_by_name"),
	closedAt: timestamp("closed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.grnId],
			foreignColumns: [procGrns.id],
			name: "grn_returns_grn_id_proc_grns_id_fk"
		}),
	foreignKey({
			columns: [table.poId],
			foreignColumns: [procurementPos.id],
			name: "grn_returns_po_id_procurement_pos_id_fk"
		}),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "grn_returns_vendor_id_vendors_id_fk"
		}),
	unique("grn_returns_return_number_unique").on(table.returnNumber),
]);

export const grnReturnAuditLogs = pgTable("grn_return_audit_logs", {
	id: serial().primaryKey().notNull(),
	returnId: integer("return_id").notNull(),
	action: varchar({ length: 50 }).notNull(),
	performedBy: integer("performed_by"),
	performedByName: text("performed_by_name"),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.returnId],
			foreignColumns: [grnReturns.id],
			name: "grn_return_audit_logs_return_id_grn_returns_id_fk"
		}).onDelete("cascade"),
]);

export const grnReturnItems = pgTable("grn_return_items", {
	id: serial().primaryKey().notNull(),
	returnId: integer("return_id").notNull(),
	grnItemId: integer("grn_item_id"),
	lineNo: integer("line_no").notNull(),
	materialId: integer("material_id"),
	materialCode: varchar("material_code", { length: 30 }),
	materialName: text("material_name").notNull(),
	uom: text().default('Nos'),
	returnQty: numeric("return_qty", { precision: 12, scale:  3 }).default('0'),
	unitPrice: numeric("unit_price", { precision: 14, scale:  2 }).default('0'),
	returnValue: numeric("return_value", { precision: 14, scale:  2 }).default('0'),
	rejectionReason: text("rejection_reason"),
	batchLotNumber: varchar("batch_lot_number", { length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.returnId],
			foreignColumns: [grnReturns.id],
			name: "grn_return_items_return_id_grn_returns_id_fk"
		}).onDelete("cascade"),
]);

export const approvalDelegates = pgTable("approval_delegates", {
	id: serial().primaryKey().notNull(),
	fromUserId: integer("from_user_id").notNull(),
	toUserId: integer("to_user_id").notNull(),
	module: text(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.fromUserId],
			foreignColumns: [users.id],
			name: "approval_delegates_from_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.toUserId],
			foreignColumns: [users.id],
			name: "approval_delegates_to_user_id_users_id_fk"
		}),
]);

export const approvalActions = pgTable("approval_actions", {
	id: serial().primaryKey().notNull(),
	requestId: integer("request_id").notNull(),
	stepId: integer("step_id"),
	actorId: integer("actor_id"),
	actionType: text("action_type").notNull(),
	comment: text(),
	attachments: jsonb(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [users.id],
			name: "approval_actions_actor_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [approvalRequests.id],
			name: "approval_actions_request_id_approval_requests_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.stepId],
			foreignColumns: [approvalRequestSteps.id],
			name: "approval_actions_step_id_approval_request_steps_id_fk"
		}),
]);

export const approvalRequests = pgTable("approval_requests", {
	id: serial().primaryKey().notNull(),
	workflowId: integer("workflow_id"),
	refNumber: text("ref_number").notNull(),
	title: text().notNull(),
	description: text(),
	module: text().default('other').notNull(),
	entityType: text("entity_type"),
	entityRef: text("entity_ref"),
	entityUrl: text("entity_url"),
	requesterId: integer("requester_id").notNull(),
	priority: text().default('medium').notNull(),
	status: text().default('pending').notNull(),
	currentStep: integer("current_step").default(1).notNull(),
	totalSteps: integer("total_steps").default(1).notNull(),
	slaDeadline: timestamp("sla_deadline", { mode: 'string' }),
	notes: text(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.requesterId],
			foreignColumns: [users.id],
			name: "approval_requests_requester_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.workflowId],
			foreignColumns: [approvalWorkflows.id],
			name: "approval_requests_workflow_id_approval_workflows_id_fk"
		}),
]);

export const approvalRequestSteps = pgTable("approval_request_steps", {
	id: serial().primaryKey().notNull(),
	requestId: integer("request_id").notNull(),
	stepOrder: integer("step_order").notNull(),
	name: text().notNull(),
	stepType: text("step_type").default('sequential').notNull(),
	approverType: text("approver_type").default('role').notNull(),
	approverRole: text("approver_role"),
	approverUserId: integer("approver_user_id"),
	status: text().default('pending').notNull(),
	actedById: integer("acted_by_id"),
	delegatedToId: integer("delegated_to_id"),
	actedAt: timestamp("acted_at", { mode: 'string' }),
	slaDeadline: timestamp("sla_deadline", { mode: 'string' }),
	isEscalated: boolean("is_escalated").default(false),
	escalatedAt: timestamp("escalated_at", { mode: 'string' }),
	comment: text(),
}, (table) => [
	foreignKey({
			columns: [table.actedById],
			foreignColumns: [users.id],
			name: "approval_request_steps_acted_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.delegatedToId],
			foreignColumns: [users.id],
			name: "approval_request_steps_delegated_to_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [approvalRequests.id],
			name: "approval_request_steps_request_id_approval_requests_id_fk"
		}).onDelete("cascade"),
]);

export const approvalWorkflows = pgTable("approval_workflows", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	module: text().default('other').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdById: integer("created_by_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "approval_workflows_created_by_id_users_id_fk"
		}),
]);

export const approvalWorkflowSteps = pgTable("approval_workflow_steps", {
	id: serial().primaryKey().notNull(),
	workflowId: integer("workflow_id").notNull(),
	stepOrder: integer("step_order").notNull(),
	name: text().notNull(),
	stepType: text("step_type").default('sequential').notNull(),
	approverType: text("approver_type").default('role').notNull(),
	approverRole: text("approver_role"),
	approverUserId: integer("approver_user_id"),
	slaHours: integer("sla_hours").default(24),
	escalateAfterHours: integer("escalate_after_hours"),
	escalateToRole: text("escalate_to_role"),
	isRequired: boolean("is_required").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.approverUserId],
			foreignColumns: [users.id],
			name: "approval_workflow_steps_approver_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.workflowId],
			foreignColumns: [approvalWorkflows.id],
			name: "approval_workflow_steps_workflow_id_approval_workflows_id_fk"
		}).onDelete("cascade"),
]);

export const materialAuditLogs = pgTable("material_audit_logs", {
	id: serial().primaryKey().notNull(),
	materialId: integer("material_id").notNull(),
	action: varchar({ length: 50 }).notNull(),
	fieldChanged: text("field_changed"),
	oldValue: text("old_value"),
	newValue: text("new_value"),
	performedBy: integer("performed_by"),
	performedByName: text("performed_by_name"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "material_audit_logs_material_id_materials_id_fk"
		}).onDelete("cascade"),
]);

export const materialSuppliers = pgTable("material_suppliers", {
	id: serial().primaryKey().notNull(),
	materialId: integer("material_id").notNull(),
	vendorId: integer("vendor_id"),
	vendorName: text("vendor_name").notNull(),
	supplierPartCode: varchar("supplier_part_code", { length: 100 }),
	unitPrice: numeric("unit_price", { precision: 14, scale:  2 }),
	currency: varchar({ length: 5 }).default('INR'),
	leadTimeDays: integer("lead_time_days"),
	minOrderQty: numeric("min_order_qty", { precision: 12, scale:  3 }),
	isPreferred: boolean("is_preferred").default(false),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "material_suppliers_material_id_materials_id_fk"
		}).onDelete("cascade"),
]);

export const rolePermissions = pgTable("role_permissions", {
	id: serial().primaryKey().notNull(),
	role: varchar({ length: 50 }).notNull(),
	module: varchar({ length: 100 }).notNull(),
	action: varchar({ length: 50 }).notNull(),
	allowed: boolean().default(true).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: integer("updated_by"),
}, (table) => [
	uniqueIndex("role_perm_uniq").using("btree", table.role.asc().nullsLast().op("text_ops"), table.module.asc().nullsLast().op("text_ops"), table.action.asc().nullsLast().op("text_ops")),
]);

export const quotationAttachments = pgTable("quotation_attachments", {
	id: serial().primaryKey().notNull(),
	quotationId: integer("quotation_id").notNull(),
	fileName: text("file_name").notNull(),
	objectPath: text("object_path").notNull(),
	fileSize: integer("file_size"),
	mimeType: text("mime_type"),
	uploadedBy: integer("uploaded_by"),
	uploadedByName: text("uploaded_by_name"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.quotationId],
			foreignColumns: [procurementQuotations.id],
			name: "quotation_attachments_quotation_id_procurement_quotations_id_fk"
		}).onDelete("cascade"),
]);
