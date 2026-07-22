import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation, Redirect } from 'wouter';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SidebarProvider } from '@/lib/sidebar-context';
import { Shell } from '@/components/layout/Shell';
import { Login } from '@/pages/auth/Login';
import { Dashboard } from '@/pages/dashboard/Dashboard';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';

// CRM
import { LeadsList } from '@/pages/crm/LeadsList';
import { LeadDetail } from '@/pages/crm/LeadDetail';
import { QuotationsList } from '@/pages/crm/QuotationsList';
import { QuotationDetail } from '@/pages/crm/QuotationDetail';
import { ClientPOsList, CrmInvoicesList, TasksList, EscalationsList } from '@/pages/crm/CrmPages';

// Projects
import { ProjectsList } from '@/pages/projects/ProjectsList';
import { ProjectWorkspace } from '@/pages/projects/ProjectWorkspace';
import { ContractorsList } from '@/pages/projects/ContractorsList';

// Inventory
import { WarehousesList } from '@/pages/inventory/WarehousesList';
import { WarehouseDetail } from '@/pages/inventory/WarehouseDetail';
import { DeliveryChallansList, StockLedgerList, StockValuationList, InventoryAuditsList } from '@/pages/inventory/InventoryPages';

// Engineering & Design
import DesignDocsList from '@/pages/engineering/DesignDocsList';
import DesignDocDetail from '@/pages/engineering/DesignDocDetail';

// Commissioning
import CommissioningList from '@/pages/commissioning/CommissioningList';
import CommissioningDetail from '@/pages/commissioning/CommissioningDetail';

// O&M & AMC
import OamPages from '@/pages/oam/OamPages';

// Procurement
import VendorsList from '@/pages/procurement/VendorsList';
import VendorDetail from '@/pages/procurement/VendorDetail';
import MaterialsList from '@/pages/procurement/MaterialsList';
import ProcurementQuotationsList from '@/pages/procurement/ProcurementQuotationsList';
import ProcurementQuotationDetail from '@/pages/procurement/ProcurementQuotationDetail';
import ProcurementQuotationForm from '@/pages/procurement/ProcurementQuotationForm';
import QuotationComparisonView from '@/pages/procurement/QuotationComparisonView';
import ProcurementPOsList from '@/pages/procurement/ProcurementPOsList';
import ProcurementPODetail from '@/pages/procurement/ProcurementPODetail';
import ProcurementDashboard from '@/pages/procurement/ProcurementDashboard';
import ProcGRNsList from '@/pages/procurement/GRNsList';
import GRNForm from '@/pages/procurement/GRNForm';
import GRNDetail from '@/pages/procurement/GRNDetail';
import InvoicesList from '@/pages/procurement/InvoicesList';
import InvoiceForm from '@/pages/procurement/InvoiceForm';
import InvoiceDetail from '@/pages/procurement/InvoiceDetail';

// New modules (lazy-loaded for performance)
const GRNReturnsList = lazy(() => import('@/pages/procurement/GRNReturnsList'));
const GRNReturnForm = lazy(() => import('@/pages/procurement/GRNReturnForm'));
const GRNReturnDetail = lazy(() => import('@/pages/procurement/GRNReturnDetail'));
const StockTransfers = lazy(() => import('@/pages/inventory/StockTransfers'));
const ReportsModule = lazy(() => import('@/pages/reports/ReportsModule'));
const VendorPerformance = lazy(() => import('@/pages/reports/VendorPerformance'));
const FinanceDashboard = lazy(() => import('@/pages/finance/FinanceDashboard'));
const UserManagement = lazy(() => import('@/pages/admin/UserManagement'));
const AuditLogs = lazy(() => import('@/pages/admin/AuditLogs'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );
}

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0c1445 0%, #1e3a8a 100%)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return (
    <Shell>
      <Suspense fallback={<PageLoader />}>
        <Component {...rest} />
      </Suspense>
    </Shell>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0c1445 0%, #1e3a8a 100%)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (location === '/') return <Redirect to={user ? '/dashboard' : '/login'} />;
  if (!user && location !== '/login') return <Redirect to="/login" />;

  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>

      <Route path="/crm/leads">{() => <ProtectedRoute component={LeadsList} />}</Route>
      <Route path="/crm/leads/:id">{(p) => <ProtectedRoute component={LeadDetail} id={p.id} />}</Route>

      <Route path="/crm/quotations">{() => <ProtectedRoute component={QuotationsList} />}</Route>
      <Route path="/crm/quotations/:id">{(p) => <ProtectedRoute component={QuotationDetail} id={p.id} />}</Route>

      <Route path="/crm/client-pos">{() => <ProtectedRoute component={ClientPOsList} />}</Route>
      <Route path="/crm/invoices">{() => <ProtectedRoute component={CrmInvoicesList} />}</Route>
      <Route path="/crm/tasks">{() => <ProtectedRoute component={TasksList} />}</Route>
      <Route path="/crm/escalations">{() => <ProtectedRoute component={EscalationsList} />}</Route>

      <Route path="/projects">{() => <ProtectedRoute component={ProjectsList} />}</Route>
      <Route path="/projects/contractors">{() => <ProtectedRoute component={ContractorsList} />}</Route>
      <Route path="/projects/:id">{(p) => <ProtectedRoute component={ProjectWorkspace} id={p.id} />}</Route>

      <Route path="/inventory/warehouses">{() => <ProtectedRoute component={WarehousesList} />}</Route>
      <Route path="/inventory/warehouses/:id">{(p) => <ProtectedRoute component={WarehouseDetail} id={p.id} />}</Route>
      <Route path="/inventory/stock-transfers">{() => <ProtectedRoute component={StockTransfers} />}</Route>
      <Route path="/inventory/delivery-challans">{() => <ProtectedRoute component={DeliveryChallansList} />}</Route>
      <Route path="/inventory/stock-ledger">{() => <ProtectedRoute component={StockLedgerList} />}</Route>
      <Route path="/inventory/stock-valuation">{() => <ProtectedRoute component={StockValuationList} />}</Route>
      <Route path="/inventory/audits">{() => <ProtectedRoute component={InventoryAuditsList} />}</Route>

      <Route path="/engineering/docs">{() => <ProtectedRoute component={DesignDocsList} />}</Route>
      <Route path="/engineering/docs/:id">{(p) => <ProtectedRoute component={DesignDocDetail} id={p.id} />}</Route>

      <Route path="/commissioning">{() => <ProtectedRoute component={CommissioningList} />}</Route>
      <Route path="/commissioning/:id">{(p) => <ProtectedRoute component={CommissioningDetail} id={p.id} />}</Route>

      <Route path="/oam/amc">{() => <ProtectedRoute component={OamPages} />}</Route>
      <Route path="/oam/maintenance">{() => <ProtectedRoute component={OamPages} />}</Route>
      <Route path="/oam/tickets">{() => <ProtectedRoute component={OamPages} />}</Route>

      {/* Procurement */}
      <Route path="/procurement/vendors">{() => <ProtectedRoute component={VendorsList} />}</Route>
      <Route path="/procurement/vendors/:id">{(p) => <ProtectedRoute component={VendorDetail} id={p.id} />}</Route>
      <Route path="/procurement/materials">{() => <ProtectedRoute component={MaterialsList} />}</Route>
      <Route path="/procurement/quotations">{() => <ProtectedRoute component={ProcurementQuotationsList} />}</Route>
      <Route path="/procurement/quotations/new">{() => <ProtectedRoute component={ProcurementQuotationForm} />}</Route>
      <Route path="/procurement/quotations/:id/edit">{(p) => <ProtectedRoute component={ProcurementQuotationForm} editId={p.id} />}</Route>
      <Route path="/procurement/material-requests/:mrId/compare">{(p) => <ProtectedRoute component={QuotationComparisonView} mrId={p.mrId} />}</Route>
      <Route path="/procurement/quotations/:id">{(p) => <ProtectedRoute component={ProcurementQuotationDetail} id={p.id} />}</Route>
      <Route path="/procurement/pos">{() => <ProtectedRoute component={ProcurementPOsList} />}</Route>
      <Route path="/procurement/pos/:id">{(p) => <ProtectedRoute component={ProcurementPODetail} id={p.id} />}</Route>
      <Route path="/procurement/dashboard">{() => <ProtectedRoute component={ProcurementDashboard} />}</Route>
      <Route path="/procurement/grns/new">{() => <ProtectedRoute component={GRNForm} />}</Route>
      <Route path="/procurement/grns/:id">{(p) => <ProtectedRoute component={GRNDetail} id={p.id} />}</Route>
      <Route path="/procurement/grns">{() => <ProtectedRoute component={ProcGRNsList} />}</Route>
      <Route path="/procurement/grn-returns/new">{() => <ProtectedRoute component={GRNReturnForm} />}</Route>
      <Route path="/procurement/grn-returns/:id">{(p) => <ProtectedRoute component={GRNReturnDetail} id={p.id} />}</Route>
      <Route path="/procurement/grn-returns">{() => <ProtectedRoute component={GRNReturnsList} />}</Route>
      <Route path="/procurement/invoices/new">{() => <ProtectedRoute component={InvoiceForm} />}</Route>
      <Route path="/procurement/invoices/:id">{(p) => <ProtectedRoute component={InvoiceDetail} id={p.id} />}</Route>
      <Route path="/procurement/invoices">{() => <ProtectedRoute component={InvoicesList} />}</Route>

      {/* Finance & Reports */}
      <Route path="/finance/dashboard">{() => <ProtectedRoute component={FinanceDashboard} />}</Route>
      <Route path="/reports/vendors">{() => <ProtectedRoute component={VendorPerformance} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={ReportsModule} />}</Route>

      {/* Admin */}
      <Route path="/admin/users">{() => <ProtectedRoute component={UserManagement} />}</Route>
      <Route path="/admin/audit-logs">{() => <ProtectedRoute component={AuditLogs} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <SidebarProvider>
              <Router />
            </SidebarProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
