// @refresh reset
import { useState, useMemo } from "react";
import { useGetVendors, useCreateVendor, getGetVendorsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/shared";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Building2, AlertCircle, ShoppingCart, Search, X,
  LayoutGrid, List, ChevronRight, MapPin, CreditCard, Star,
  Users, TrendingUp, CalendarPlus, CheckCircle2,
} from "lucide-react";
import { usePermissions } from "@/lib/permissions";
import { useToast } from "@/components/ui/use-toast";
import { validateVendorCore, hasErrors, type VendorErrors } from "@/lib/vendor-validation";
import { cn } from "@/lib/utils";
import { EmptyState, SkeletonCards, ExportButton } from "@/components/shared";
import { differenceInDays, parseISO } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode = "cards" | "list";
type StatusFilter = "all" | "Active" | "Inactive" | "Blacklisted";

const STATUS_FILTERS: StatusFilter[] = ["all", "Active", "Inactive", "Blacklisted"];

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { dot: string; pill: string; border: string; label: string }> = {
  Active:      { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",  border: "border-l-emerald-500", label: "Active"      },
  Inactive:    { dot: "bg-slate-400",   pill: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700",               border: "border-l-slate-400",   label: "Inactive"    },
  Blacklisted: { dot: "bg-red-500",     pill: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",                          border: "border-l-red-500",     label: "Blacklisted" },
};
const DEFAULT_STATUS_CFG = { dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground border-border", border: "border-l-muted-foreground/30", label: "Unknown" };
function getStatusCfg(s: string) { return STATUS_CONFIG[s] ?? DEFAULT_STATUS_CFG; }

// ── Gradient palette (deterministic by vendor id) ─────────────────────────────
const GRADIENTS = [
  "from-orange-400 to-rose-500",
  "from-blue-500 to-indigo-600",
  "from-emerald-400 to-teal-500",
  "from-violet-500 to-purple-600",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-fuchsia-500",
  "from-cyan-400 to-sky-500",
];
const vendorGradient = (id: number) => GRADIENTS[id % GRADIENTS.length];

// ── Vendor initials ───────────────────────────────────────────────────────────
function vendorInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, colorClass, iconBg, mono,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  colorClass: string;
  iconBg: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-4 flex items-start gap-3", colorClass)}>
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", iconBg)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-2">
          {label}
        </p>
        <p className={cn("leading-none font-bold", mono ? "text-[17px] font-mono" : "text-[24px]")}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Vendor Card (grid view) ───────────────────────────────────────────────────
function VendorCard({ vendor }: { vendor: Record<string, any> }) {
  const [, setLocation] = useLocation();
  const cfg = getStatusCfg(vendor.status ?? "Active");
  const location = [vendor.billingCity, vendor.billingState].filter(Boolean).join(", ");

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      onClick={() => setLocation(`/procurement/vendors/${vendor.id}`)}
      className={cn(
        "group flex flex-col bg-card border rounded-xl overflow-hidden cursor-pointer",
        "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]",
        "transition-shadow duration-200 border-l-[3px]",
        cfg.border,
      )}
    >
      {/* ── Card body ── */}
      <div className="p-4 flex-1">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-3.5">
          {/* Avatar */}
          <div className={cn(
            "h-9 w-9 rounded-lg bg-gradient-to-br shrink-0 flex items-center justify-center shadow-sm",
            vendorGradient(vendor.id),
          )}>
            <span className="text-[13px] font-black text-white leading-none">
              {vendorInitials(vendor.name)}
            </span>
          </div>

          {/* Status + MSME */}
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5 flex-wrap justify-end">
            {vendor.isMsme && (
              <span className="inline-flex items-center text-[9px] font-black px-1.5 py-[3px] rounded-full border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800 tracking-wide">
                MSME
              </span>
            )}
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full border",
              cfg.pill,
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
              {vendor.status ?? "Active"}
            </span>
          </div>
        </div>

        {/* Name */}
        <h3 className="text-[14px] font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1 mb-0.5">
          {vendor.name}
        </h3>
        {vendor.tradeName && vendor.tradeName !== vendor.name && (
          <p className="text-[12px] text-muted-foreground truncate mb-2">{vendor.tradeName}</p>
        )}

        {/* Location */}
        {location ? (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mt-1">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            <span className="truncate">{location}</span>
          </div>
        ) : (
          <div className="h-4" />
        )}

        {/* GSTIN */}
        {vendor.gstin && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 mt-1">
            <CreditCard className="h-3 w-3 shrink-0" />
            <span className="font-mono tracking-wide truncate">{vendor.gstin}</span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-2">
        {/* PO count */}
        <div className="flex items-center gap-1.5">
          <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-[12px] font-bold text-foreground">
            {vendor.poCount ?? 0}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {(vendor.poCount ?? 0) === 1 ? "PO" : "POs"}
          </span>
        </div>

        {/* Payment terms */}
        {vendor.paymentTerms && (
          <span className="text-[10px] text-muted-foreground/60 truncate max-w-[100px]">
            {vendor.paymentTerms}
          </span>
        )}

        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/60 transition-colors shrink-0 ml-auto" />
      </div>
    </motion.div>
  );
}

// ── Vendor Row (list view) ────────────────────────────────────────────────────
function VendorRow({ vendor }: { vendor: Record<string, any> }) {
  const [, setLocation] = useLocation();
  const cfg = getStatusCfg(vendor.status ?? "Active");
  const location = [vendor.billingCity, vendor.billingState].filter(Boolean).join(", ");

  return (
    <div
      onClick={() => setLocation(`/procurement/vendors/${vendor.id}`)}
      className="group flex items-center gap-4 px-4 py-3.5 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
    >
      {/* Left status stripe */}
      <div className={cn("h-9 w-[3px] rounded-full shrink-0", cfg.dot)} />

      {/* Avatar */}
      <div className={cn(
        "h-8 w-8 rounded-lg bg-gradient-to-br shrink-0 hidden sm:flex items-center justify-center",
        vendorGradient(vendor.id),
      )}>
        <span className="text-[11px] font-black text-white leading-none">
          {vendorInitials(vendor.name)}
        </span>
      </div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors truncate leading-snug">
            {vendor.name}
          </span>
          {vendor.isMsme && (
            <span className="text-[9px] font-black px-1.5 py-[2px] rounded-full border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800 shrink-0">
              MSME
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {vendor.gstin && (
            <span className="text-[11px] text-muted-foreground/60 font-mono tracking-wide">{vendor.gstin}</span>
          )}
          {location && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {location}
            </span>
          )}
        </div>
      </div>

      {/* Status pill */}
      <span className={cn(
        "hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full border shrink-0",
        cfg.pill,
      )}>
        <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
        {vendor.status ?? "Active"}
      </span>

      {/* PO count */}
      <div className="hidden md:flex items-center gap-1.5 w-20 shrink-0">
        <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="text-[13px] font-bold text-foreground">
          {vendor.poCount ?? 0}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {(vendor.poCount ?? 0) === 1 ? "PO" : "POs"}
        </span>
      </div>

      {/* Contact */}
      <div className="hidden lg:block min-w-0 w-36 shrink-0">
        {vendor.primaryContactName ? (
          <span className="text-[12px] text-muted-foreground truncate block">{vendor.primaryContactName}</span>
        ) : vendor.primaryEmail ? (
          <span className="text-[12px] text-muted-foreground truncate block">{vendor.primaryEmail}</span>
        ) : (
          <span className="text-[12px] text-muted-foreground/30">—</span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/25 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
    </div>
  );
}

// ── Form field error ───────────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-800/40 dark:bg-red-950/30">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" />
      <p className="text-xs leading-snug text-red-700 dark:text-red-400">{msg}</p>
    </div>
  );
}

const STATUS_OPTIONS = [
  { label: "Active",      value: "Active"      },
  { label: "Inactive",    value: "Inactive"    },
  { label: "Blacklisted", value: "Blacklisted" },
];
const EMPTY_FORM = { name: "", status: "Active", billingCountry: "India" } as Record<string, any>;

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VendorsList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode]       = useState<ViewMode>("cards");

  // Create dialog state
  const [open, setOpen]                       = useState(false);
  const [form, setForm]                       = useState<Record<string, any>>(EMPTY_FORM);
  const [errors, setErrors]                   = useState<VendorErrors>({});
  const [touched, setTouched]                 = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const qc = useQueryClient();
  const { data: rawVendors, isLoading, isError, error, refetch } = useGetVendors({});
  const vendors = Array.isArray(rawVendors) ? rawVendors : [];
  const createMut = useCreateVendor();
  const perms = usePermissions("vendors");

  // ── Form helpers ──
  const touch = (field: string) => setTouched(t => ({ ...t, [field]: true }));
  const setField = (field: string, value: any, uppercase = false) => {
    const v = uppercase ? value.toUpperCase() : value;
    const next = { ...form, [field]: v };
    setForm(next);
    if (touched[field] || submitAttempted) setErrors(validateVendorCore(next));
  };
  const showError = (field: string) =>
    (touched[field] || submitAttempted) ? errors[field] : undefined;
  const resetDialog = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setTouched({});
    setSubmitAttempted(false);
  };

  const handleCreate = () => {
    setSubmitAttempted(true);
    const e = validateVendorCore(form);
    setErrors(e);
    if (hasErrors(e)) return;
    createMut.mutate({ data: form as any }, {
      onSuccess: (v) => {
        qc.invalidateQueries({ queryKey: getGetVendorsQueryKey() });
        setOpen(false);
        resetDialog();
        setLocation(`/procurement/vendors/${v.id}`);
      },
      onError: (err: any) => {
        const apiErrors = err?.response?.data?.fields ?? err?.data?.fields;
        if (apiErrors) {
          setErrors(prev => ({ ...prev, ...apiErrors }));
        } else {
          toast({
            title: "Failed to create vendor",
            description: err?.response?.data?.error ?? err?.message ?? "Something went wrong",
            variant: "destructive",
          });
        }
      },
    });
  };
  const anyError = submitAttempted && hasErrors(errors);

  // ── Computed stats ──
  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const total = vendors.length;
    const active = vendors.filter(v => v.status === "Active").length;
    const thisMonth = vendors.filter(v => {
      try { return parseISO((v as any).createdAt) >= startOfMonth; } catch { return false; }
    }).length;
    const blacklisted = vendors.filter(v => v.status === "Blacklisted").length;
    return { total, active, thisMonth, blacklisted };
  }, [vendors]);

  // ── Counts per status (for pills) ──
  const counts = useMemo(() => {
    return STATUS_FILTERS.slice(1).reduce<Record<string, number>>((acc, s) => {
      acc[s] = vendors.filter(v => v.status === s).length;
      return acc;
    }, {});
  }, [vendors]);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    return vendors.filter(v => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (v.name ?? "").toLowerCase().includes(q) ||
        (v.tradeName ?? "").toLowerCase().includes(q) ||
        ((v as any).gstin ?? "").toLowerCase().includes(q) ||
        ((v as any).primaryEmail ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || v.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [vendors, search, statusFilter]);

  const hasFilters = search.length > 0 || statusFilter !== "all";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 pb-12"
    >
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-[20px] sm:text-[24px] font-bold text-foreground tracking-tight leading-none">
            Vendors
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Approved supplier and contractor registry
          </p>
        </div>

        {perms.canCreate && (
          <Button
            className="h-9 px-4 gap-1.5 text-[13px] font-bold bg-primary hover:bg-primary/90 text-white shrink-0 self-start sm:self-auto"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Vendor
          </Button>
        )}

        <ResponsiveDialog
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) resetDialog(); }}
          title="New Vendor"
        >
          <div className="space-y-4 pt-1">
            <div>
              <Label>Vendor Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={e => setField("name", e.target.value)}
                onBlur={() => touch("name")}
                placeholder="e.g. Waaree Energies Ltd"
                className={cn("mt-1 h-10", showError("name") && "border-red-400 focus-visible:ring-red-300")}
              />
              <FieldError msg={showError("name")} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Trade Name</Label>
                <Input value={form.tradeName ?? ""} onChange={e => setField("tradeName", e.target.value)} placeholder="e.g. SK Traders" className="mt-1 h-10" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setField("status", v)}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>GSTIN</Label>
                <Input value={form.gstin ?? ""} onChange={e => setField("gstin", e.target.value, true)} onBlur={() => touch("gstin")} placeholder="27AABCU9603R1ZX" maxLength={15} className={cn("mt-1 h-10 font-mono tracking-wide", showError("gstin") && "border-red-400 focus-visible:ring-red-300")} />
                <p className="mt-0.5 text-[11px] text-muted-foreground">{(form.gstin ?? "").length}/15 chars</p>
                <FieldError msg={showError("gstin")} />
              </div>
              <div>
                <Label>PAN</Label>
                <Input value={form.pan ?? ""} onChange={e => setField("pan", e.target.value, true)} onBlur={() => touch("pan")} placeholder="AABCU9603R" maxLength={10} className={cn("mt-1 h-10 font-mono tracking-wide", showError("pan") && "border-red-400 focus-visible:ring-red-300")} />
                <p className="mt-0.5 text-[11px] text-muted-foreground">{(form.pan ?? "").length}/10 chars</p>
                <FieldError msg={showError("pan")} />
              </div>
            </div>
            <div>
              <Label>Primary Email</Label>
              <Input type="text" inputMode="email" autoComplete="email" value={form.primaryEmail ?? ""} onChange={e => setField("primaryEmail", e.target.value)} onBlur={() => touch("primaryEmail")} placeholder="vendor@example.com" className={cn("mt-1 h-10", showError("primaryEmail") && "border-red-400 focus-visible:ring-red-300")} />
              <FieldError msg={showError("primaryEmail")} />
            </div>
            <div>
              <Label>Primary Phone</Label>
              <Input value={form.primaryPhone ?? ""} onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 10); setField("primaryPhone", v); }} onBlur={() => touch("primaryPhone")} placeholder="9876543210" maxLength={10} inputMode="numeric" className={cn("mt-1 h-10", showError("primaryPhone") && "border-red-400 focus-visible:ring-red-300")} />
              <p className="mt-0.5 text-[11px] text-muted-foreground">{(form.primaryPhone ?? "").length}/10 digits · Indian mobile</p>
              <FieldError msg={showError("primaryPhone")} />
            </div>
            {anyError && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Please fix the following before creating:</p>
                </div>
                <ul className="mt-1.5 space-y-0.5 pl-6 list-disc">
                  {Object.values(errors).map((msg, i) => <li key={i} className="text-xs text-red-600 dark:text-red-400">{msg}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { setOpen(false); resetDialog(); }}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create & Open"}
              </Button>
            </div>
          </div>
        </ResponsiveDialog>
      </div>

      {/* ── Stat bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Vendors"
          value={<span className="text-foreground">{stats.total}</span>}
          icon={Users}
          colorClass="bg-card border-border"
          iconBg="bg-muted text-muted-foreground"
        />
        <StatCard
          label="Active"
          value={<span className="text-emerald-700 dark:text-emerald-400">{stats.active}</span>}
          icon={CheckCircle2}
          colorClass="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/60"
          iconBg="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Added This Month"
          value={<span className="text-blue-700 dark:text-blue-400">{stats.thisMonth}</span>}
          icon={CalendarPlus}
          colorClass="bg-blue-50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-900/60"
          iconBg="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Blacklisted"
          value={
            <span className={stats.blacklisted > 0 ? "text-red-600 dark:text-red-400" : ""}>
              {stats.blacklisted}
            </span>
          }
          icon={TrendingUp}
          colorClass={stats.blacklisted > 0
            ? "bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-900/60"
            : "bg-card border-border"}
          iconBg={stats.blacklisted > 0
            ? "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400"
            : "bg-muted text-muted-foreground"}
        />
      </div>

      {/* ── Toolbar ── */}
      <div className="space-y-2.5">
        {/* Search + view toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, GSTIN, email…"
              className="h-8 pl-8 pr-8 text-[13px] bg-background border-border/60"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 border border-border/60 rounded-lg shrink-0">
            {([
              { mode: "cards", Icon: LayoutGrid, label: "Card view" },
              { mode: "list",  Icon: List,       label: "List view" },
            ] as const).map(({ mode, Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-all",
                  viewMode === mode
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          {/* Export */}
          {perms.canExport && (
            <ExportButton
              config={{
                title: "Vendors",
                module: "vendors",
                filename: "Procurement_Vendors",
                columns: [
                  { header: "Name",            key: "name"          },
                  { header: "Trade Name",       key: "tradeName"     },
                  { header: "Status",           key: "status"        },
                  { header: "MSME",             key: "isMsme",       formatter: (v) => v ? "Yes" : "No" },
                  { header: "GSTIN",            key: "gstin"         },
                  { header: "PAN",              key: "pan"           },
                  { header: "Email",            key: "primaryEmail"  },
                  { header: "Phone",            key: "primaryPhone"  },
                  { header: "City",             key: "billingCity"   },
                  { header: "State",            key: "billingState"  },
                ],
                getRows: () => filtered as unknown as Record<string, unknown>[],
              }}
              size="sm"
              className="h-8 text-[13px]"
            />
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => {
            const isActive = statusFilter === s;
            const count    = s === "all" ? vendors.length : (counts[s] ?? 0);
            const cfg      = s !== "all" ? getStatusCfg(s) : null;

            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "h-7 px-2.5 rounded-full text-[12px] font-medium transition-all flex items-center gap-1.5 border",
                  isActive
                    ? "bg-foreground text-background border-foreground shadow-sm font-semibold"
                    : "bg-background text-muted-foreground border-border/60 hover:border-border hover:text-foreground",
                )}
              >
                {cfg && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />}
                <span>{s === "all" ? "All" : s}</span>
                <span className={cn(
                  "text-[10px] font-bold tabular-nums",
                  isActive ? "text-background/60" : "text-muted-foreground/50",
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Error state ── */}
      {isError && (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center p-8 border-2 border-dashed border-red-200 rounded-xl">
          <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground">Failed to load vendors</p>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">
              {(error as Error)?.message ?? "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-[13px] px-4 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Content area ── */}
      {!isError && (
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SkeletonCards count={6} />
            </motion.div>

          ) : filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={Building2}
                heading={hasFilters ? "No matching vendors" : "No vendors yet"}
                message={hasFilters ? "Try adjusting your search or status filter." : "Add vendors to start raising purchase orders."}
                action={!hasFilters && perms.canCreate ? { label: "Add Vendor", onClick: () => setOpen(true) } : undefined}
              />
            </motion.div>

          ) : viewMode === "cards" ? (
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {filtered.map((vendor, i) => (
                <motion.div
                  key={vendor.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i * 0.05, 0.4) }}
                >
                  <VendorCard vendor={vendor as any} />
                </motion.div>
              ))}
            </motion.div>

          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              {/* List header */}
              <div className="hidden md:flex items-center gap-4 px-4 py-2.5 border-b border-border/60 bg-muted/30">
                <div className="w-[3px] shrink-0" />
                <div className="w-8 shrink-0 hidden sm:block" />
                <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  Vendor
                </div>
                <div className="w-24 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hidden sm:block">
                  Status
                </div>
                <div className="w-20 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hidden md:block">
                  POs
                </div>
                <div className="w-36 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hidden lg:block">
                  Contact
                </div>
                <div className="w-4 shrink-0" />
              </div>

              {filtered.map(vendor => (
                <VendorRow key={vendor.id} vendor={vendor as any} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── Count footer ── */}
      {!isLoading && !isError && filtered.length > 0 && (
        <p className="text-[12px] text-muted-foreground/50 text-center">
          Showing {filtered.length} of {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
          {statusFilter !== "all" && ` · ${statusFilter}`}
          {search && ` · "${search}"`}
        </p>
      )}
    </motion.div>
  );
}
