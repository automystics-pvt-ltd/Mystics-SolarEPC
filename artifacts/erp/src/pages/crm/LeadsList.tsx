import { useState } from "react";
import { useGetLeads, useCreateLead, useGetLeadsPipelineSummary, getGetLeadsQueryKey, getGetLeadsPipelineSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Building2, UserCircle, Target, ChevronsUpDown, Check } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PageHeader, DataTable, SkeletonStats, StatusBadge } from "@/components/shared";
import type { ColumnDef } from "@tanstack/react-table";

/* ── Searchable combobox ── */
function SearchableCombobox({
  value, onChange, options, placeholder = "Select…", className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-10 w-full justify-between bg-muted/50 border-border font-normal text-sm rounded-[6px] hover:bg-muted",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" className="h-9 text-sm" />
          <CommandList className="max-h-52">
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">No match found.</CommandEmpty>
            <CommandGroup>
              {options.map(o => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                  className="text-sm cursor-pointer"
                >
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Static option lists ── */
const STAGE_OPTIONS = [
  { value: "New", label: "New" },
  { value: "Contacted", label: "Contacted" },
  { value: "Qualified", label: "Qualified" },
  { value: "Proposal", label: "Proposal" },
  { value: "Negotiation", label: "Negotiation" },
];

const SOURCE_OPTIONS = [
  { value: "Inbound", label: "Inbound" },
  { value: "Outbound", label: "Outbound" },
  { value: "Referral", label: "Referral" },
  { value: "Event", label: "Event" },
  { value: "Digital", label: "Digital / Social" },
  { value: "Tender", label: "Tender / Bid" },
];

const TERRITORY_OPTIONS = [
  { value: "Andhra Pradesh", label: "Andhra Pradesh" },
  { value: "Arunachal Pradesh", label: "Arunachal Pradesh" },
  { value: "Assam", label: "Assam" },
  { value: "Bihar", label: "Bihar" },
  { value: "Chhattisgarh", label: "Chhattisgarh" },
  { value: "Goa", label: "Goa" },
  { value: "Gujarat", label: "Gujarat" },
  { value: "Haryana", label: "Haryana" },
  { value: "Himachal Pradesh", label: "Himachal Pradesh" },
  { value: "Jharkhand", label: "Jharkhand" },
  { value: "Karnataka", label: "Karnataka" },
  { value: "Kerala", label: "Kerala" },
  { value: "Madhya Pradesh", label: "Madhya Pradesh" },
  { value: "Maharashtra", label: "Maharashtra" },
  { value: "Manipur", label: "Manipur" },
  { value: "Meghalaya", label: "Meghalaya" },
  { value: "Mizoram", label: "Mizoram" },
  { value: "Nagaland", label: "Nagaland" },
  { value: "Odisha", label: "Odisha" },
  { value: "Punjab", label: "Punjab" },
  { value: "Rajasthan", label: "Rajasthan" },
  { value: "Sikkim", label: "Sikkim" },
  { value: "Tamil Nadu", label: "Tamil Nadu" },
  { value: "Telangana", label: "Telangana" },
  { value: "Tripura", label: "Tripura" },
  { value: "Uttar Pradesh", label: "Uttar Pradesh" },
  { value: "Uttarakhand", label: "Uttarakhand" },
  { value: "West Bengal", label: "West Bengal" },
  { value: "Andaman & Nicobar Islands", label: "Andaman & Nicobar Islands" },
  { value: "Chandigarh", label: "Chandigarh" },
  { value: "Dadra & Nagar Haveli and Daman & Diu", label: "Dadra & Nagar Haveli and Daman & Diu" },
  { value: "Delhi", label: "Delhi (NCT)" },
  { value: "Jammu & Kashmir", label: "Jammu & Kashmir" },
  { value: "Ladakh", label: "Ladakh" },
  { value: "Lakshadweep", label: "Lakshadweep" },
  { value: "Puducherry", label: "Puducherry" },
];

const createLeadSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  source: z.string().min(1, "Source is required"),
  status: z.string().min(1),
  territory: z.string().optional(),
  estimatedValue: z.coerce.number().optional(),
  productInterest: z.string().optional(),
  notes: z.string().optional(),
});

const STATUS_FILTER_OPTIONS = [
  { label: 'New', value: 'New' },
  { label: 'Contacted', value: 'Contacted' },
  { label: 'Qualified', value: 'Qualified' },
  { label: 'Proposal', value: 'Proposal' },
  { label: 'Negotiation', value: 'Negotiation' },
  { label: 'Closed Won', value: 'Closed Won' },
  { label: 'Closed Lost', value: 'Closed Lost' },
];

export function LeadsList() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useGetLeads(
    {},
    { query: { queryKey: getGetLeadsQueryKey({}) } }
  );

  const { data: summary, isLoading: summaryLoading } = useGetLeadsPipelineSummary();

  const form = useForm<z.infer<typeof createLeadSchema>>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: { source: "Inbound", status: "New" }
  });

  const createMutation = useCreateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadsPipelineSummaryQueryKey() });
        setIsCreateOpen(false);
        form.reset();
      }
    }
  });

  type Lead = NonNullable<typeof leads>[number];

  const columns: ColumnDef<Lead, any>[] = [
    {
      accessorKey: 'companyName',
      header: 'Lead / Company',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm">{row.original.companyName || 'N/A'}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <UserCircle className="h-3.5 w-3.5" />{row.original.contactName}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Stage',
      cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
    },
    {
      accessorKey: 'estimatedValue',
      header: 'Est. Value (₹)',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm text-foreground tabular-nums">
          {row.original.estimatedValue ? `₹${Number(row.original.estimatedValue).toLocaleString("en-IN")}` : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'score',
      header: 'Score',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 w-full max-w-[100px]">
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full", row.original.score && row.original.score > 70 ? 'bg-emerald-500' : row.original.score && row.original.score > 40 ? 'bg-amber-500' : 'bg-muted-foreground/30')}
              style={{ width: `${Math.min(100, row.original.score || 0)}%` }}
            />
          </div>
          <span className="text-[11px] font-bold font-mono text-muted-foreground w-6 text-right">{row.original.score || 0}</span>
        </div>
      ),
    },
    {
      accessorKey: 'ownerName',
      header: 'Owner',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.ownerName || 'Unassigned'}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
  ];

  const createButton = (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold tracking-wide rounded-[8px] h-9 px-4 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> New Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-border bg-muted/30">
          <DialogTitle className="text-xl font-bold tracking-tight">New Lead</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in all details to qualify this lead properly.</p>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[75vh] px-6 py-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate({ data: d }))} className="space-y-5">

              {/* Company & Contact */}
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Company &amp; Contact</p>
                <div className="space-y-4">
                  <FormField control={form.control} name="companyName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">Company Name *</FormLabel>
                      <FormControl><Input className="h-10 bg-muted/50" placeholder="e.g. Sunrise Infra Pvt Ltd" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="contactName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">Contact Person *</FormLabel>
                        <FormControl><Input className="h-10 bg-muted/50" placeholder="Full name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contactPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">Phone</FormLabel>
                        <FormControl><Input className="h-10 bg-muted/50" placeholder="+91 98765 43210" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="contactEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">Email</FormLabel>
                      <FormControl><Input className="h-10 bg-muted/50" type="email" placeholder="contact@company.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Lead Qualification */}
              <div className="border-t border-border pt-5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Qualification</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">Stage</FormLabel>
                      <FormControl>
                        <SearchableCombobox
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          options={STAGE_OPTIONS}
                          placeholder="Select stage…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="source" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">Lead Source *</FormLabel>
                      <FormControl>
                        <SearchableCombobox
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          options={SOURCE_OPTIONS}
                          placeholder="Select source…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="estimatedValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">Est. Value (₹)</FormLabel>
                      <FormControl><Input className="h-10 bg-muted/50 font-mono" type="number" min="0" placeholder="0" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="territory" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">Territory / Region</FormLabel>
                      <FormControl>
                        <SearchableCombobox
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          options={TERRITORY_OPTIONS}
                          placeholder="Select state / UT…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="mt-4">
                  <FormField control={form.control} name="productInterest" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">Product / Capacity Interest</FormLabel>
                      <FormControl><Input className="h-10 bg-muted/50" placeholder="e.g. 50 kWp Rooftop Solar" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Notes */}
              <div className="border-t border-border pt-5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Notes</p>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">Initial Notes</FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        rows={3}
                        placeholder="Meeting context, referral background, next steps..."
                        className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#EA580C] focus:border-[#EA580C] resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="pt-2 pb-1">
                <Button type="submit" className="w-full h-11 bg-[#0A0F2C] hover:bg-[#0A0F2C]/90 text-white font-bold rounded-[8px]" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : "Create Lead"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="Leads"
        subtitle="Track prospects through the solar EPC sales pipeline"
        actions={createButton}
      />

      {/* Pipeline Summary Blocks */}
      {summaryLoading ? (
        <SkeletonStats count={5} />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
          <div className="bg-gradient-to-br from-[#0A0F2C] to-[#1E293B] rounded-[12px] p-5 text-white min-w-[200px] shrink-0">
            <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">Total Pipeline</p>
            <p className="text-3xl font-bold tracking-tight">₹{Number(summary?.totalValue || 0).toLocaleString("en-IN")}</p>
          </div>
          {summary?.stages?.map(stage => (
            <div key={stage.stage} className="bg-card rounded-[12px] p-5 min-w-[180px] shrink-0 border border-border flex flex-col justify-between">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{stage.stage}</p>
              <div>
                <p className="text-2xl font-bold text-foreground tracking-tight">{stage.count}</p>
                <p className="text-sm font-medium text-muted-foreground mt-0.5">₹{Number(stage.value).toLocaleString("en-IN")}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <DataTable
        data={leads ?? []}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search companies or contacts..."
        onRowClick={(row) => setLocation(`/crm/leads/${row.id}`)}
        exportFilename="leads-pipeline"
        filterOptions={[
          { key: 'status', label: 'Stage', options: STATUS_FILTER_OPTIONS },
        ]}
        emptyIcon={Target}
        emptyTitle="No leads found"
        emptyDescription="Add your first lead to start tracking the pipeline"
      />
    </motion.div>
  );
}
