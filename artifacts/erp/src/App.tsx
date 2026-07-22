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
import { GRNsList, DeliveryChallansList, StockLedgerList, StockValuationList, InventoryAuditsList } from '@/pages/inventory/InventoryPages';

const queryClient = new QueryClient();

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
      <Component {...rest} />
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
      <Route path="/inventory/grns">{() => <ProtectedRoute component={GRNsList} />}</Route>
      <Route path="/inventory/delivery-challans">{() => <ProtectedRoute component={DeliveryChallansList} />}</Route>
      <Route path="/inventory/stock-ledger">{() => <ProtectedRoute component={StockLedgerList} />}</Route>
      <Route path="/inventory/stock-valuation">{() => <ProtectedRoute component={StockValuationList} />}</Route>
      <Route path="/inventory/audits">{() => <ProtectedRoute component={InventoryAuditsList} />}</Route>

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
