# Solar EPC — Application Workflow & User Guide

> **Automystics Technologies Pvt Ltd** · Solar EPC Command Centre  
> Version 2.4 · Updated July 2026

---

## Table of Contents

1. [Getting Started & Login](#1-getting-started--login)
2. [CRM — Leads & Quotations](#2-crm--leads--quotations)
3. [Projects — Execution Hub](#3-projects--execution-hub)
4. [Procurement — Full P2P Cycle](#4-procurement--full-p2p-cycle)
5. [Inventory & Warehouse](#5-inventory--warehouse)
6. [Approvals](#6-approvals)
7. [Engineering & Commissioning](#7-engineering--commissioning)
8. [Finance Dashboard](#8-finance-dashboard)
9. [Reports & Analytics](#9-reports--analytics)
10. [Admin & RBAC](#10-admin--rbac)
11. [End-to-End Workflow Example](#11-end-to-end-workflow-example)

---

## 1. Getting Started & Login

### Access
Navigate to the application URL. You will see the **Sign In** screen.

### User Accounts

| Role | Email | Password | Access Level |
|------|-------|----------|-------------|
| Admin | admin@automystics.com | admin123 | Full access to all modules |
| Sales | meera@automystics.com | sales123 | CRM, Leads, Quotations, Tasks |
| Project Manager | vikram@automystics.com | pm123 | Projects, Procurement, Engineering |
| Warehouse | santosh@automystics.com | wh123 | Inventory, GRNs, Stock transfers |

### Navigation
- **Nav Rail** (left sidebar): click a module icon to expand its section
- **Command Palette**: press `Ctrl+K` (or `Cmd+K`) to search across all records and pages
- **Notifications Bell** (top bar): real-time alerts for approvals, escalations, due tasks
- **Quick Actions Grid** (Dashboard): one-click shortcuts to the most common actions

---

## 2. CRM — Leads & Quotations

### 2.1 Leads

**Path:** `/crm/leads`

The Lead module tracks every sales opportunity from first contact through to a signed order.

#### Creating a New Lead
1. Click **New Lead** (top right)
2. Fill in the required fields:
   - **Company Name** — client organisation (e.g., NTPC Renewable Energy Ltd)
   - **Contact Name & Phone** — primary point of contact
   - **Source** — how the lead was found (IndiaMART, Referral, Tender, Website, JustDial, Card-scan, etc.)
   - **Territory** — state/region (used for assignment and reporting)
   - **Product Interest** — free-text description (e.g., "2 MW Ground Mount Solar EPC")
   - **Estimated Value** — expected contract value in ₹
3. Click **Create Lead**

#### Lead Lifecycle Statuses
`New` → `Contacted` → `Qualified` → `Proposal` → `Negotiation` → `Won` / `Lost`

#### Pipeline View
- The **Pipeline Summary** cards at the top show total leads, value in proposal, and win rate
- Use the **search bar** to filter by company name or contact
- Use the **status filter tabs** to focus on a stage

#### Converting a Lead
Once a lead is **Qualified** or in **Proposal**, create a Quotation from the lead detail page.

---

### 2.2 CRM Quotations

**Path:** `/crm/quotations`

CRM Quotations (also called Sales Quotations) are the formal price proposals sent to clients. They are distinct from *Procurement Quotations* (vendor bids).

#### Creating a Quotation
1. Open a lead and click **Create Quotation**, or navigate to `/crm/quotations` → **New Quotation**
2. Add **BOQ line items** — each item has: Description, Qty, Unit, Unit Price
3. Set **Markup %** (applied on top of cost to arrive at selling price)
4. Set **Valid Till** date
5. Submit for approval or save as Draft
6. Once **Approved**, generate a **Client PO** from the quotation to formally start the project

#### Client POs
**Path:** `/crm/pos` (or from the Quotation detail → **Raise Client PO**)

A Client PO records the client's purchase order number, contract value, and payment terms. It links the quotation to a project.

---

### 2.3 Tasks

**Path:** `/crm/tasks`

Tasks are action items linked to a lead, quotation, or project.

- **Create**: Click **New Task** → assign to a user, set priority (Low / Medium / High / Critical), set due date
- **Statuses**: Open → InProgress → Completed / Cancelled
- Filter by module (CRM / Project), priority, or assignee

---

### 2.4 Escalations

**Path:** `/crm/escalations`

Escalations flag blockers that need management attention — delayed deliveries, permit issues, unresponsive clients.

- **Severity**: Low / Medium / High / Critical
- **Statuses**: Pending → InProgress → Resolved / Closed
- An escalation automatically notifies the assigned person

---

### 2.5 CRM Invoices

**Path:** `/crm/invoices`

CRM invoices track payments *from* clients (receivables), based on milestone triggers defined in the Client PO.

---

## 3. Projects — Execution Hub

**Path:** `/projects`

Projects are the heart of the application. Each project has a full workspace with multiple tabs.

### 3.1 Creating a Project
1. Click **New Project** on the Projects list
2. Fill: **Name**, **Site Location**, **Start Date**, **Planned End**, **Contract Value**
3. The project is created in **Planning** status

Projects are usually created automatically when a Client PO is raised from a CRM Quotation — the system links them.

### 3.2 Project Workspace Tabs

Open any project to access its full workspace:

| Tab | What it covers |
|-----|----------------|
| **Overview** | KPI summary, % complete, health status, client details |
| **Activities** | WBS schedule — tasks with planned/actual dates and progress % |
| **BOQ** | Bill of Quantities — budgeted vs committed vs actual cost by head |
| **Budget** | Cost breakdown and variance tracking |
| **Material Requests** | MRs raised for procurement |
| **Expenses** | Site expenses, travel, subcontractor payments |
| **Milestones** | Payment milestones — Pending / Triggered / Paid |
| **Documents** | Design docs, drawings, approvals |
| **DPRs** | Daily Progress Reports — weather, manpower, work summary |
| **Phases** | High-level project phases |
| **Resources** | Resource allocation |
| **Risk Register** | Identified risks and mitigation |
| **Inspections** | QC checkpoints |
| **Commissioning** | Commissioning checklists |
| **Snag List** | Punch list items |
| **Handover** | Project handover & warranty |
| **Activities** | Detailed WBS activity tracking |

### 3.3 Recording Daily Progress (DPR)
1. Go to project → **DPRs** tab → **Add DPR**
2. Fill: Date, Manpower count, Weather, Work Summary, % Complete
3. Attach site photos if needed
4. Submit — DPR is logged and updates the project's progress

### 3.4 Managing the WBS Schedule
1. Go to project → **Activities** tab → **Add Activity**
2. Fill: WBS Code (e.g., "2.1"), Activity Name, Planned Start/End
3. Update **Actual Start/End** and **% Complete** as work progresses
4. Statuses: NotStarted → InProgress → Completed / Delayed

### 3.5 Raising a Material Request
1. Go to project → **Material Requests** tab → **New MR**
2. Add line items: Item Name, Qty, Unit, Specifications, Required By Date
3. MR status: `Open` → `QuotationPending` → `POGenerated` → `Delivered`
4. The MR reference (MR number) is used when creating a Procurement Quotation

---

## 4. Procurement — Full P2P Cycle

Procurement follows a strict **Procure-to-Pay (P2P)** cycle:

```
Material Request → Vendor Quotation → PO Approval → GRN → Invoice → Payment
```

### 4.1 Vendors

**Path:** `/procurement/vendors`

The Vendor Master stores all supplier information.

#### Adding a Vendor
1. Click **New Vendor**
2. Fill: Name, Trade Name, Status (Active/Inactive/Blacklisted)
3. Add GST details: GSTIN, PAN, GST-registered state
4. Add billing address, primary contact email & phone
5. Add bank details (for payment processing)
6. Add payment terms and tags (e.g., "Tier-1 Module", "Preferred")
7. Save — the vendor gets a system code (VND-001, VND-002…)

#### Vendor Contacts
On the vendor detail page, go to the **Contacts** tab to add multiple contacts with designations (e.g., Key Account Manager, Service Engineer).

#### Vendor Performance
The vendor detail shows linked POs, GRNs, invoices, and a spend summary.

---

### 4.2 Material Master

**Path:** `/procurement/materials`

The Material Master is the catalogue of all procurable items.

#### Adding a Material
1. Click **New Material**
2. Fill: Code, Name, Category, Unit of Measure (UOM)
3. Add HSN/SAC code and GST rate
4. Add technical specs: Brand, Model, Specifications
5. Set reorder levels: Min Stock, Reorder Point
6. Link preferred suppliers under the **Suppliers** tab

#### Material Categories
**Path:** `/procurement/materials/categories`

Organise materials into categories (Solar Modules, Inverters, Cables, Mounting Structures, Transformers & Switchgear).

---

### 4.3 Procurement Quotations (Vendor Bids)

**Path:** `/procurement/quotations`

Procurement Quotations are bids received from vendors for a specific Material Request.

#### Workflow
1. **Create Quotation**: Click **New Quotation**
   - Select the vendor
   - Link to a Material Request (optional)
   - Add line items: Material, Qty, Unit Price, GST rate
   - Set validity date and delivery terms
   - Save as **Draft**

2. **Submit for Review**: Change status to **Submitted** → goes to the team for evaluation

3. **Review & Approve**:
   - Mark the quotation as **L1** (lowest cost) and **Recommended** if appropriate
   - Approve — status becomes **Approved**
   - Rejected quotations can be revised

4. **Generate PO**: From an Approved quotation, click **Generate PO** → a Purchase Order is created pre-filled with vendor and line item data

---

### 4.4 Purchase Orders

**Path:** `/procurement/pos`

#### PO Lifecycle
`Draft` → `Submitted` → `PendingApproval` → `Approved` → `Issued` → `PartiallyReceived` → `FullyReceived` → `InvoiceMatched` → `Paid` → `Closed`

#### Creating/Viewing a PO
- POs are usually created from approved Procurement Quotations
- The PO detail shows: vendor info, line items, delivery deadline, special terms, approval trail
- Once **Approved**, the PO is **Issued** to the vendor (email notification)

#### Key PO Fields
| Field | Description |
|-------|-------------|
| PO Number | Auto-generated (PO-YYYY-NNNN) |
| Vendor | Linked from vendor master |
| Project | Associated project |
| Delivery Deadline | Expected delivery date at site |
| Payment Terms | e.g., Net 60 days from GRN |
| Warranty Months | Warranty period in months |
| Special Terms | Lot-wise delivery, test report requirements, etc. |

#### PO Approval
When a PO requires approval (above threshold), it enters the Approvals workbench. The approver can Approve, Reject, or put On Hold.

---

### 4.5 Goods Receipt Notes (GRN)

**Path:** `/procurement/grns`

GRNs record the physical receipt and inspection of goods at the warehouse/site.

#### Creating a GRN
1. Click **New GRN** (or from PO detail → **Create GRN**)
2. Select the **PO** — line items are pre-filled from the PO
3. Select the **Warehouse** where goods are being received
4. Fill delivery details: Delivery Date, Vehicle Number, DC Number, DC Date
5. For each line item, enter:
   - **Received Qty** — physical count
   - **Accepted Qty** — qty that passed QC
   - **Rejected Qty** — damaged or non-conforming items
   - **QC Status**: Accepted / PartiallyAccepted / Rejected
6. Add inspection remarks
7. **Submit** → status goes to `Submitted`
8. **Accept** → status becomes `Accepted` (or `PartiallyAccepted` if some items rejected)

#### GRN Acceptance Flow
- `Draft` → `Submitted` → `Accepted` / `PartiallyAccepted` / `Rejected`
- On Acceptance: stock ledger is automatically updated (inward entry created)
- On Partial Acceptance: remaining quantity stays open on the PO for the next delivery

#### GRN Returns
**Path:** `/procurement/grn-returns`

If accepted goods need to be returned to the vendor (quality failure, wrong item), raise a GRN Return against the original GRN.

---

### 4.6 Procurement Invoices

**Path:** `/procurement/invoices`

Procurement Invoices record vendor tax invoices and trigger payment processing.

#### Creating an Invoice
1. Click **New Invoice** (or from GRN/PO detail → **Create Invoice**)
2. Link to the **PO** and (optionally) the **GRN**
3. Enter vendor's invoice number and invoice date
4. Verify line items — the system performs a **3-way match** (PO qty vs GRN qty vs invoice qty)
5. Any mismatch is flagged — can be approved with a mismatch justification
6. Set payment due date and bank details for payment
7. **Submit** → `PendingApproval`
8. **Approve** → `Approved` (ready for payment)

#### Invoice Statuses
`Draft` → `PendingApproval` → `Approved` → `PartiallyPaid` → `Paid`

Also: `OnHold` (pending clarification), `Disputed`, `Cancelled`

#### 3-Way Match
The system automatically compares:
- **PO qty** (what was ordered)
- **GRN qty** (what was received and accepted)
- **Invoice qty** (what the vendor is billing for)

If all three match → `Matched` ✓  
If there's a discrepancy → `MismatchPending` — requires approval to proceed

---

## 5. Inventory & Warehouse

### 5.1 Warehouses

**Path:** `/inventory/warehouses`

#### Warehouse Types
- **Central** — main company warehouse (Automystics HQ, Pune)
- **Site** — project-specific temporary store (one per active project site)

#### Adding a Warehouse
1. Click **Add Warehouse**
2. Fill: Name, Type (Central/Site), Location, Capacity
3. Link to a Project (for site stores) and assign a Custodian
4. Save

#### Warehouse Detail
Open a warehouse to see:
- **Stock Levels** — current inventory for each material
- **Locations** — zone/rack/bin slots within the warehouse
- **Inward/Outward log** — all stock movements

---

### 5.2 Stock Levels

**Path:** `/inventory/stock-levels`

Real-time view of stock across all warehouses:
- **Current Qty** — total physical stock
- **Allocated Qty** — reserved for ongoing installation
- **Available Qty** = Current − Allocated
- **Reorder Alert** — highlighted when stock falls below reorder point

---

### 5.3 Stock Transfers

**Path:** `/inventory/stock-transfers`

Transfer material between warehouses (e.g., Central Store → Site Store).

#### Creating a Transfer
1. Click **New Transfer**
2. Select **From Warehouse** and **To Warehouse**
3. Add items and quantities
4. Save as `Draft` → Submit → Approve → `Completed`
5. Stock levels are updated automatically on completion

---

### 5.4 Stock Ledger

**Path:** `/inventory/stock-ledger`

Complete audit trail of every stock movement:
- **Inward** — goods received (from GRN)
- **Outward** — goods issued to site (from Delivery Challan)
- **Transfer** — between warehouses
- **Adjustment** — manual correction

---

### 5.5 Material Allocations

**Path:** `/inventory/allocations`

Track how stock is allocated to specific projects. Prevents double-issuing of the same material.

---

### 5.6 Material Returns

**Path:** `/inventory/returns`

Record return of site-issued material back to the warehouse (unused material, incorrect item, project completion).

---

### 5.7 Reorder Planning

**Path:** `/inventory/reorder-planning`

Shows all materials that have fallen below their reorder point. Helps procurement team identify what needs to be ordered before stock runs out.

---

### 5.8 Inventory Audits

**Path:** `/inventory/audits`

Periodic physical stock counts to reconcile system stock vs actual on-ground stock.

---

## 6. Approvals

**Path:** `/approvals`

The Approvals Workbench is a central inbox for all pending approval requests across modules.

### What Requires Approval
- Purchase Orders (above threshold value)
- Procurement Invoices
- GRN acceptance (for high-value items)
- Expenses above limit
- Quotation approval (Sales)

### Approval Actions
1. Open a pending request from the workbench
2. Review the detail — entity being approved, requester, linked documents
3. Choose:
   - ✅ **Approve** — proceeds to next step
   - ❌ **Reject** — sends back with reason
   - ⏸ **On Hold** — pauses for clarification
4. Add remarks before submitting

### Delegation
If you're away, approval delegates can be configured in Admin → Workflows so your approvals are redirected automatically.

---

## 7. Engineering & Commissioning

### 7.1 Engineering Documents

**Path:** `/engineering/docs`

Manage all technical documents for projects:
- Single-Line Diagrams (SLD)
- Layout drawings
- Structural drawings
- Electrical design calculations

#### Uploading a Document
1. Click **Upload Document**
2. Select document type, project, and version
3. Upload file and add description
4. Documents go through a review → approval workflow

### 7.2 Commissioning

**Path:** `/commissioning`

Track commissioning checklists per project:
- Pre-commissioning checks (continuity, insulation resistance, polarity)
- Energisation sequence
- Performance ratio test
- Grid synchronisation

Each checklist item is marked Pass / Fail with observations recorded.

### 7.3 O&M (Operations & Maintenance)

**Path:** `/oam/maintenance`

For projects in operational phase:
- **AMC Contracts** — annual maintenance contracts
- **Service Tickets** — reactive maintenance requests
- **Maintenance Schedules** — preventive maintenance calendar

---

## 8. Finance Dashboard

**Path:** `/finance/dashboard`

High-level financial overview:
- **Total PO Value** — sum of all issued POs
- **Invoiced Amount** — sum of approved/paid invoices
- **Outstanding Payables** — approved invoices not yet paid
- **Paid Amount** — total payments made
- Trend charts for procurement spend by month
- Top vendors by spend

---

## 9. Reports & Analytics

**Path:** `/reports`

Pre-built reports across modules:

| Report | Description |
|--------|-------------|
| **Vendor Spend** | Total spend per vendor, filterable by period and project |
| **Project Cost** | Budget vs committed vs actual per project |
| **Procurement Cycle Time** | MR → PO → GRN → Invoice cycle time analysis |
| **Inventory Valuation** | Stock value by warehouse and category |
| **Lead Conversion** | Pipeline conversion rates by source and territory |
| **Invoice Ageing** | Overdue payables by vendor |

---

## 10. Admin & RBAC

### 10.1 User Management

**Path:** `/admin/users`

- View all users, their roles, and status
- Admin can create new users or deactivate existing ones

### 10.2 Role-Based Access Control (RBAC)

**Path:** `/admin/rbac`

Granular permission matrix — each role can be configured to Allow or Deny:
- **Modules**: CRM, Projects, Procurement, Inventory, Approvals, Finance, Admin
- **Actions**: Create, Read, Update, Delete, Approve

Default roles: `admin`, `sales`, `pm` (Project Manager), `warehouse`

Custom roles can be created and users assigned to them.

### 10.3 Audit Logs

**Path:** `/admin/audit-logs`

Complete log of every user action (create, update, delete, approve, reject) with timestamp, user, and before/after values. Used for compliance and troubleshooting.

---

## 11. End-to-End Workflow Example

This example traces the complete lifecycle of a **2 MW Solar EPC project** — matching the real data seeded in the system.

---

### Step 1 — Lead Capture (Sales)
> **Actor**: Meera Nair (Sales) · **Path**: `/crm/leads`

1. Meera receives an enquiry from NTPC Renewable Energy on IndiaMART
2. Creates a new lead: Company = "NTPC Renewable Energy Ltd", Product = "2 MW Ground Mount Solar EPC — Rajkot", Value = ₹1.25 Cr
3. Marks status as **Qualified** after a site visit

---

### Step 2 — Quotation Preparation (Sales)
> **Actor**: Meera Nair · **Path**: `/crm/quotations`

1. From the lead, creates a **CRM Quotation**
2. Adds BOQ: 4000 Waaree 550Wp modules + 4 SMA central inverters + mounting structure + cables + civil + transformer
3. Sets markup 16%, valid till 31-Oct-2026
4. Submits for approval → Admin (Arjun) approves

---

### Step 3 — Client PO & Project Creation (Admin/PM)
> **Actor**: Arjun Kapoor (Admin) / Vikram Rathod (PM) · **Paths**: `/crm/quotations`, `/projects`

1. Client issues PO (NTPC-RE-PO-2026-0412) for ₹1.25 Cr
2. Arjun raises a **Client PO** from the quotation
3. A **Project** is created: "2 MW Ground Mount Solar — Rajkot, Gujarat"
4. Vikram is assigned as PM; project status set to **Active**

---

### Step 4 — Material Request (PM)
> **Actor**: Vikram Rathod · **Path**: Project → Material Requests tab

1. Vikram raises **MR-2026-001** for 4000 Waaree 550Wp modules (Required by 15-May-2026)
2. MR status: **Open** → procurement team is notified

---

### Step 5 — Vendor Quotation (Admin/PM)
> **Actor**: Arjun Kapoor · **Path**: `/procurement/quotations`

1. Requests a quote from Waaree Energies Ltd
2. Creates **VQ-2026-0001**: 4000 modules × ₹14,500 = ₹5.8 Cr + 5% GST = ₹6.09 Cr
3. Marks as **L1** (best price) and **Recommended**
4. Approves the quotation → status: **Approved**

---

### Step 6 — Purchase Order (Admin)
> **Actor**: Arjun Kapoor · **Path**: `/procurement/pos`

1. Clicks **Generate PO** from the approved quotation
2. PO-2026-0001 is created pre-filled with Waaree's details
3. Adds special terms: "Two lots — Lot 1: 2000 Nos by 31-May; Lot 2: 2000 Nos by 30-Jun"
4. Submits for approval → Arjun approves → status: **Approved** → **Issued**
5. Vendor is notified; delivery deadline set to 30-Jun-2026

---

### Step 7 — Goods Receipt (Warehouse)
> **Actor**: Santosh Pawar (Warehouse) · **Path**: `/procurement/grns`

1. Lot 1 arrives on 28-May-2026: 2000 modules, truck GJ04AZ7823, DC WAA-DC-2026-0412
2. Santosh creates **GRN-2026-0001** linked to PO-2026-0001, warehouse = Rajkot Site Store
3. Enters: Received 2000, Accepted 2000, Rejected 0 — EL test passed, flash reports verified
4. Vikram inspects and **Accepts** the GRN
5. PO status auto-updates to **PartiallyReceived** (2000/4000 done)
6. **Stock ledger** auto-records: +2000 modules inward at Rajkot

---

### Step 8 — Invoice Processing (Warehouse → Finance)
> **Actor**: Santosh Pawar → Arjun Kapoor · **Path**: `/procurement/invoices`

1. Waaree sends invoice WAA-INV-2026-1842 for 2000 modules (₹3.045 Cr incl. GST)
2. Santosh creates **PINV-2026-0001** linked to PO + GRN
3. System performs 3-way match: PO qty 4000, GRN accepted 2000, Invoice 2000 → **Matched** ✓
4. Arjun approves — status: **Approved**; due date 28-Jul-2026
5. Payment is processed via NEFT when due; status becomes **Paid**

---

### Step 9 — Site Issuance & Installation (Warehouse → PM)
> **Actor**: Santosh Pawar · **Path**: `/inventory/stock-ledger`

1. Santosh raises a Delivery Challan: issues 800 modules from Rajkot store to Row A & B installation team
2. Stock ledger: −800 outward; balance = 1200
3. Vikram updates project activities: "Module Mounting Structure Erection" → 35% complete

---

### Step 10 — Project Milestones & Payments (PM → Admin)
> **Actor**: Vikram Rathod → Arjun Kapoor · **Path**: Project → Milestones tab

1. Equipment Supply milestone is **Triggered** (GRN accepted)
2. Arjun raises invoice to NTPC-RE for ₹37.5 L (30% of ₹1.25 Cr)
3. Payment received → milestone marked **Paid**

---

### Step 11 — Commissioning (PM)
> **Actor**: Vikram Rathod · **Path**: `/commissioning`

1. After all modules installed, Vikram creates a commissioning checklist
2. Pre-commissioning: IR test, polarity check, string open-circuit voltage check → all Pass
3. Energisation → performance ratio test → 24-hour monitoring
4. DISCOM synchronisation certificate obtained

---

### Step 12 — Project Handover & COD (PM → Admin)
> **Actor**: Vikram Rathod → Arjun Kapoor · **Path**: Project → Handover tab

1. Commissioning report generated and sent to NTPC-RE
2. COD (Commercial Operation Date) declared
3. Final milestone triggered → ₹25 L final payment received
4. Project status updated to **Completed**
5. O&M contract activated in `/oam/maintenance`

---

## Quick Reference — Key Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `Cmd+K` | Open Command Palette |
| `G` then `D` | Go to Dashboard |
| `G` then `P` | Go to Projects |
| `G` then `L` | Go to Leads |
| `G` then `V` | Go to Vendors |

---

## Glossary

| Term | Meaning |
|------|---------|
| **BOQ** | Bill of Quantities — itemised cost breakdown |
| **MR** | Material Request — internal procurement trigger |
| **VQ** | Vendor Quotation (Procurement Quotation) reference |
| **PO** | Purchase Order |
| **GRN** | Goods Receipt Note — receipt & inspection record |
| **DC** | Delivery Challan — goods issue from warehouse to site |
| **COD** | Commercial Operation Date — project go-live |
| **EPC** | Engineering, Procurement & Construction |
| **L1** | Lowest bidder among competing quotations |
| **3-way match** | Verification that PO qty = GRN qty = Invoice qty |
| **DISCOM** | Distribution Company (electricity utility) |
| **MSEDCL** | Maharashtra State Electricity Distribution Co. Ltd |
| **SECI** | Solar Energy Corporation of India |
| **DTR** | Distribution Transformer |
| **MLDB** | Main LT Distribution Board |
| **ACDB** | AC Distribution Box |
| **ITP** | Inspection & Test Plan |
| **PR** | Performance Ratio (solar efficiency metric) |
| **AMC** | Annual Maintenance Contract |
