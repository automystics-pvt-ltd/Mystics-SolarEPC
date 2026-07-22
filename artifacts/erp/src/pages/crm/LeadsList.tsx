import { useState } from "react";
import { useGetLeads, useCreateLead, useGetLeadsPipelineSummary, getGetLeadsQueryKey, getGetLeadsPipelineSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Filter, Building2, UserCircle, Target, ChevronsUpDown, Check } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
            "h-10 w-full justify-between bg-gray-50 border-gray-200 font-normal text-sm rounded-[6px] hover:bg-gray-100",
            !selected && "text-gray-400",
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
            <CommandEmpty className="py-4 text-center text-sm text-gray-400">No match found.</CommandEmpty>
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

function getStatusColor(status: string) {
  switch (status) {
    case 'Closed Won': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Closed Lost': return 'bg-red-100 text-red-800 border-red-200';
    case 'New': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Proposal':
    case 'Negotiation': return 'bg-amber-100 text-amber-800 border-amber-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function LeadsList() {
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useGetLeads(
    { stage: stageFilter !== "all" ? stageFilter : undefined },
    { query: { queryKey: getGetLeadsQueryKey({ stage: stageFilter !== "all" ? stageFilter : undefined }) } }
  );

  const { data: summary } = useGetLeadsPipelineSummary();

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

  const filteredLeads = leads?.filter(l => 
    (l.companyName?.toLowerCase().includes(search.toLowerCase()) || 
     l.contactName?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Pipeline</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Manage and track incoming sales opportunities.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold tracking-wide rounded-[8px] h-10 px-5 shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> New Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <DialogTitle className="text-xl font-bold tracking-tight">New Lead</DialogTitle>
              <p className="text-sm text-gray-500 mt-0.5">Fill in all details to qualify this lead properly.</p>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[75vh] px-6 py-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate({ data: d }))} className="space-y-5">

                {/* Company & Contact */}
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Company &amp; Contact</p>
                  <div className="space-y-4">
                    <FormField control={form.control} name="companyName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Company Name *</FormLabel>
                        <FormControl><Input className="h-10 bg-gray-50" placeholder="e.g. Sunrise Infra Pvt Ltd" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="contactName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Contact Person *</FormLabel>
                          <FormControl><Input className="h-10 bg-gray-50" placeholder="Full name" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="contactPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Phone</FormLabel>
                          <FormControl><Input className="h-10 bg-gray-50" placeholder="+91 98765 43210" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="contactEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Email</FormLabel>
                        <FormControl><Input className="h-10 bg-gray-50" type="email" placeholder="contact@company.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Lead Qualification */}
                <div className="border-t border-gray-100 pt-5">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Qualification</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Stage</FormLabel>
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
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Lead Source *</FormLabel>
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
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Est. Value (₹)</FormLabel>
                        <FormControl><Input className="h-10 bg-gray-50 font-mono" type="number" min="0" placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="territory" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Territory / Region</FormLabel>
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
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Product / Capacity Interest</FormLabel>
                        <FormControl><Input className="h-10 bg-gray-50" placeholder="e.g. 50 kWp Rooftop Solar" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Notes */}
                <div className="border-t border-gray-100 pt-5">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Notes</p>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Initial Notes</FormLabel>
                      <FormControl>
                        <textarea
                          {...field}
                          rows={3}
                          placeholder="Meeting context, referral background, next steps..."
                          className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#EA580C] focus:border-[#EA580C] resize-none"
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
      </div>

      {/* Pipeline Summary Blocks */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
        <div className="bg-gradient-to-br from-[#0A0F2C] to-[#1E293B] rounded-[12px] p-5 text-white min-w-[200px] shrink-0 premium-shadow">
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">Total Pipeline</p>
          <p className="text-3xl font-bold tracking-tight">₹{Number(summary?.totalValue || 0).toLocaleString("en-IN")}</p>
        </div>
        {summary?.stages?.map(stage => (
          <div key={stage.stage} className="bg-white rounded-[12px] p-5 min-w-[180px] shrink-0 premium-shadow border border-gray-100 flex flex-col justify-between">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">{stage.stage}</p>
            <div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{stage.count}</p>
              <p className="text-sm font-medium text-gray-500 mt-0.5">₹{Number(stage.value).toLocaleString("en-IN")}</p>
            </div>
          </div>
        ))}
      </div>

      {/* List Area */}
      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search companies or contacts..." 
              className="pl-9 h-10 bg-white border-gray-200 text-sm focus-visible:ring-[#EA580C] shadow-sm rounded-[8px]"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 bg-white border-gray-200 shadow-sm rounded-[8px] font-medium text-sm">
              <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-gray-400" /> <SelectValue placeholder="All Stages" /></div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Contacted">Contacted</SelectItem>
              <SelectItem value="Qualified">Qualified</SelectItem>
              <SelectItem value="Proposal">Proposal</SelectItem>
              <SelectItem value="Negotiation">Negotiation</SelectItem>
              <SelectItem value="Closed Won">Closed Won</SelectItem>
              <SelectItem value="Closed Lost">Closed Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5">Lead</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Stage</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white text-right">Value</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white text-center">Score</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Owner</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white text-right px-5">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads?.map((lead) => (
                  <TableRow key={lead.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                    <TableCell className="px-5 py-4">
                      <Link href={`/crm/leads/${lead.id}`} className="block">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm group-hover:text-[#EA580C] transition-colors">{lead.companyName || 'N/A'}</div>
                            <div className="text-xs font-medium text-gray-500 mt-0.5 flex items-center gap-1"><UserCircle className="h-3.5 w-3.5" />{lead.contactName}</div>
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="py-4">
                      <Link href={`/crm/leads/${lead.id}`} className="block">
                        <Badge variant="outline" className={`font-bold text-[11px] uppercase tracking-wide border px-2 py-0.5 rounded-[4px] ${getStatusColor(lead.status)}`}>
                          {lead.status}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <Link href={`/crm/leads/${lead.id}`} className="block">
                        <span className="font-mono font-bold text-sm text-gray-900">
                          {lead.estimatedValue ? `₹${Number(lead.estimatedValue).toLocaleString("en-IN")}` : '-'}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="py-4">
                      <Link href={`/crm/leads/${lead.id}`} className="flex justify-center">
                        <div className="flex items-center gap-2 w-full max-w-[100px]">
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${lead.score && lead.score > 70 ? 'bg-emerald-500' : lead.score && lead.score > 40 ? 'bg-amber-500' : 'bg-gray-400'}`} 
                              style={{ width: `${Math.min(100, lead.score || 0)}%` }} 
                            />
                          </div>
                          <span className="text-[11px] font-bold font-mono text-gray-600 w-6 text-right">{lead.score || 0}</span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="py-4">
                      <Link href={`/crm/leads/${lead.id}`} className="block">
                        <span className="text-sm font-medium text-gray-600">{lead.ownerName || 'Unassigned'}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-right">
                      <Link href={`/crm/leads/${lead.id}`} className="block text-xs font-medium text-gray-400">
                        {format(new Date(lead.createdAt), 'MMM d, yyyy')}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredLeads?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Target className="h-8 w-8 mb-2 opacity-20" />
                        <span className="text-sm font-medium">No leads found.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
