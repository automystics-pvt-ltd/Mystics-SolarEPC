import { relations } from "drizzle-orm/relations";
import { vendors, vendorContacts, procurementQuotations, materials, procQuotationItems, quotationAuditLogs, quotationVersions, procurementPos, procPoItems, procGrns, procGrnItems, procInvoices, procInvoiceAuditLogs, procInvoiceItems, procPoAuditLogs, procGrnAuditLogs, warehouses, stockTransfers, stockTransferItems, materialCategories, grnReturns, grnReturnAuditLogs, grnReturnItems, users, approvalDelegates, approvalActions, approvalRequests, approvalRequestSteps, approvalWorkflows, approvalWorkflowSteps, materialAuditLogs, materialSuppliers, quotationAttachments } from "./schema";

export const vendorContactsRelations = relations(vendorContacts, ({one}) => ({
	vendor: one(vendors, {
		fields: [vendorContacts.vendorId],
		references: [vendors.id]
	}),
}));

export const vendorsRelations = relations(vendors, ({many}) => ({
	vendorContacts: many(vendorContacts),
	procurementQuotations: many(procurementQuotations),
	procurementPos: many(procurementPos),
	procGrns: many(procGrns),
	procInvoices: many(procInvoices),
	grnReturns: many(grnReturns),
}));

export const procurementQuotationsRelations = relations(procurementQuotations, ({one, many}) => ({
	vendor: one(vendors, {
		fields: [procurementQuotations.vendorId],
		references: [vendors.id]
	}),
	procQuotationItems: many(procQuotationItems),
	quotationAuditLogs: many(quotationAuditLogs),
	quotationVersions: many(quotationVersions),
	procurementPos: many(procurementPos),
	quotationAttachments: many(quotationAttachments),
}));

export const procQuotationItemsRelations = relations(procQuotationItems, ({one}) => ({
	material: one(materials, {
		fields: [procQuotationItems.materialId],
		references: [materials.id]
	}),
	procurementQuotation: one(procurementQuotations, {
		fields: [procQuotationItems.quotationId],
		references: [procurementQuotations.id]
	}),
}));

export const materialsRelations = relations(materials, ({one, many}) => ({
	procQuotationItems: many(procQuotationItems),
	materialCategory: one(materialCategories, {
		fields: [materials.categoryId],
		references: [materialCategories.id]
	}),
	materialAuditLogs: many(materialAuditLogs),
	materialSuppliers: many(materialSuppliers),
}));

export const quotationAuditLogsRelations = relations(quotationAuditLogs, ({one}) => ({
	procurementQuotation: one(procurementQuotations, {
		fields: [quotationAuditLogs.quotationId],
		references: [procurementQuotations.id]
	}),
}));

export const quotationVersionsRelations = relations(quotationVersions, ({one}) => ({
	procurementQuotation: one(procurementQuotations, {
		fields: [quotationVersions.quotationId],
		references: [procurementQuotations.id]
	}),
}));

export const procPoItemsRelations = relations(procPoItems, ({one}) => ({
	procurementPo: one(procurementPos, {
		fields: [procPoItems.poId],
		references: [procurementPos.id]
	}),
}));

export const procurementPosRelations = relations(procurementPos, ({one, many}) => ({
	procPoItems: many(procPoItems),
	procurementQuotation: one(procurementQuotations, {
		fields: [procurementPos.quotationId],
		references: [procurementQuotations.id]
	}),
	vendor: one(vendors, {
		fields: [procurementPos.vendorId],
		references: [vendors.id]
	}),
	procGrns: many(procGrns),
	procInvoices: many(procInvoices),
	procPoAuditLogs: many(procPoAuditLogs),
	grnReturns: many(grnReturns),
}));

export const procGrnsRelations = relations(procGrns, ({one, many}) => ({
	procurementPo: one(procurementPos, {
		fields: [procGrns.poId],
		references: [procurementPos.id]
	}),
	vendor: one(vendors, {
		fields: [procGrns.vendorId],
		references: [vendors.id]
	}),
	procGrnItems: many(procGrnItems),
	procInvoices: many(procInvoices),
	procGrnAuditLogs: many(procGrnAuditLogs),
	grnReturns: many(grnReturns),
}));

export const procGrnItemsRelations = relations(procGrnItems, ({one}) => ({
	procGrn: one(procGrns, {
		fields: [procGrnItems.grnId],
		references: [procGrns.id]
	}),
}));

export const procInvoicesRelations = relations(procInvoices, ({one, many}) => ({
	procGrn: one(procGrns, {
		fields: [procInvoices.grnId],
		references: [procGrns.id]
	}),
	procurementPo: one(procurementPos, {
		fields: [procInvoices.poId],
		references: [procurementPos.id]
	}),
	vendor: one(vendors, {
		fields: [procInvoices.vendorId],
		references: [vendors.id]
	}),
	procInvoiceAuditLogs: many(procInvoiceAuditLogs),
	procInvoiceItems: many(procInvoiceItems),
}));

export const procInvoiceAuditLogsRelations = relations(procInvoiceAuditLogs, ({one}) => ({
	procInvoice: one(procInvoices, {
		fields: [procInvoiceAuditLogs.invoiceId],
		references: [procInvoices.id]
	}),
}));

export const procInvoiceItemsRelations = relations(procInvoiceItems, ({one}) => ({
	procInvoice: one(procInvoices, {
		fields: [procInvoiceItems.invoiceId],
		references: [procInvoices.id]
	}),
}));

export const procPoAuditLogsRelations = relations(procPoAuditLogs, ({one}) => ({
	procurementPo: one(procurementPos, {
		fields: [procPoAuditLogs.poId],
		references: [procurementPos.id]
	}),
}));

export const procGrnAuditLogsRelations = relations(procGrnAuditLogs, ({one}) => ({
	procGrn: one(procGrns, {
		fields: [procGrnAuditLogs.grnId],
		references: [procGrns.id]
	}),
}));

export const stockTransfersRelations = relations(stockTransfers, ({one, many}) => ({
	warehouse_fromWarehouseId: one(warehouses, {
		fields: [stockTransfers.fromWarehouseId],
		references: [warehouses.id],
		relationName: "stockTransfers_fromWarehouseId_warehouses_id"
	}),
	warehouse_toWarehouseId: one(warehouses, {
		fields: [stockTransfers.toWarehouseId],
		references: [warehouses.id],
		relationName: "stockTransfers_toWarehouseId_warehouses_id"
	}),
	stockTransferItems: many(stockTransferItems),
}));

export const warehousesRelations = relations(warehouses, ({many}) => ({
	stockTransfers_fromWarehouseId: many(stockTransfers, {
		relationName: "stockTransfers_fromWarehouseId_warehouses_id"
	}),
	stockTransfers_toWarehouseId: many(stockTransfers, {
		relationName: "stockTransfers_toWarehouseId_warehouses_id"
	}),
}));

export const stockTransferItemsRelations = relations(stockTransferItems, ({one}) => ({
	stockTransfer: one(stockTransfers, {
		fields: [stockTransferItems.transferId],
		references: [stockTransfers.id]
	}),
}));

export const materialCategoriesRelations = relations(materialCategories, ({many}) => ({
	materials: many(materials),
}));

export const grnReturnsRelations = relations(grnReturns, ({one, many}) => ({
	procGrn: one(procGrns, {
		fields: [grnReturns.grnId],
		references: [procGrns.id]
	}),
	procurementPo: one(procurementPos, {
		fields: [grnReturns.poId],
		references: [procurementPos.id]
	}),
	vendor: one(vendors, {
		fields: [grnReturns.vendorId],
		references: [vendors.id]
	}),
	grnReturnAuditLogs: many(grnReturnAuditLogs),
	grnReturnItems: many(grnReturnItems),
}));

export const grnReturnAuditLogsRelations = relations(grnReturnAuditLogs, ({one}) => ({
	grnReturn: one(grnReturns, {
		fields: [grnReturnAuditLogs.returnId],
		references: [grnReturns.id]
	}),
}));

export const grnReturnItemsRelations = relations(grnReturnItems, ({one}) => ({
	grnReturn: one(grnReturns, {
		fields: [grnReturnItems.returnId],
		references: [grnReturns.id]
	}),
}));

export const approvalDelegatesRelations = relations(approvalDelegates, ({one}) => ({
	user_fromUserId: one(users, {
		fields: [approvalDelegates.fromUserId],
		references: [users.id],
		relationName: "approvalDelegates_fromUserId_users_id"
	}),
	user_toUserId: one(users, {
		fields: [approvalDelegates.toUserId],
		references: [users.id],
		relationName: "approvalDelegates_toUserId_users_id"
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	approvalDelegates_fromUserId: many(approvalDelegates, {
		relationName: "approvalDelegates_fromUserId_users_id"
	}),
	approvalDelegates_toUserId: many(approvalDelegates, {
		relationName: "approvalDelegates_toUserId_users_id"
	}),
	approvalActions: many(approvalActions),
	approvalRequests: many(approvalRequests),
	approvalRequestSteps_actedById: many(approvalRequestSteps, {
		relationName: "approvalRequestSteps_actedById_users_id"
	}),
	approvalRequestSteps_delegatedToId: many(approvalRequestSteps, {
		relationName: "approvalRequestSteps_delegatedToId_users_id"
	}),
	approvalWorkflows: many(approvalWorkflows),
	approvalWorkflowSteps: many(approvalWorkflowSteps),
}));

export const approvalActionsRelations = relations(approvalActions, ({one}) => ({
	user: one(users, {
		fields: [approvalActions.actorId],
		references: [users.id]
	}),
	approvalRequest: one(approvalRequests, {
		fields: [approvalActions.requestId],
		references: [approvalRequests.id]
	}),
	approvalRequestStep: one(approvalRequestSteps, {
		fields: [approvalActions.stepId],
		references: [approvalRequestSteps.id]
	}),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({one, many}) => ({
	approvalActions: many(approvalActions),
	user: one(users, {
		fields: [approvalRequests.requesterId],
		references: [users.id]
	}),
	approvalWorkflow: one(approvalWorkflows, {
		fields: [approvalRequests.workflowId],
		references: [approvalWorkflows.id]
	}),
	approvalRequestSteps: many(approvalRequestSteps),
}));

export const approvalRequestStepsRelations = relations(approvalRequestSteps, ({one, many}) => ({
	approvalActions: many(approvalActions),
	user_actedById: one(users, {
		fields: [approvalRequestSteps.actedById],
		references: [users.id],
		relationName: "approvalRequestSteps_actedById_users_id"
	}),
	user_delegatedToId: one(users, {
		fields: [approvalRequestSteps.delegatedToId],
		references: [users.id],
		relationName: "approvalRequestSteps_delegatedToId_users_id"
	}),
	approvalRequest: one(approvalRequests, {
		fields: [approvalRequestSteps.requestId],
		references: [approvalRequests.id]
	}),
}));

export const approvalWorkflowsRelations = relations(approvalWorkflows, ({one, many}) => ({
	approvalRequests: many(approvalRequests),
	user: one(users, {
		fields: [approvalWorkflows.createdById],
		references: [users.id]
	}),
	approvalWorkflowSteps: many(approvalWorkflowSteps),
}));

export const approvalWorkflowStepsRelations = relations(approvalWorkflowSteps, ({one}) => ({
	user: one(users, {
		fields: [approvalWorkflowSteps.approverUserId],
		references: [users.id]
	}),
	approvalWorkflow: one(approvalWorkflows, {
		fields: [approvalWorkflowSteps.workflowId],
		references: [approvalWorkflows.id]
	}),
}));

export const materialAuditLogsRelations = relations(materialAuditLogs, ({one}) => ({
	material: one(materials, {
		fields: [materialAuditLogs.materialId],
		references: [materials.id]
	}),
}));

export const materialSuppliersRelations = relations(materialSuppliers, ({one}) => ({
	material: one(materials, {
		fields: [materialSuppliers.materialId],
		references: [materials.id]
	}),
}));

export const quotationAttachmentsRelations = relations(quotationAttachments, ({one}) => ({
	procurementQuotation: one(procurementQuotations, {
		fields: [quotationAttachments.quotationId],
		references: [procurementQuotations.id]
	}),
}));