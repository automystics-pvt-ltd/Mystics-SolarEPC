import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  useGetVendor, getGetVendorQueryKey, useUpdateVendor,
  useAddVendorContact, useDeleteVendorContact, useDeleteVendor,
  getGetVendorsQueryKey, useGetProcurementPOs,
} from "@workspace/api-client-react";
import { apiPatch } from "@/lib/fetch";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Edit3, Save, X, Plus, Trash2, Building2, Shield, Phone, Mail, CreditCard, Users, Banknote, Star, AlertCircle, User, TrendingUp, ShoppingCart, CalendarDays, BarChart3, ChevronRight, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader, SectionCard, StatusBadge } from "@/components/shared";
import { addRecentEntry } from "@/lib/recentHistory";
import { useAuth } from "@/lib/auth";
import { validateVendorFull, validateContact, hasErrors, type VendorErrors } from "@/lib/vendor-validation";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { INDIAN_BANKS, ACCOUNT_TYPES, INDIAN_STATES, INDIAN_CITIES, COUNTRIES, GST_STATE_CODES, GST_STATE_CODE_MAP, getStatesForCountry, getCitiesForState, getStateLabel } from "@/lib/vendor-select-data";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ── Date range presets ──────────────────────────────────────────────────────── */
type SpendPreset = "ytd" | "3m" | "6m" | "12m" | "custom";

const SPEND_PRESETS: { value: SpendPreset; label: string }[] = [
  { value: "ytd",    label: "YTD" },
  { value: "3m",     label: "Last 3 months" },
  { value: "6m",     label: "Last 6 months" },
  { value: "12m",    label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetToDates(preset: SpendPreset, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  if (preset === "ytd") {
    return { from: `${now.getFullYear()}-01-01`, to: toDateStr(now) };
  }
  if (preset === "3m") {
    const d = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return { from: toDateStr(d), to: toDateStr(now) };
  }
  if (preset === "6m") {
    const d = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    return { from: toDateStr(d), to: toDateStr(now) };
  }
  if (preset === "12m") {
    const d = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
    return { from: toDateStr(d), to: toDateStr(now) };
  }
  // custom
  return { from: customFrom, to: customTo };
}

function presetLabel(preset: SpendPreset): string {
  return SPEND_PRESETS.find(p => p.value === preset)?.label ?? "Period";
}

/* ── Formatters ──────────────────────────────────────────────────────────── */
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtAmt(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function fmtAmtFull(n: number | null | undefined) {
  if (n == null) return "—";
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function monthLabel(yyyymm: string) {
  const mm = parseInt(yyyymm.split("-")[1] ?? "1", 10);
  return MONTH_LABELS[mm - 1] ?? yyyymm;
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function VendorSpendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p className="text-primary font-bold tabular-nums">{fmtAmtFull(payload[0]?.value)}</p>
    </div>
  );
}

/* ── Inline field error (top-level so it's stable across renders) ─────────── */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-800/40 dark:bg-red-950/30">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" />
      <p className="text-xs leading-snug text-red-700 dark:text-red-400">{msg}</p>
    </div>
  );
}

const STATUS_OPTS = [
  { label: "Active",      value: "Active"      },
  { label: "Inactive",    value: "Inactive"    },
  { label: "Blacklisted", value: "Blacklisted" },
];

/* ── PO status display config (shared with ProcurementPOsList) ─────────── */
const PO_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  Draft:             { color: "bg-slate-100 text-slate-600 border-slate-200",       label: "Draft" },
  Submitted:         { color: "bg-purple-50 text-purple-700 border-purple-200",     label: "Submitted" },
  PendingApproval:   { color: "bg-purple-50 text-purple-700 border-purple-200",     label: "Pending Approval" },
  Approved:          { color: "bg-emerald-50 text-emerald-700 border-emerald-200",  label: "Approved" },
  Rejected:          { color: "bg-red-50 text-red-700 border-red-200",              label: "Rejected" },
  OnHold:            { color: "bg-amber-50 text-amber-700 border-amber-200",        label: "On Hold" },
  Revised:           { color: "bg-slate-100 text-slate-600 border-slate-200",       label: "Revised" },
  Issued:            { color: "bg-blue-50 text-blue-700 border-blue-200",           label: "Issued" },
  Acknowledged:      { color: "bg-amber-50 text-amber-700 border-amber-200",        label: "Acknowledged" },
  PartiallyReceived: { color: "bg-orange-50 text-orange-700 border-orange-200",     label: "Partially Received" },
  FullyReceived:     { color: "bg-emerald-50 text-emerald-700 border-emerald-200",  label: "Fully Received" },
  InvoiceMatched:    { color: "bg-teal-50 text-teal-700 border-teal-200",           label: "Invoice Matched" },
  PaymentPending:    { color: "bg-yellow-50 text-yellow-700 border-yellow-200",     label: "Payment Pending" },
  Paid:              { color: "bg-green-50 text-green-700 border-green-200",        label: "Paid" },
  Closed:            { color: "bg-slate-100 text-slate-500 border-slate-200",       label: "Closed" },
  Cancelled:         { color: "bg-red-50 text-red-700 border-red-200",              label: "Cancelled" },
};

/* ── Vendor Purchase Orders inline panel ─────────────────────────────────── */
function VendorPOsTab({ vendorId, onNavigate }: { vendorId: number; onNavigate: (path: string) => void }) {
  const { data: pos = [], isLoading, isError, refetch } = useGetProcurementPOs({ vendorId });

  const totalValue = pos.reduce((s, p) => s + Number(p.totalAmount ?? 0), 0);

  if (isLoading) {
    return (
      <SectionCard title="Purchase Orders">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-xl shimmer" />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (isError) {
    return (
      <SectionCard title="Purchase Orders">
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center border-2 border-dashed border-red-200 rounded-xl">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <p className="text-sm font-semibold text-foreground">Failed to load purchase orders</p>
          <button
            onClick={() => refetch()}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
          >
            Retry
          </button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Purchase Orders"
      actions={
        pos.length > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {pos.length} order{pos.length !== 1 ? "s" : ""} ·{" "}
            ₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} total
          </span>
        ) : undefined
      }
    >
      {pos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-slate-200 rounded-xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-600">No purchase orders yet</p>
          <p className="text-xs text-slate-400">POs raised for this vendor will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pos.map((po) => {
            const cfg = PO_STATUS_CONFIG[po.status ?? "Draft"] ?? PO_STATUS_CONFIG["Draft"]!;
            const today = new Date().toISOString().split("T")[0];
            const deadline = (po as any).deliveryDeadline ?? (po as any).expectedDeliveryDate;
            const overdue = (po as any).isOverdue || (deadline && deadline < today! && !["Closed", "Cancelled", "FullyReceived"].includes(po.status ?? ""));
            const isPendingApproval = ["Submitted", "PendingApproval"].includes(po.status ?? "");
            const isRejected = po.status === "Rejected";

            return (
              <div
                key={po.id}
                onClick={() => onNavigate(`/procurement/pos/${po.id}`)}
                className={cn(
                  "bg-white border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-sm transition-all group",
                  overdue
                    ? "border-red-200 hover:border-red-300"
                    : isRejected
                    ? "border-red-100 hover:border-red-200"
                    : isPendingApproval
                    ? "border-purple-200 hover:border-purple-300"
                    : "border-slate-200 hover:border-orange-200"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    overdue ? "bg-red-50" : isPendingApproval ? "bg-purple-50" : "bg-slate-100"
                  )}
                >
                  <ShoppingCart
                    className={cn(
                      "w-4 h-4",
                      overdue ? "text-red-400" : isPendingApproval ? "text-purple-400" : "text-slate-400"
                    )}
                  />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono font-bold text-slate-900 text-sm">{po.poNumber}</span>
                    <Badge variant="outline" className={cn("text-xs", cfg.color)}>{cfg.label}</Badge>
                    {overdue && (
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                        Overdue
                      </Badge>
                    )}
                    {isRejected && (
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Rejected
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    {po.poDate && <span>{new Date(po.poDate).toLocaleDateString("en-IN")}</span>}
                    {po.approvedByName && <span>· Approved by {po.approvedByName}</span>}
                    {(po as any).category && <span>· {(po as any).category}</span>}
                  </div>
                </div>

                {/* Amount + deadline */}
                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-900 font-mono text-sm">
                    ₹{Number(po.totalAmount ?? 0).toLocaleString("en-IN")}
                  </p>
                  {isPendingApproval && (
                    <p className="text-xs mt-0.5 text-purple-600 font-semibold">⏳ Awaiting approval</p>
                  )}
                  {!isPendingApproval && deadline && (
                    <p className={cn("text-xs mt-0.5", overdue ? "text-red-600 font-semibold" : "text-slate-400")}>
                      {overdue ? "⚠ " : ""}Deliver by {deadline}
                    </p>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-400 shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export default function VendorDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const vendorId = Number(id);
  const { user: authUser } = useAuth();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [editErrors, setEditErrors] = useState<VendorErrors>({});
  const [editTouched, setEditTouched] = useState<Record<string, boolean>>({});
  const [editSubmitted, setEditSubmitted] = useState(false);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState<Record<string, any>>({ name: "", isPrimary: false });
  const [contactErrors, setContactErrors] = useState<VendorErrors>({});
  const [contactTouched, setContactTouched] = useState<Record<string, boolean>>({});
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // ── Spend date range state ──────────────────────────────────────────────────
  const [spendPreset, setSpendPreset] = useState<SpendPreset>("ytd");
  const now = new Date();
  const [customFrom, setCustomFrom] = useState(`${now.getFullYear()}-01-01`);
  const [customTo,   setCustomTo  ] = useState(toDateStr(now));

  const spendDates = useMemo(
    () => presetToDates(spendPreset, customFrom, customTo),
    [spendPreset, customFrom, customTo]
  );

  const { data: vendor, isLoading } = useGetVendor(vendorId, {
    query: { enabled: !!vendorId, queryKey: getGetVendorQueryKey(vendorId) }
  });

  const { data: statsData } = useQuery({
    queryKey: ["vendor-stats", vendorId, spendDates.from, spendDates.to],
    queryFn: async () => {
      const token = localStorage.getItem("mystics_token");
      const params = new URLSearchParams({ from: spendDates.from, to: spendDates.to });
      const res = await fetch(`/api/vendors/${vendorId}/stats?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{
        monthlySpend: { month: string; amount: number }[];
        ytdSpend: number;
        periodSpend: number;
        poCount: number;
        avgPoValue: number;
        lastPoDate: string | null;
        lastPoNumber: string | null;
      }>;
    },
    enabled: !!vendorId,
  });

  useEffect(() => {
    if (vendor?.name && authUser?.id)
      addRecentEntry(authUser.id, `/procurement/vendors/${vendorId}`, vendor.name, "Vendors");
  }, [vendor?.name, vendorId, authUser?.id]);

  const updateMut         = useUpdateVendor();
  const addContactMut     = useAddVendorContact();
  const delContactMut     = useDeleteVendorContact();
  const deleteMut         = useDeleteVendor();
  const setPrimaryMut     = useMutation({
    mutationFn: ({ cid }: { cid: number }) =>
      apiPatch<unknown>(`/vendors/${vendorId}/contacts/${cid}/set-primary`),
    // Optimistic update: flip isPrimary in the cache instantly so the star
    // switches without waiting for a refetch.
    onMutate: async ({ cid }) => {
      await qc.cancelQueries({ queryKey: getGetVendorQueryKey(vendorId) });
      const prev = qc.getQueryData(getGetVendorQueryKey(vendorId));
      qc.setQueryData(getGetVendorQueryKey(vendorId), (old: any) => {
        if (!old) return old;
        const contacts = (old.contacts ?? []).map((c: any) => ({
          ...c,
          isPrimary: c.id === cid,
        }));
        const primary = contacts.find((c: any) => c.id === cid);
        return {
          ...old,
          contacts,
          primaryContactName:        primary?.name ?? old.primaryContactName,
          primaryContactDesignation: primary?.designation ?? old.primaryContactDesignation,
          primaryContactPhone:       primary?.phone ?? old.primaryContactPhone,
          primaryContactEmail:       primary?.email ?? old.primaryContactEmail,
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back on failure
      if (ctx?.prev) qc.setQueryData(getGetVendorQueryKey(vendorId), ctx.prev);
      toast({ title: "Failed to update primary contact", variant: "destructive" });
    },
    onSuccess: () => {
      // Refetch to get authoritative server state, and update the vendor list
      qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
      qc.invalidateQueries({ queryKey: getGetVendorsQueryKey() });
      toast({ title: "Primary contact updated" });
    },
  });

  if (isLoading || !vendor) return (
    <div className="flex h-60 items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading vendor…</div>
    </div>
  );

  /* ── Edit helpers ── */
  const touchEdit = (field: string) => setEditTouched(t => ({ ...t, [field]: true }));

  const setEditField = (field: string, value: any, uppercase = false) => {
    const v = uppercase ? String(value).toUpperCase() : value;
    const next = { ...form, [field]: v };
    // Auto-fill GST State Code when the registered state is selected
    if (field === "gstRegisteredState" && GST_STATE_CODE_MAP[v]) {
      next.gstStateCode = GST_STATE_CODE_MAP[v];
    }
    // Billing cascade: country change clears state + city; state change clears city
    if (field === "billingCountry") {
      next.billingState = "";
      next.billingCity  = "";
    }
    if (field === "billingState") {
      next.billingCity = "";
    }
    setForm(next);
    if (editTouched[field] || editSubmitted)
      setEditErrors(validateVendorFull(next));
  };

  const showEditError = (field: string) =>
    (editTouched[field] || editSubmitted) ? editErrors[field] : undefined;

  const startEdit = () => {
    setForm({ ...vendor });
    setEditing(true);
    setEditErrors({});
    setEditTouched({});
    setEditSubmitted(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditErrors({});
    setEditTouched({});
    setEditSubmitted(false);
  };

  const saveEdit = () => {
    setEditSubmitted(true);
    const e = validateVendorFull(form);
    setEditErrors(e);
    if (hasErrors(e)) return;

    updateMut.mutate({ id: vendorId, data: form as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
        setEditing(false);
        setEditSubmitted(false);
        toast({ title: "Vendor updated successfully" });
      },
      onError: (err: any) => {
        const apiFields = err?.response?.data?.fields ?? err?.data?.fields;
        if (apiFields) {
          setEditErrors(prev => ({ ...prev, ...apiFields }));
          toast({ title: "Validation failed", description: "Please check the highlighted fields.", variant: "destructive" });
        } else {
          toast({
            title: "Update failed",
            description: err?.response?.data?.error ?? err?.message ?? "Something went wrong",
            variant: "destructive",
          });
        }
      },
    });
  };

  /* ── Contact helpers ── */
  const touchContact = (field: string) => setContactTouched(t => ({ ...t, [field]: true }));

  const setContactField = (field: string, value: any) => {
    const next = { ...contactForm, [field]: value };
    setContactForm(next);
    if (contactTouched[field] || contactSubmitted)
      setContactErrors(validateContact(next));
  };

  const showContactError = (field: string) =>
    (contactTouched[field] || contactSubmitted) ? contactErrors[field] : undefined;

  const resetContactForm = () => {
    setContactForm({ name: "", isPrimary: false });
    setContactErrors({});
    setContactTouched({});
    setContactSubmitted(false);
  };

  const addContact = () => {
    setContactSubmitted(true);
    const e = validateContact(contactForm);
    setContactErrors(e);
    if (hasErrors(e)) return;

    addContactMut.mutate({ id: vendorId, data: contactForm as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
        setContactOpen(false);
        resetContactForm();
        toast({ title: "Contact added" });
      },
      onError: (err: any) => {
        const apiFields = err?.response?.data?.fields ?? err?.data?.fields;
        if (apiFields) {
          setContactErrors(prev => ({ ...prev, ...apiFields }));
        } else {
          toast({
            title: "Failed to add contact",
            description: err?.response?.data?.error ?? err?.message ?? "Something went wrong",
            variant: "destructive",
          });
        }
      },
    });
  };

  const delContact = (cid: number) => {
    delContactMut.mutate({ id: vendorId, cid }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
        toast({ title: "Contact removed" });
      },
      onError: () => toast({ title: "Failed to remove contact", variant: "destructive" }),
    });
  };

  const deleteVendor = () => {
    deleteMut.mutate({ id: vendorId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorsQueryKey() });
        toast({ title: "Vendor deleted" });
        setLocation("/procurement/vendors");
      },
      onError: () => toast({ title: "Failed to delete vendor", variant: "destructive" }),
    });
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * Field renderer helpers — called as FUNCTIONS not as JSX components.
   * Defining them as React components inside the parent body causes React to
   * treat them as a new component type on every render → unmount/remount →
   * inputs lose focus after each keystroke. Calling them as plain functions
   * avoids that entirely.
   * ────────────────────────────────────────────────────────────────────────── */

  /** Generic text / email field */
  function renderField({
    label, field, type = "text", placeholder = "",
    uppercase = false, hint = "", mono = false,
  }: {
    label: string; field: string; type?: string; placeholder?: string;
    uppercase?: boolean; hint?: string; mono?: boolean;
  }) {
    return (
      <div>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {editing ? (
          <>
            <Input
              type={type}
              value={form[field] ?? ""}
              onChange={e => setEditField(field, e.target.value, uppercase)}
              onBlur={() => touchEdit(field)}
              placeholder={placeholder}
              className={cn(
                "mt-1 h-9",
                mono && "font-mono tracking-wide",
                showEditError(field) && "border-red-400 focus-visible:ring-red-300"
              )}
            />
            {hint && !showEditError(field) && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
            )}
            <FieldError msg={showEditError(field)} />
          </>
        ) : (
          <p className={cn("mt-1 text-sm font-medium text-foreground", mono && "font-mono tracking-wide")}>
            {(vendor as any)[field] || <span className="text-muted-foreground/40 font-normal">—</span>}
          </p>
        )}
      </div>
    );
  }

  /** Digits-only phone field (max 10) */
  function renderPhone({ label, field }: { label: string; field: string }) {
    return (
      <div>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {editing ? (
          <>
            <Input
              inputMode="numeric"
              value={form[field] ?? ""}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                setEditField(field, v);
              }}
              onBlur={() => touchEdit(field)}
              placeholder="9876543210"
              maxLength={10}
              className={cn("mt-1 h-9", showEditError(field) && "border-red-400 focus-visible:ring-red-300")}
            />
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {(form[field] ?? "").length}/10 digits
            </p>
            <FieldError msg={showEditError(field)} />
          </>
        ) : (
          <p className="mt-1 text-sm font-medium text-foreground">
            {(vendor as any)[field] || <span className="text-muted-foreground/40 font-normal">—</span>}
          </p>
        )}
      </div>
    );
  }

  /** Searchable combobox field */
  function renderCombobox({
    label, field, options, searchPlaceholder, allowCustom = false, disabled = false,
  }: {
    label: string; field: string; options: SelectOption[];
    searchPlaceholder?: string; allowCustom?: boolean; disabled?: boolean;
  }) {
    return (
      <div>
        <Label className={cn("text-xs", disabled ? "text-muted-foreground/50" : "text-muted-foreground")}>{label}</Label>
        {editing ? (
          <>
            <div className="mt-1">
              <SearchableSelect
                value={disabled ? "" : (form[field] ?? "")}
                onChange={v => setEditField(field, v)}
                options={options}
                placeholder={disabled ? "Select country first…" : `Select ${label.toLowerCase()}…`}
                searchPlaceholder={searchPlaceholder ?? `Search ${label.toLowerCase()}…`}
                allowCustom={allowCustom}
                error={!!showEditError(field)}
                disabled={disabled}
              />
            </div>
            <FieldError msg={showEditError(field)} />
          </>
        ) : (
          <p className="mt-1 text-sm font-medium text-foreground">
            {(vendor as any)[field] || <span className="text-muted-foreground/40 font-normal">—</span>}
          </p>
        )}
      </div>
    );
  }

  /** Status select */
  function renderStatus() {
    return (
      <div>
        <Label className="text-xs text-muted-foreground">Status</Label>
        {editing ? (
          <Select value={form.status ?? "Active"} onValueChange={v => setEditField("status", v)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className="mt-1"><StatusBadge status={(vendor as any).status ?? "Active"} /></div>
        )}
      </div>
    );
  }

  /* ── Page actions ── */
  const editErrorCount = Object.keys(editErrors).length;
  const editActions = editing ? (
    <>
      {editSubmitted && editErrorCount > 0 && (
        <span className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400 mr-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {editErrorCount} field{editErrorCount !== 1 ? "s" : ""} need{editErrorCount === 1 ? "s" : ""} attention
        </span>
      )}
      <Button variant="outline" size="sm" onClick={cancelEdit}><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
      <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending}>
        <Save className="w-3.5 h-3.5 mr-1" />{updateMut.isPending ? "Saving…" : "Save"}
      </Button>
    </>
  ) : (
    <>
      <Button variant="outline" size="sm" onClick={startEdit}><Edit3 className="w-3.5 h-3.5 mr-1" /> Edit</Button>

      {/* Delete vendor */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:border-red-300">
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{vendor.name}</strong> and all associated contacts.
              Any purchase orders linked to this vendor will retain their data but the vendor record will be gone.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteVendor}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete vendor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title={vendor.name ?? ""}
        subtitle={`${(vendor as any).type ?? ""} ${(vendor as any).gstin ? `· GSTIN: ${(vendor as any).gstin}` : ""}`.trim()}
        backHref="/procurement/vendors"
        badge={
          <div className="flex items-center gap-1.5">
            <StatusBadge status={vendor.status ?? "Active"} />
            {(vendor as any).isMsme && (
              <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60">MSME</Badge>
            )}
          </div>
        }
        actions={editActions}
      />

      {/* Status bar */}
      {(() => {
        const contacts: any[] = (vendor as any).contacts ?? [];
        const primaryContact = contacts.find((c: any) => c.isPrimary) ?? contacts[0] ?? null;
        return (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 rounded-xl border border-border bg-card shadow-sm">
            {/* Vendor identity */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-foreground">{vendor.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {vendor.code}{(vendor as any).tradeName ? ` · ${(vendor as any).tradeName}` : ""}
                </p>
              </div>
            </div>

            <span className="text-muted-foreground/30 select-none">|</span>
            <StatusBadge status={vendor.status ?? "Active"} />

            {/* Primary contact */}
            {primaryContact && (
              <>
                <span className="text-muted-foreground/30 select-none">|</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[11px] font-bold text-primary uppercase">
                    {primaryContact.name?.[0] ?? "?"}
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-foreground leading-tight">{primaryContact.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {primaryContact.designation ? `${primaryContact.designation} · ` : ""}Primary Contact
                    </p>
                  </div>
                </div>
                {primaryContact.phone && (
                  <a href={`tel:${primaryContact.phone}`} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="w-3 h-3" />{primaryContact.phone}
                  </a>
                )}
                {primaryContact.email && (
                  <a href={`mailto:${primaryContact.email}`} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="w-3 h-3" />{primaryContact.email}
                  </a>
                )}
              </>
            )}

            {/* No contacts nudge */}
            {!primaryContact && (
              <>
                <span className="text-muted-foreground/30 select-none">|</span>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  No contacts added yet
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── Spend Performance ── */}
      {(() => {
        // Determine if the range spans multiple years (to show year in month labels)
        const spansYears = spendDates.from.slice(0, 4) !== spendDates.to.slice(0, 4);
        const chartData = (statsData?.monthlySpend ?? []).map(m => ({
          month: spansYears
            ? `${monthLabel(m.month)} '${m.month.slice(2, 4)}`
            : monthLabel(m.month),
          amount: m.amount,
        }));
        const periodSpend = statsData?.periodSpend ?? statsData?.ytdSpend ?? 0;
        const hasSpend = periodSpend > 0 || (statsData?.poCount ?? 0) > 0;
        const kpiSpendLabel = spendPreset === "ytd" ? "YTD Spend" : "Period Spend";

        const kpis = [
          {
            icon: TrendingUp,
            label: kpiSpendLabel,
            value: fmtAmt(periodSpend),
            accent: "amber",
          },
          {
            icon: ShoppingCart,
            label: "Total POs",
            value: statsData?.poCount != null ? String(statsData.poCount) : "—",
            accent: "blue",
          },
          {
            icon: BarChart3,
            label: "Avg PO Value",
            value: fmtAmt(statsData?.avgPoValue),
            accent: "violet",
          },
          {
            icon: CalendarDays,
            label: "Last PO",
            value: statsData?.lastPoDate ? fmtDate(statsData.lastPoDate) : "—",
            accent: "emerald",
          },
        ] as const;

        const accentMap = {
          amber:   "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-400",
          blue:    "bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800/40 dark:text-blue-400",
          violet:  "bg-violet-50 border-violet-100 text-violet-700 dark:bg-violet-950/30 dark:border-violet-800/40 dark:text-violet-400",
          emerald: "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-400",
        } as const;

        return (
          <SectionCard
            title="Spend Performance"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {/* Preset selector */}
                <Select value={spendPreset} onValueChange={v => setSpendPreset(v as SpendPreset)}>
                  <SelectTrigger className="h-7 text-xs gap-1 px-2.5 w-auto min-w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {SPEND_PRESETS.map(p => (
                      <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Custom date inputs shown only for "custom" preset */}
                {spendPreset === "custom" && (
                  <>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      max={customTo}
                      className="h-7 text-xs px-2 w-[130px]"
                    />
                    <span className="text-[11px] text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      min={customFrom}
                      max={toDateStr(new Date())}
                      className="h-7 text-xs px-2 w-[130px]"
                    />
                  </>
                )}

                {/* Subtitle showing the resolved range */}
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {spendDates.from} – {spendDates.to} · received POs
                </span>
              </div>
            }
          >
            {/* KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {kpis.map(({ icon: Icon, label, value, accent }) => (
                <div key={label} className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3",
                  accentMap[accent]
                )}>
                  <Icon className="w-4 h-4 shrink-0 opacity-70" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none mb-0.5">{label}</p>
                    <p className="text-[15px] font-bold leading-tight truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Area Chart */}
            {!statsData ? (
              <div className="h-[160px] animate-pulse bg-muted/40 rounded-xl" />
            ) : !hasSpend ? (
              <div className="h-[160px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground gap-2">
                <BarChart3 className="w-6 h-6 opacity-40" />
                <p className="text-sm">No spend data for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="vsg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#f97316" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false} tickLine={false} width={42}
                    tickFormatter={v => v >= 100_000 ? `${(v / 100_000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                  />
                  <Tooltip content={<VendorSpendTooltip />} />
                  <Area type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={2} fill="url(#vsg)"
                    dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#f97316", strokeWidth: 2, stroke: "#fff" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        );
      })()}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details"><Shield className="w-3.5 h-3.5 mr-1.5" /> GST &amp; Details</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="w-3.5 h-3.5 mr-1.5" /> Contacts ({(vendor as any).contacts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="bank"><Banknote className="w-3.5 h-3.5 mr-1.5" /> Bank Details</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="w-3.5 h-3.5 mr-1.5" /> Billing Address</TabsTrigger>
          <TabsTrigger value="pos"><ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Purchase Orders</TabsTrigger>
        </TabsList>

        {/* ── GST & Details ── */}
        <TabsContent value="details" className="mt-4 space-y-4">
          <SectionCard title="GST Information">
            <div className="grid grid-cols-2 gap-4">
              {renderField({ label: "GSTIN", field: "gstin", placeholder: "27AABCU9603R1ZX", uppercase: true, mono: true, hint: `${(form.gstin ?? "").length}/15 chars` })}
              {renderField({ label: "PAN", field: "pan", placeholder: "AABCU9603R", uppercase: true, mono: true, hint: `${(form.pan ?? "").length}/10 chars` })}
              {renderCombobox({ label: "GST Registered State", field: "gstRegisteredState", options: INDIAN_STATES, searchPlaceholder: "Search state…" })}
              {renderCombobox({ label: "State Code", field: "gstStateCode", options: GST_STATE_CODES, searchPlaceholder: "Search code…", allowCustom: true })}
            </div>
            <div className="flex items-center gap-3 pt-2 mt-2">
              <input
                type="checkbox"
                id="msme"
                checked={editing ? (form.isMsme ?? false) : ((vendor as any).isMsme ?? false)}
                onChange={e => editing && setEditField("isMsme", e.target.checked)}
                disabled={!editing}
                className="w-4 h-4"
              />
              <label htmlFor="msme" className="text-sm">MSME Registered</label>
              {(editing ? form.isMsme : (vendor as any).isMsme) && (
                renderField({ label: "MSME Number", field: "msmeNumber" })
              )}
            </div>
          </SectionCard>

          <SectionCard title="Contact &amp; Terms">
            <div className="grid grid-cols-2 gap-4">
              {renderStatus()}
              {renderField({ label: "Website", field: "website", placeholder: "https://vendor.com" })}
              {renderField({ label: "Primary Email", field: "primaryEmail", placeholder: "vendor@example.com" })}
              {renderPhone({ label: "Primary Phone", field: "primaryPhone" })}
              {renderField({ label: "Payment Terms", field: "paymentTerms", placeholder: "e.g. Net 30" })}
              {renderField({ label: "Credit Limit", field: "creditLimit", placeholder: "e.g. ₹5,00,000" })}
            </div>
            {editing ? (
              <div className="mt-4">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea value={form.notes ?? ""} onChange={e => setEditField("notes", e.target.value)} className="mt-1" rows={2} />
              </div>
            ) : (vendor as any).notes ? (
              <div className="mt-4">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <p className="mt-1 text-sm text-foreground">{(vendor as any).notes}</p>
              </div>
            ) : null}
          </SectionCard>
        </TabsContent>

        {/* ── Contacts ── */}
        <TabsContent value="contacts" className="mt-4 space-y-3">
          <SectionCard
            title="Contacts"
            actions={
              <Dialog open={contactOpen} onOpenChange={(v) => { setContactOpen(v); if (!v) resetContactForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Contact</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    {/* Name */}
                    <div>
                      <Label>Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={contactForm.name}
                        onChange={e => setContactField("name", e.target.value)}
                        onBlur={() => touchContact("name")}
                        placeholder="e.g. Rajesh Kumar"
                        className={cn("mt-1", showContactError("name") && "border-red-400 focus-visible:ring-red-300")}
                      />
                      <FieldError msg={showContactError("name")} />
                    </div>

                    {/* Designation */}
                    <div>
                      <Label>Designation</Label>
                      <Input
                        value={contactForm.designation ?? ""}
                        onChange={e => setContactField("designation", e.target.value)}
                        placeholder="e.g. Sales Manager"
                        className="mt-1"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={contactForm.email ?? ""}
                        onChange={e => setContactField("email", e.target.value)}
                        onBlur={() => touchContact("email")}
                        placeholder="contact@vendor.com"
                        className={cn("mt-1", showContactError("email") && "border-red-400 focus-visible:ring-red-300")}
                      />
                      <FieldError msg={showContactError("email")} />
                    </div>

                    {/* Phone */}
                    <div>
                      <Label>Phone</Label>
                      <Input
                        inputMode="numeric"
                        value={contactForm.phone ?? ""}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setContactField("phone", v);
                        }}
                        onBlur={() => touchContact("phone")}
                        placeholder="9876543210"
                        maxLength={10}
                        className={cn("mt-1", showContactError("phone") && "border-red-400 focus-visible:ring-red-300")}
                      />
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {(contactForm.phone ?? "").length}/10 digits
                      </p>
                      <FieldError msg={showContactError("phone")} />
                    </div>

                    {/* Primary toggle */}
                    <button
                      type="button"
                      onClick={() => setContactField("isPrimary", !contactForm.isPrimary)}
                      className={cn(
                        "flex items-center gap-2 w-full rounded-lg border px-3 py-2.5 text-sm transition-colors",
                        contactForm.isPrimary
                          ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          : "border-border bg-muted/20 text-muted-foreground hover:border-amber-200 hover:text-amber-600"
                      )}
                    >
                      <Star className={cn("w-4 h-4 shrink-0", contactForm.isPrimary && "fill-amber-500 text-amber-500")} />
                      <span className="font-medium">
                        {contactForm.isPrimary ? "Will be set as primary contact" : "Set as primary contact"}
                      </span>
                      {contactForm.isPrimary && (
                        <span className="ml-auto text-[11px] opacity-60">click to unset</span>
                      )}
                    </button>

                    {contactSubmitted && hasErrors(contactErrors) && (
                      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/30 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Please fix the following:</p>
                        </div>
                        <ul className="mt-1.5 space-y-0.5 pl-6 list-disc">
                          {Object.values(contactErrors).map((msg, i) => (
                            <li key={i} className="text-xs text-red-600 dark:text-red-400">{msg}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => { setContactOpen(false); resetContactForm(); }}>Cancel</Button>
                      <Button onClick={addContact} disabled={addContactMut.isPending}>
                        {addContactMut.isPending ? "Adding…" : "Add Contact"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            }
          >
            {!(vendor as any).contacts?.length ? (
              <div className="text-center py-10 border-2 border-dashed border-border rounded-xl text-muted-foreground">
                No contacts added yet
              </div>
            ) : (
              <div className="space-y-2">
                {((vendor as any).contacts ?? []).map((c: any) => (
                  <div
                    key={c.id}
                    className={cn(
                      "border rounded-xl p-4 flex items-center gap-4 transition-colors",
                      c.isPrimary
                        ? "bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/50"
                        : "bg-muted/20 border-border"
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                      c.isPrimary
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {c.name[0]?.toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{c.name}</span>
                        {c.isPrimary && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60">
                            <Star className="w-2.5 h-2.5 mr-0.5 fill-amber-500" /> Primary
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                        {c.designation && <span>{c.designation}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                      </div>
                    </div>

                    {/* Set Primary star — shown only for non-primary contacts */}
                    {!c.isPrimary && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground/40 hover:text-amber-500 shrink-0"
                        title="Set as primary contact"
                        onClick={() => setPrimaryMut.mutate({ cid: c.id })}
                        disabled={setPrimaryMut.isPending}
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Delete */}
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500 shrink-0"
                      onClick={() => delContact(c.id)}
                      disabled={delContactMut.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── Bank ── */}
        <TabsContent value="bank" className="mt-4">
          <SectionCard title="Bank Account Details">
            <div className="grid grid-cols-2 gap-4">
              {renderCombobox({ label: "Bank Name", field: "bankName", options: INDIAN_BANKS, searchPlaceholder: "Search bank…", allowCustom: true })}
              {renderCombobox({ label: "Branch / Location", field: "bankBranch", options: INDIAN_CITIES, searchPlaceholder: "Search city or area…", allowCustom: true })}
              {/* Account Number — special digit-only input */}
              <div>
                <Label className="text-xs text-muted-foreground">Account Number</Label>
                {editing ? (
                  <>
                    <Input
                      inputMode="numeric"
                      value={form.bankAccountNumber ?? ""}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 18);
                        setEditField("bankAccountNumber", v);
                      }}
                      onBlur={() => touchEdit("bankAccountNumber")}
                      placeholder="9–18 digits"
                      maxLength={18}
                      className={cn("mt-1 h-9 font-mono", showEditError("bankAccountNumber") && "border-red-400 focus-visible:ring-red-300")}
                    />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{(form.bankAccountNumber ?? "").length}/18 digits</p>
                    <FieldError msg={showEditError("bankAccountNumber")} />
                  </>
                ) : (
                  <p className="mt-1 text-sm font-medium font-mono text-foreground">
                    {(vendor as any).bankAccountNumber || <span className="text-muted-foreground/40 font-normal font-sans">—</span>}
                  </p>
                )}
              </div>
              {renderField({ label: "IFSC Code", field: "bankIfsc", placeholder: "SBIN0001234", uppercase: true, mono: true, hint: `${(form.bankIfsc ?? "").length}/11 chars` })}
              {renderCombobox({ label: "Account Type", field: "bankAccountType", options: ACCOUNT_TYPES, searchPlaceholder: "Search account type…" })}
              {renderField({ label: "UPI ID", field: "upiId", placeholder: "vendor@upi" })}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── Purchase Orders ── */}
        <TabsContent value="pos" className="mt-4">
          <VendorPOsTab vendorId={vendorId} onNavigate={setLocation} />
        </TabsContent>

        {/* ── Billing ── */}
        <TabsContent value="billing" className="mt-4">
          <SectionCard title="Billing Address">
            {(() => {
              const country       = form.billingCountry ?? "";
              const state         = form.billingState   ?? "";
              const stateOptions  = getStatesForCountry(country);
              const hasStateList  = stateOptions.length > 0;
              const cityOptions   = getCitiesForState(country, state);
              const stateLabel    = getStateLabel(country) || "State / Province";
              const pincodeLabel  = country === "United States" ? "ZIP Code"
                                  : country === "United Kingdom" ? "Postcode"
                                  : country === "Canada"         ? "Postal Code"
                                  : "Pincode / Postal Code";
              const pincodeMaxLen = country === "India" ? 6 : 10;
              const pincodeMask   = country === "India" ? /\D/g : /[^A-Za-z0-9 -]/g;

              return (
                <div className="grid grid-cols-2 gap-4">
                  {/* ① Full-width address line */}
                  <div className="col-span-2">
                    {renderField({ label: "Address Line", field: "billingAddress", placeholder: "Street, building, floor…" })}
                  </div>

                  {/* ② Country — always first, drives the cascade */}
                  {renderCombobox({
                    label: "Country",
                    field: "billingCountry",
                    options: COUNTRIES,
                    searchPlaceholder: "Search country…",
                  })}

                  {/* ③ State/Province — filtered by country; disabled until country chosen */}
                  {!country ? (
                    renderCombobox({ label: "State / Province", field: "billingState", options: [], disabled: true })
                  ) : hasStateList ? (
                    renderCombobox({
                      label: stateLabel,
                      field: "billingState",
                      options: stateOptions,
                      searchPlaceholder: `Search ${stateLabel.toLowerCase()}…`,
                    })
                  ) : (
                    /* Country exists but has no predefined list → free-text */
                    renderField({ label: stateLabel, field: "billingState", placeholder: `Enter ${stateLabel.toLowerCase()}` })
                  )}

                  {/* ④ City — filtered by country+state; disabled until country chosen */}
                  {renderCombobox({
                    label: "City",
                    field: "billingCity",
                    options: cityOptions,
                    searchPlaceholder: state
                      ? `Cities in ${state}…`
                      : country
                        ? "Search or type city…"
                        : "Select country first…",
                    allowCustom: true,
                    disabled: !country,
                  })}

                  {/* ⑤ Pincode/ZIP — digit-only with country-aware constraints */}
                  <div>
                    <Label className="text-xs text-muted-foreground">{pincodeLabel}</Label>
                    {editing ? (
                      <>
                        <Input
                          inputMode="numeric"
                          value={form.billingPincode ?? ""}
                          onChange={e => {
                            const v = e.target.value.replace(pincodeMask, "").slice(0, pincodeMaxLen);
                            setEditField("billingPincode", v);
                          }}
                          onBlur={() => touchEdit("billingPincode")}
                          placeholder={country === "India" ? "110001" : country === "United States" ? "10001" : "Postal code"}
                          maxLength={pincodeMaxLen}
                          className={cn("mt-1 h-9", showEditError("billingPincode") && "border-red-400 focus-visible:ring-red-300")}
                        />
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {(form.billingPincode ?? "").length}/{pincodeMaxLen} chars
                        </p>
                        <FieldError msg={showEditError("billingPincode")} />
                      </>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {(vendor as any).billingPincode || <span className="text-muted-foreground/40 font-normal">—</span>}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
