import { useState, useEffect } from "react";
import {
  useGetVendor, getGetVendorQueryKey, useUpdateVendor,
  useAddVendorContact, useDeleteVendorContact, useDeleteVendor,
  getGetVendorsQueryKey,
} from "@workspace/api-client-react";
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
import { Edit3, Save, X, Plus, Trash2, Building2, Shield, Phone, Mail, CreditCard, Users, Banknote, Star, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader, SectionCard, StatusBadge } from "@/components/shared";
import { addRecentEntry } from "@/lib/recentHistory";
import { useAuth } from "@/lib/auth";
import { validateVendorFull, validateContact, hasErrors, type VendorErrors } from "@/lib/vendor-validation";
import { cn } from "@/lib/utils";

/* ── Inline field error ───────────────────────────────────────────────────── */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {msg}
    </p>
  );
}

const STATUS_OPTS = [
  { label: "Active",      value: "Active"      },
  { label: "Inactive",    value: "Inactive"    },
  { label: "Blacklisted", value: "Blacklisted" },
];

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

  const { data: vendor, isLoading } = useGetVendor(vendorId, {
    query: { enabled: !!vendorId, queryKey: getGetVendorQueryKey(vendorId) }
  });

  useEffect(() => {
    if (vendor?.name && authUser?.id)
      addRecentEntry(authUser.id, `/procurement/vendors/${vendorId}`, vendor.name, "Vendors");
  }, [vendor?.name, vendorId, authUser?.id]);

  const updateMut      = useUpdateVendor();
  const addContactMut  = useAddVendorContact();
  const delContactMut  = useDeleteVendorContact();
  const deleteMut      = useDeleteVendor();

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

  /* ── Field renderer ── */
  const F = ({
    label, field, type = "text", placeholder = "",
    uppercase = false, hint = "", mono = false,
  }: {
    label: string; field: string; type?: string; placeholder?: string;
    uppercase?: boolean; hint?: string; mono?: boolean;
  }) => (
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

  /* ── Phone field renderer (digits-only in edit) ── */
  const FPhone = ({ label, field }: { label: string; field: string }) => (
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

  /* ── Status select renderer ── */
  const FStatus = () => (
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

  const editErrorCount = Object.keys(editErrors).length;
  const editActions = editing ? (
    <>
      {editSubmitted && editErrorCount > 0 && (
        <span className="flex items-center gap-1 text-xs text-red-500 mr-1">
          <AlertCircle className="h-3.5 w-3.5" />
          {editErrorCount} error{editErrorCount !== 1 ? "s" : ""}
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 rounded-xl border border-border bg-card shadow-sm">
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
        <span className="text-muted-foreground/40">·</span>
        <StatusBadge status={vendor.status ?? "Active"} />
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details"><Shield className="w-3.5 h-3.5 mr-1.5" /> GST &amp; Details</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="w-3.5 h-3.5 mr-1.5" /> Contacts ({(vendor as any).contacts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="bank"><Banknote className="w-3.5 h-3.5 mr-1.5" /> Bank Details</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="w-3.5 h-3.5 mr-1.5" /> Billing Address</TabsTrigger>
        </TabsList>

        {/* ── GST & Details ── */}
        <TabsContent value="details" className="mt-4 space-y-4">
          <SectionCard title="GST Information">
            <div className="grid grid-cols-2 gap-4">
              <F
                label="GSTIN"
                field="gstin"
                placeholder="27AABCU9603R1ZX"
                uppercase
                mono
                hint={`${(form.gstin ?? "").length}/15 chars`}
              />
              <F
                label="PAN"
                field="pan"
                placeholder="AABCU9603R"
                uppercase
                mono
                hint={`${(form.pan ?? "").length}/10 chars`}
              />
              <F label="GST Registered State" field="gstRegisteredState" />
              <F label="State Code" field="gstStateCode" placeholder="e.g. 27" />
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
                <F label="MSME Number" field="msmeNumber" />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Contact &amp; Terms">
            <div className="grid grid-cols-2 gap-4">
              <FStatus />
              <F label="Website" field="website" placeholder="https://vendor.com" />
              <F label="Primary Email" field="primaryEmail" type="email" />
              <FPhone label="Primary Phone" field="primaryPhone" />
              <F label="Payment Terms" field="paymentTerms" placeholder="e.g. Net 30" />
              <F label="Credit Limit" field="creditLimit" placeholder="e.g. ₹5,00,000" />
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

                    {/* Primary checkbox */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is-primary"
                        checked={contactForm.isPrimary}
                        onChange={e => setContactField("isPrimary", e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="is-primary" className="text-sm">Mark as primary contact</label>
                    </div>

                    {contactSubmitted && hasErrors(contactErrors) && (
                      <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Please fix {Object.keys(contactErrors).length} error{Object.keys(contactErrors).length !== 1 ? "s" : ""} before submitting
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
                  <div key={c.id} className="bg-muted/20 border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-bold text-muted-foreground">
                      {c.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{c.name}</span>
                        {c.isPrimary && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60">
                            <Star className="w-2.5 h-2.5 mr-0.5" /> Primary
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                        {c.designation && <span>{c.designation}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
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
              <F label="Bank Name" field="bankName" placeholder="e.g. State Bank of India" />
              <F label="Branch" field="bankBranch" placeholder="e.g. Connaught Place, Delhi" />
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
              <F
                label="IFSC Code"
                field="bankIfsc"
                placeholder="SBIN0001234"
                uppercase mono
                hint={`${(form.bankIfsc ?? "").length}/11 chars`}
              />
              <F label="Account Type" field="bankAccountType" placeholder="Current / Savings" />
              <F label="UPI ID" field="upiId" placeholder="vendor@upi" />
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── Billing ── */}
        <TabsContent value="billing" className="mt-4">
          <SectionCard title="Billing Address">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><F label="Address" field="billingAddress" /></div>
              <F label="City" field="billingCity" />
              <F label="State" field="billingState" />
              <div>
                <Label className="text-xs text-muted-foreground">Pincode</Label>
                {editing ? (
                  <>
                    <Input
                      inputMode="numeric"
                      value={form.billingPincode ?? ""}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setEditField("billingPincode", v);
                      }}
                      onBlur={() => touchEdit("billingPincode")}
                      placeholder="110001"
                      maxLength={6}
                      className={cn("mt-1 h-9", showEditError("billingPincode") && "border-red-400 focus-visible:ring-red-300")}
                    />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{(form.billingPincode ?? "").length}/6 digits</p>
                    <FieldError msg={showEditError("billingPincode")} />
                  </>
                ) : (
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {(vendor as any).billingPincode || <span className="text-muted-foreground/40 font-normal">—</span>}
                  </p>
                )}
              </div>
              <F label="Country" field="billingCountry" />
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
