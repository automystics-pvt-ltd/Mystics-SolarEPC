import { useState } from "react";
import { useGetVendors, useCreateVendor, getGetVendorsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Building2, AlertCircle, ShoppingCart } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "@/components/shared";
import { usePermissions } from "@/lib/permissions";
import { useToast } from "@/components/ui/use-toast";
import { validateVendorCore, hasErrors, type VendorErrors } from "@/lib/vendor-validation";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { label: "Active",      value: "Active"      },
  { label: "Inactive",    value: "Inactive"    },
  { label: "Blacklisted", value: "Blacklisted" },
];

const EMPTY_FORM = { name: "", status: "Active", billingCountry: "India" } as Record<string, any>;

/* ── Inline field error ──────────────────────────────────────────────────── */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-800/40 dark:bg-red-950/30">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" />
      <p className="text-xs leading-snug text-red-700 dark:text-red-400">{msg}</p>
    </div>
  );
}

export default function VendorsList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(EMPTY_FORM);
  const [errors, setErrors] = useState<VendorErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const qc = useQueryClient();

  const { data: vendors = [], isLoading, isError, error, refetch } = useGetVendors({});
  const createMut = useCreateVendor();
  const perms = usePermissions("vendors");

  /* ── Helpers ── */
  const touch = (field: string) => setTouched(t => ({ ...t, [field]: true }));

  const setField = (field: string, value: any, uppercase = false) => {
    const v = uppercase ? value.toUpperCase() : value;
    const next = { ...form, [field]: v };
    setForm(next);
    // Revalidate eagerly once a field has been touched or submit was attempted
    if (touched[field] || submitAttempted) {
      setErrors(validateVendorCore(next));
    }
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
        // Parse server-side field errors if available
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

  /* ── Table columns ── */
  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-sm text-foreground">{row.original.name}</p>
          {row.original.tradeName && (
            <p className="text-xs text-muted-foreground">{row.original.tradeName}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "gstin",
      header: "GSTIN",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground font-mono tracking-wide">
          {row.original.gstin ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "primaryContactName",
      header: "Primary Contact",
      cell: ({ row }) => (
        <div>
          <p className="text-sm text-foreground">
            {row.original.primaryContactName ?? <span className="text-muted-foreground">—</span>}
          </p>
          {row.original.primaryContactDesignation && (
            <p className="text-xs text-muted-foreground">{row.original.primaryContactDesignation}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "primaryContactPhone",
      header: "Phone",
      cell: ({ row }) => {
        // Prefer the primary contact's phone; fall back to vendor-level phone
        const phone = row.original.primaryContactPhone ?? row.original.primaryPhone;
        return (
          <span className="text-sm text-muted-foreground">
            {phone ?? "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "primaryContactEmail",
      header: "Email",
      cell: ({ row }) => {
        // Prefer the primary contact's email; fall back to vendor-level email
        const email = row.original.primaryContactEmail ?? row.original.primaryEmail;
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[180px] block">
            {email ?? "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={row.original.status ?? "Active"} size="sm" />
          {row.original.isMsme && (
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">MSME</Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "poCount",
      header: "POs",
      cell: ({ row }) => {
        const cnt: number = row.original.poCount ?? 0;
        if (cnt === 0) {
          return (
            <span className="text-xs text-muted-foreground italic">No orders</span>
          );
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/procurement/vendors/${row.original.id}?tab=pos`);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {cnt} {cnt === 1 ? "PO" : "POs"}
          </button>
        );
      },
    },
  ];

  const anyError = submitAttempted && hasErrors(errors);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Vendors"
        subtitle="Approved supplier and contractor registry"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetDialog(); }}>
            {perms.canCreate && (
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Add Vendor</Button>
              </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New Vendor</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">

                {/* Vendor Name */}
                <div>
                  <Label>
                    Vendor Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.name}
                    onChange={e => setField("name", e.target.value)}
                    onBlur={() => touch("name")}
                    placeholder="e.g. Waaree Energies Ltd"
                    className={cn("mt-1", showError("name") && "border-red-400 focus-visible:ring-red-300")}
                  />
                  <FieldError msg={showError("name")} />
                </div>

                {/* Trade Name + Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Trade Name</Label>
                    <Input
                      value={form.tradeName ?? ""}
                      onChange={e => setField("tradeName", e.target.value)}
                      placeholder="e.g. SK Traders"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setField("status", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* GSTIN + PAN */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>GSTIN</Label>
                    <Input
                      value={form.gstin ?? ""}
                      onChange={e => setField("gstin", e.target.value, true)}
                      onBlur={() => touch("gstin")}
                      placeholder="27AABCU9603R1ZX"
                      maxLength={15}
                      className={cn("mt-1 font-mono tracking-wide", showError("gstin") && "border-red-400 focus-visible:ring-red-300")}
                    />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {(form.gstin ?? "").length}/15 chars
                    </p>
                    <FieldError msg={showError("gstin")} />
                  </div>
                  <div>
                    <Label>PAN</Label>
                    <Input
                      value={form.pan ?? ""}
                      onChange={e => setField("pan", e.target.value, true)}
                      onBlur={() => touch("pan")}
                      placeholder="AABCU9603R"
                      maxLength={10}
                      className={cn("mt-1 font-mono tracking-wide", showError("pan") && "border-red-400 focus-visible:ring-red-300")}
                    />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {(form.pan ?? "").length}/10 chars
                    </p>
                    <FieldError msg={showError("pan")} />
                  </div>
                </div>

                {/* Primary Email */}
                <div>
                  <Label>Primary Email</Label>
                  <Input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    value={form.primaryEmail ?? ""}
                    onChange={e => setField("primaryEmail", e.target.value)}
                    onBlur={() => touch("primaryEmail")}
                    placeholder="vendor@example.com"
                    className={cn("mt-1", showError("primaryEmail") && "border-red-400 focus-visible:ring-red-300")}
                  />
                  <FieldError msg={showError("primaryEmail")} />
                </div>

                {/* Primary Phone */}
                <div>
                  <Label>Primary Phone</Label>
                  <Input
                    value={form.primaryPhone ?? ""}
                    onChange={e => {
                      // Only allow digits, max 10
                      const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setField("primaryPhone", v);
                    }}
                    onBlur={() => touch("primaryPhone")}
                    placeholder="9876543210"
                    maxLength={10}
                    inputMode="numeric"
                    className={cn("mt-1", showError("primaryPhone") && "border-red-400 focus-visible:ring-red-300")}
                  />
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {(form.primaryPhone ?? "").length}/10 digits · Indian mobile
                  </p>
                  <FieldError msg={showError("primaryPhone")} />
                </div>

                {/* Error summary + actions */}
                {anyError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/30 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">Please fix the following before creating:</p>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 pl-6 list-disc">
                      {Object.values(errors).map((msg, i) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400">{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setOpen(false); resetDialog(); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createMut.isPending}
                  >
                    {createMut.isPending ? "Creating…" : "Create & Open"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

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

      {!isError && <DataTable
        data={vendors as any[]}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search by name, GSTIN, email…"
        onRowClick={(row) => setLocation(`/procurement/vendors/${row.id}`)}
        exportFilename="vendors"
        filterOptions={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        emptyIcon={Building2}
        emptyTitle="No vendors found"
        emptyDescription="Add vendors to start raising purchase orders"
      />}
    </motion.div>
  );
}
