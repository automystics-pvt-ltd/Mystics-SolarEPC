import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/lib/theme';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation, Redirect } from 'wouter';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SidebarProvider } from '@/lib/sidebar-context';
import { Shell } from '@/components/layout/Shell';
import { Login } from '@/pages/auth/Login';
import { Dashboard } from '@/pages/dashboard/Dashboard';
import { Loader2, ShieldX, ArrowLeft } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { env } from '@/lib/env';
import { usePermissions } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { useGlobalShortcuts } from '@/lib/useGlobalShortcuts';
import { KeyboardShortcutsModal } from '@/components/layout/KeyboardShortcutsModal';

// CRM — lazy loaded
const LeadsList = lazy(() => import('@/pages/crm/LeadsList').then(m => ({ default: m.LeadsList })));
const LeadDetail = lazy(() => import('@/pages/crm/LeadDetail').then(m => ({ default: m.LeadDetail })));
const QuotationsList = lazy(() => import('@/pages/crm/QuotationsList').then(m => ({ default: m.QuotationsList })));
const QuotationDetail = lazy(() => import('@/pages/crm/QuotationDetail').then(m => ({ default: m.QuotationDetail })));
const ClientPOsList = lazy(() => import('@/pages/crm/CrmPages').then(m => ({ default: m.ClientPOsList })));
const CrmInvoicesList = lazy(() => import('@/pages/crm/CrmPages').then(m => ({ default: m.CrmInvoicesList })));
const TasksList = lazy(() => import('@/pages/crm/CrmPages').then(m => ({ default: m.TasksList })));
const EscalationsList = lazy(() => import('@/pages/crm/CrmPages').then(m => ({ default: m.EscalationsList })));

// Projects — lazy loaded
const ProjectsList = lazy(() => import('@/pages/projects/ProjectsList').then(m => ({ default: m.ProjectsList })));
const ProjectWorkspace = lazy(() => import('@/pages/projects/ProjectWorkspace').then(m => ({ default: m.ProjectWorkspace })));
const ContractorsList = lazy(() => import('@/pages/projects/ContractorsList').then(m => ({ default: m.ContractorsList })));

// Inventory — lazy loaded
const InventoryDashboard = lazy(() => import('@/pages/inventory/InventoryDashboard').then(m => ({ default: m.InventoryDashboard })));
const StockSummaryPage = lazy(() => import('@/pages/inventory/StockSummaryPage').then(m => ({ default: m.StockSummaryPage })));
const ProjectAllocations = lazy(() => import('@/pages/inventory/ProjectAllocations').then(m => ({ default: m.ProjectAllocations })));
const MaterialReturns = lazy(() => import('@/pages/inventory/MaterialReturns').then(m => ({ default: m.MaterialReturns })));
const ReorderPlanning = lazy(() => import('@/pages/inventory/ReorderPlanning').then(m => ({ default: m.ReorderPlanning })));
const WarehousesList = lazy(() => import('@/pages/inventory/WarehousesList').then(m => ({ default: m.WarehousesList })));
const WarehouseDetail = lazy(() => import('@/pages/inventory/WarehouseDetail').then(m => ({ default: m.WarehouseDetail })));
const DeliveryChallansList = lazy(() => import('@/pages/inventory/InventoryPages').then(m => ({ default: m.DeliveryChallansList })));
const StockLedgerList = lazy(() => import('@/pages/inventory/InventoryPages').then(m => ({ default: m.StockLedgerList })));
const StockValuationList = lazy(() => import('@/pages/inventory/InventoryPages').then(m => ({ default: m.StockValuationList })));
const InventoryAuditsList = lazy(() => import('@/pages/inventory/InventoryPages').then(m => ({ default: m.InventoryAuditsList })));

// Engineering & Design — lazy loaded
const DesignDocsList = lazy(() => import('@/pages/engineering/DesignDocsList'));
const DesignDocDetail = lazy(() => import('@/pages/engineering/DesignDocDetail'));

// Commissioning — lazy loaded
const CommissioningList = lazy(() => import('@/pages/commissioning/CommissioningList'));
const CommissioningDetail = lazy(() => import('@/pages/commissioning/CommissioningDetail'));

// O&M & AMC — lazy loaded
const OamPages = lazy(() => import('@/pages/oam/OamPages'));

// Procurement — lazy loaded
const VendorsList = lazy(() => import('@/pages/procurement/VendorsList'));
const VendorDetail = lazy(() => import('@/pages/procurement/VendorDetail'));
const MaterialsList = lazy(() => import('@/pages/procurement/MaterialsList'));
const ProcurementQuotationsList = lazy(() => import('@/pages/procurement/ProcurementQuotationsList'));
const ProcurementQuotationDetail = lazy(() => import('@/pages/procurement/ProcurementQuotationDetail'));
const ProcurementQuotationForm = lazy(() => import('@/pages/procurement/ProcurementQuotationForm'));
const QuotationComparisonView = lazy(() => import('@/pages/procurement/QuotationComparisonView'));
const ProcurementPOsList = lazy(() => import('@/pages/procurement/ProcurementPOsList'));
const ProcurementPODetail = lazy(() => import('@/pages/procurement/ProcurementPODetail'));
const ProcurementDashboard = lazy(() => import('@/pages/procurement/ProcurementDashboard'));
const ProcGRNsList = lazy(() => import('@/pages/procurement/GRNsList'));
const GRNForm = lazy(() => import('@/pages/procurement/GRNForm'));
const GRNDetail = lazy(() => import('@/pages/procurement/GRNDetail'));
const InvoicesList = lazy(() => import('@/pages/procurement/InvoicesList'));
const InvoiceForm = lazy(() => import('@/pages/procurement/InvoiceForm'));
const InvoiceDetail = lazy(() => import('@/pages/procurement/InvoiceDetail'));

// New modules
const GRNReturnsList = lazy(() => import('@/pages/procurement/GRNReturnsList'));
const GRNReturnForm = lazy(() => import('@/pages/procurement/GRNReturnForm'));
const GRNReturnDetail = lazy(() => import('@/pages/procurement/GRNReturnDetail'));
const StockTransfers = lazy(() => import('@/pages/inventory/StockTransfers'));
const ReportsModule = lazy(() => import('@/pages/reports/ReportsModule'));
const VendorPerformance = lazy(() => import('@/pages/reports/VendorPerformance'));
const FinanceDashboard = lazy(() => import('@/pages/finance/FinanceDashboard'));
const UserManagement = lazy(() => import('@/pages/admin/UserManagement'));
const AuditLogs = lazy(() => import('@/pages/admin/AuditLogs'));
const RBACManager = lazy(() => import('@/pages/admin/RBACManager'));

// Approvals — lazy loaded
const ApprovalWorkbench = lazy(() => import('@/pages/approvals/ApprovalWorkbench'));


/** Route-transition skeleton — matches the PageHeader + two SectionCard blocks */
function PageLoader() {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page header skeleton */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-2 flex-1">
          <div className="h-6 w-44 bg-muted rounded-lg animate-pulse" />
          <div className="h-3.5 w-72 bg-muted rounded-full animate-pulse opacity-60" />
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="h-9 w-24 bg-muted rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-muted rounded-lg animate-pulse opacity-60" />
        </div>
      </div>
      {/* KPI row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-muted rounded-full animate-pulse" />
              <div className="h-9 w-9 bg-muted rounded-xl animate-pulse" />
            </div>
            <div className="h-7 w-16 bg-muted rounded-full animate-pulse" />
          </div>
        ))}
      </div>
      {/* Main content skeleton */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="h-12 border-b border-border/60 px-4 flex items-center gap-3">
          <div className="h-3.5 w-28 bg-muted rounded-full animate-pulse" />
          <div className="ml-auto flex gap-2">
            <div className="h-7 w-20 bg-muted rounded-lg animate-pulse" />
            <div className="h-7 w-24 bg-muted rounded-lg animate-pulse opacity-60" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border/60 last:border-0">
            <div className="h-9 w-9 bg-muted rounded-lg animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-3.5 bg-muted rounded-full animate-pulse w-1/3" />
              <div className="h-3 bg-muted rounded-full animate-pulse w-2/3 opacity-60" />
            </div>
            <div className="h-5 w-16 bg-muted rounded-full animate-pulse shrink-0" />
            <div className="h-5 w-20 bg-muted rounded-full animate-pulse shrink-0 hidden sm:block opacity-60" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Forbidden page ─────────────────────────────────────────────────────── */
function ForbiddenPage({ module }: { module?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 px-4">
      <div className="w-20 h-20 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center">
        <ShieldX className="h-10 w-10 text-rose-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Access Denied</h2>
        <p className="text-muted-foreground max-w-sm">
          {module
            ? `Your role doesn't have permission to view the "${module}" module.`
            : "You don't have permission to access this page."}
        </p>
        <p className="text-xs text-muted-foreground">
          Contact your administrator to request access.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => window.history.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Go Back
      </Button>
    </div>
  );
}

/* ── Protected route (auth + optional module-level view permission) ──────── */
function ProtectedRoute({ component: Component, module: moduleName, ...rest }: any) {
  const { user, isLoading: authLoading } = useAuth();
  const perms = usePermissions(moduleName);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0c1445 0%, #1e3a8a 100%)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return (
    <Shell>
      <ErrorBoundary fallbackTitle="Page failed to load">
        {/* If a module is specified, show loader while permissions resolve (fail-closed),
            then gate — this prevents temporarily rendering restricted content during
            the permission fetch after a role switch or fresh login. */}
        {moduleName && perms.isLoading ? (
          <PageLoader />
        ) : moduleName && !perms.canView ? (
          <ForbiddenPage module={moduleName} />
        ) : (
          <Suspense fallback={<PageLoader />}>
            <Component {...rest} />
          </Suspense>
        )}
      </ErrorBoundary>
    </Shell>
  );
}

/** Mounts global keyboard shortcuts — must be inside WouterRouter so useLocation works */
function GlobalShortcutsProvider() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useGlobalShortcuts({ onToggleCheatsheet: () => setShortcutsOpen(v => !v) });
  return <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />;
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0c1445 0%, #1e3a8a 100%)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (location === '/') return <Redirect to={user ? '/dashboard' : '/login'} />;
  if (!user && location !== '/login') return <Redirect to="/login" />;

  return (
    <>
    <GlobalShortcutsProvider />
    <Switch>
      <Route path="/login" component={Login} />

      {/* Core */}
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} module="dashboard" />}</Route>
      <Route path="/approvals">{() => <ProtectedRoute component={ApprovalWorkbench} module="approvals" />}</Route>

      {/* CRM */}
      <Route path="/crm/leads">{() => <ProtectedRoute component={LeadsList} module="crm" />}</Route>
      <Route path="/crm/leads/:id">{(p) => <ProtectedRoute component={LeadDetail} module="crm" id={p.id} />}</Route>
      <Route path="/crm/quotations">{() => <ProtectedRoute component={QuotationsList} module="crm" />}</Route>
      <Route path="/crm/quotations/:id">{(p) => <ProtectedRoute component={QuotationDetail} module="crm" id={p.id} />}</Route>
      <Route path="/crm/client-pos">{() => <ProtectedRoute component={ClientPOsList} module="crm" />}</Route>
      <Route path="/crm/invoices">{() => <ProtectedRoute component={CrmInvoicesList} module="crm" />}</Route>
      <Route path="/crm/tasks">{() => <ProtectedRoute component={TasksList} module="crm" />}</Route>
      <Route path="/crm/escalations">{() => <ProtectedRoute component={EscalationsList} module="crm" />}</Route>

      {/* Projects */}
      <Route path="/projects">{() => <ProtectedRoute component={ProjectsList} module="projects" />}</Route>
      <Route path="/projects/contractors">{() => <ProtectedRoute component={ContractorsList} module="projects" />}</Route>
      <Route path="/projects/:id">{(p) => <ProtectedRoute component={ProjectWorkspace} module="projects" id={p.id} />}</Route>

      {/* Inventory */}
      <Route path="/inventory/dashboard">{() => <ProtectedRoute component={InventoryDashboard} module="inventory" />}</Route>
      <Route path="/inventory/stock-levels">{() => <ProtectedRoute component={StockSummaryPage} module="inventory" />}</Route>
      <Route path="/inventory/allocations">{() => <ProtectedRoute component={ProjectAllocations} module="inventory" />}</Route>
      <Route path="/inventory/returns">{() => <ProtectedRoute component={MaterialReturns} module="inventory" />}</Route>
      <Route path="/inventory/reorder-planning">{() => <ProtectedRoute component={ReorderPlanning} module="inventory" />}</Route>
      <Route path="/inventory/warehouses">{() => <ProtectedRoute component={WarehousesList} module="inventory" />}</Route>
      <Route path="/inventory/warehouses/:id">{(p) => <ProtectedRoute component={WarehouseDetail} module="inventory" id={p.id} />}</Route>
      <Route path="/inventory/stock-transfers">{() => <ProtectedRoute component={StockTransfers} module="inventory" />}</Route>
      <Route path="/inventory/delivery-challans">{() => <ProtectedRoute component={DeliveryChallansList} module="inventory" />}</Route>
      <Route path="/inventory/stock-ledger">{() => <ProtectedRoute component={StockLedgerList} module="inventory" />}</Route>
      <Route path="/inventory/stock-valuation">{() => <ProtectedRoute component={StockValuationList} module="inventory" />}</Route>
      <Route path="/inventory/audits">{() => <ProtectedRoute component={InventoryAuditsList} module="inventory" />}</Route>

      {/* Engineering */}
      <Route path="/engineering/docs">{() => <ProtectedRoute component={DesignDocsList} module="engineering" />}</Route>
      <Route path="/engineering/docs/:id">{(p) => <ProtectedRoute component={DesignDocDetail} module="engineering" id={p.id} />}</Route>

      {/* Commissioning */}
      <Route path="/commissioning">{() => <ProtectedRoute component={CommissioningList} module="commissioning" />}</Route>
      <Route path="/commissioning/:id">{(p) => <ProtectedRoute component={CommissioningDetail} module="commissioning" id={p.id} />}</Route>

      {/* O&M */}
      <Route path="/oam/amc">{() => <ProtectedRoute component={OamPages} module="oam" />}</Route>
      <Route path="/oam/maintenance">{() => <ProtectedRoute component={OamPages} module="oam" />}</Route>
      <Route path="/oam/tickets">{() => <ProtectedRoute component={OamPages} module="oam" />}</Route>

      {/* Procurement — order matters: specific paths before /:id */}
      <Route path="/procurement/dashboard">{() => <ProtectedRoute component={ProcurementDashboard} module="procurement" />}</Route>
      <Route path="/procurement/vendors">{() => <ProtectedRoute component={VendorsList} module="vendors" />}</Route>
      <Route path="/procurement/vendors/:id">{(p) => <ProtectedRoute component={VendorDetail} module="vendors" id={p.id} />}</Route>
      <Route path="/procurement/materials">{() => <ProtectedRoute component={MaterialsList} module="materials" />}</Route>
      <Route path="/procurement/quotations/new">{() => <ProtectedRoute component={ProcurementQuotationForm} module="procurement" />}</Route>
      <Route path="/procurement/quotations/:id/edit">{(p) => <ProtectedRoute component={ProcurementQuotationForm} module="procurement" editId={p.id} />}</Route>
      <Route path="/procurement/material-requests/:mrId/compare">{(p) => <ProtectedRoute component={QuotationComparisonView} module="procurement" mrId={p.mrId} />}</Route>
      <Route path="/procurement/quotations/:id">{(p) => <ProtectedRoute component={ProcurementQuotationDetail} module="procurement" id={p.id} />}</Route>
      <Route path="/procurement/quotations">{() => <ProtectedRoute component={ProcurementQuotationsList} module="procurement" />}</Route>
      <Route path="/procurement/pos">{() => <ProtectedRoute component={ProcurementPOsList} module="procurement" />}</Route>
      <Route path="/procurement/pos/:id">{(p) => <ProtectedRoute component={ProcurementPODetail} module="procurement" id={p.id} />}</Route>
      <Route path="/procurement/grns/new">{() => <ProtectedRoute component={GRNForm} module="procurement" />}</Route>
      <Route path="/procurement/grns/:id">{(p) => <ProtectedRoute component={GRNDetail} module="procurement" id={p.id} />}</Route>
      <Route path="/procurement/grns">{() => <ProtectedRoute component={ProcGRNsList} module="procurement" />}</Route>
      <Route path="/procurement/grn-returns/new">{() => <ProtectedRoute component={GRNReturnForm} module="procurement" />}</Route>
      <Route path="/procurement/grn-returns/:id">{(p) => <ProtectedRoute component={GRNReturnDetail} module="procurement" id={p.id} />}</Route>
      <Route path="/procurement/grn-returns">{() => <ProtectedRoute component={GRNReturnsList} module="procurement" />}</Route>
      <Route path="/procurement/invoices/new">{() => <ProtectedRoute component={InvoiceForm} module="procurement" />}</Route>
      <Route path="/procurement/invoices/:id">{(p) => <ProtectedRoute component={InvoiceDetail} module="procurement" id={p.id} />}</Route>
      <Route path="/procurement/invoices">{() => <ProtectedRoute component={InvoicesList} module="procurement" />}</Route>

      {/* Finance & Reports */}
      <Route path="/finance/dashboard">{() => <ProtectedRoute component={FinanceDashboard} module="finance" />}</Route>
      <Route path="/reports/vendors">{() => <ProtectedRoute component={VendorPerformance} module="reports" />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={ReportsModule} module="reports" />}</Route>

      {/* Admin */}
      <Route path="/admin/users">{() => <ProtectedRoute component={UserManagement} module="admin" />}</Route>
      <Route path="/admin/audit-logs">{() => <ProtectedRoute component={AuditLogs} module="admin" />}</Route>
      <Route path="/admin/rbac">{() => <ProtectedRoute component={RBACManager} module="admin" />}</Route>

      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={env.basePath}>
            <AuthProvider>
              <SidebarProvider>
                <ErrorBoundary>
                  <Router />
                </ErrorBoundary>
              </SidebarProvider>
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
