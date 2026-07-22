import { useState } from "react";
import { useGetVendor, getGetVendorQueryKey, useUpdateVendor, useAddVendorContact, useDeleteVendorContact } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Edit3, Save, X, Plus, Trash2, Building2, Shield, Phone, Mail, CreditCard, Users, Banknote, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Inactive: "bg-slate-100 text-slate-600 border-slate-200",
  Blacklisted: "bg-red-50 text-red-700 border-red-200",
};

export default function VendorDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const vendorId = Number(id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState<any>({ name: "", isPrimary: false });

  const { data: vendor, isLoading } = useGetVendor(vendorId, {
    query: { enabled: !!vendorId, queryKey: getGetVendorQueryKey(vendorId) }
  });
  const updateMut = useUpdateVendor();
  const addContactMut = useAddVendorContact();
  const delContactMut = useDeleteVendorContact();

  if (isLoading || !vendor) return <div className="flex h-60 items-center justify-center"><div className="animate-pulse text-slate-400">Loading vendor…</div></div>;

  const startEdit = () => { setForm({ ...vendor }); setEditing(true); };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => {
    updateMut.mutate({ id: vendorId, data: form }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) }); setEditing(false); toast({ title: "Vendor updated" }); }
    });
  };

  const addContact = () => {
    addContactMut.mutate({ id: vendorId, data: contactForm }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) }); setContactOpen(false); setContactForm({ name: "", isPrimary: false }); }
    });
  };

  const delContact = (cid: number) => {
    delContactMut.mutate({ id: vendorId, cid }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) })
    });
  };

  const F = ({ label, field, type = "text", placeholder = "" }: { label: string; field: string; type?: string; placeholder?: string }) => (
    <div>
      <Label className="text-xs text-slate-500">{label}</Label>
      {editing ? (
        <Input type={type} value={form[field] ?? ""} onChange={e => setForm({ ...form, [field]: e.target.value })} placeholder={placeholder} className="mt-1 h-9" />
      ) : (
        <p className="mt-1 text-sm font-medium text-slate-800">{(vendor as any)[field] || <span className="text-slate-300 font-normal">—</span>}</p>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/procurement/vendors")} className="h-9 w-9 shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{vendor.name}</h1>
              <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[vendor.status ?? "Active"])}>{vendor.status}</Badge>
              {vendor.isMsme && <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">MSME</Badge>}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{vendor.code} {vendor.tradeName ? `· ${vendor.tradeName}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEdit}><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
              <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending}><Save className="w-3.5 h-3.5 mr-1" />{updateMut.isPending ? "Saving…" : "Save"}</Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={startEdit}><Edit3 className="w-3.5 h-3.5 mr-1" /> Edit</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details"><Shield className="w-3.5 h-3.5 mr-1.5" /> GST & Details</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="w-3.5 h-3.5 mr-1.5" /> Contacts ({vendor.contacts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="bank"><Banknote className="w-3.5 h-3.5 mr-1.5" /> Bank Details</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="w-3.5 h-3.5 mr-1.5" /> Billing Address</TabsTrigger>
        </TabsList>

        {/* GST & Details */}
        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">GST Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <F label="GSTIN" field="gstin" placeholder="27AABCU9603R1ZX" />
                <F label="PAN" field="pan" placeholder="AABCU9603R" />
                <F label="GST Registered State" field="gstRegisteredState" />
                <F label="State Code" field="gstStateCode" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="msme" checked={editing ? (form.isMsme ?? false) : (vendor.isMsme ?? false)} onChange={e => editing && setForm({ ...form, isMsme: e.target.checked })} disabled={!editing} className="w-4 h-4" />
                <label htmlFor="msme" className="text-sm">MSME Registered</label>
                {(editing ? form.isMsme : vendor.isMsme) && <F label="MSME Number" field="msmeNumber" />}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Contact & Terms</h3>
              <div className="grid grid-cols-2 gap-4">
                <F label="Primary Email" field="primaryEmail" type="email" />
                <F label="Primary Phone" field="primaryPhone" />
                <F label="Website" field="website" />
                <F label="Payment Terms" field="paymentTerms" placeholder="e.g. Net 30" />
                <F label="Credit Limit" field="creditLimit" placeholder="e.g. ₹5,00,000" />
              </div>
              {editing ? (
                <div><Label className="text-xs text-slate-500">Notes</Label><Textarea value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1" rows={2} /></div>
              ) : vendor.notes ? (
                <div><Label className="text-xs text-slate-500">Notes</Label><p className="mt-1 text-sm text-slate-700">{vendor.notes}</p></div>
              ) : null}
            </div>
          </div>
        </TabsContent>

        {/* Contacts */}
        <TabsContent value="contacts" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={contactOpen} onOpenChange={setContactOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Contact</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>Name *</Label><Input value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} className="mt-1" /></div>
                  <div><Label>Designation</Label><Input value={contactForm.designation ?? ""} onChange={e => setContactForm({ ...contactForm, designation: e.target.value })} className="mt-1" /></div>
                  <div><Label>Email</Label><Input type="email" value={contactForm.email ?? ""} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} className="mt-1" /></div>
                  <div><Label>Phone</Label><Input value={contactForm.phone ?? ""} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} className="mt-1" /></div>
                  <div className="flex items-center gap-2"><input type="checkbox" checked={contactForm.isPrimary} onChange={e => setContactForm({ ...contactForm, isPrimary: e.target.checked })} /><span className="text-sm">Primary Contact</span></div>
                  <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setContactOpen(false)}>Cancel</Button><Button onClick={addContact} disabled={!contactForm.name || addContactMut.isPending}>{addContactMut.isPending ? "Adding…" : "Add"}</Button></div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {(vendor.contacts ?? []).length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">No contacts added yet</div>
          ) : (
            <div className="space-y-2">
              {(vendor.contacts ?? []).map((c: any) => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-sm font-bold text-slate-500">{c.name[0]}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{c.name}</span>
                      {c.isPrimary && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200"><Star className="w-2.5 h-2.5 mr-0.5" /> Primary</Badge>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex gap-3">
                      {c.designation && <span>{c.designation}</span>}
                      {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => delContact(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bank */}
        <TabsContent value="bank" className="mt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Bank Account Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <F label="Bank Name" field="bankName" />
              <F label="Branch" field="bankBranch" />
              <F label="Account Number" field="bankAccountNumber" />
              <F label="IFSC Code" field="bankIfsc" />
              <F label="Account Type" field="bankAccountType" placeholder="Current / Savings" />
              <F label="UPI ID" field="upiId" />
            </div>
          </div>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="mt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Billing Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><F label="Address" field="billingAddress" /></div>
              <F label="City" field="billingCity" />
              <F label="State" field="billingState" />
              <F label="Pincode" field="billingPincode" />
              <F label="Country" field="billingCountry" />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
