import { useState } from "react";
import { useGetLeads, useCreateLead, useGetLeadsPipelineSummary, getGetLeadsQueryKey, getGetLeadsPipelineSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Filter, Building2, UserCircle, Target } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { motion } from "framer-motion";

const createLeadSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  source: z.string().min(1, "Source is required"),
  territory: z.string().optional(),
  estimatedValue: z.coerce.number().optional(),
  productInterest: z.string().optional(),
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
    defaultValues: { source: "Inbound" }
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
          <DialogContent className="max-w-md p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-bold tracking-tight">Create New Lead</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate({ data: { ...d, status: "New" } }))} className="space-y-5">
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Company Name</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="contactName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Contact Name</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="source" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Source</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-10 bg-gray-50"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Inbound">Inbound</SelectItem>
                          <SelectItem value="Outbound">Outbound</SelectItem>
                          <SelectItem value="Referral">Referral</SelectItem>
                          <SelectItem value="Event">Event</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="contactEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Email</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50" type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contactPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Phone</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="estimatedValue" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Est. Value ($)</FormLabel>
                    <FormControl><Input className="h-10 bg-gray-50 font-mono" type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full h-11 bg-[#0A0F2C] hover:bg-[#0A0F2C]/90 text-white font-bold rounded-[8px] mt-2" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Lead"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline Summary Blocks */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
        <div className="bg-gradient-to-br from-[#0A0F2C] to-[#1E293B] rounded-[12px] p-5 text-white min-w-[200px] shrink-0 premium-shadow">
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">Total Pipeline</p>
          <p className="text-3xl font-bold tracking-tight">${summary?.totalValue?.toLocaleString() || 0}</p>
        </div>
        {summary?.stages?.map(stage => (
          <div key={stage.stage} className="bg-white rounded-[12px] p-5 min-w-[180px] shrink-0 premium-shadow border border-gray-100 flex flex-col justify-between">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">{stage.stage}</p>
            <div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{stage.count}</p>
              <p className="text-sm font-medium text-gray-500 mt-0.5">${stage.value.toLocaleString()}</p>
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
                          {lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : '-'}
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
