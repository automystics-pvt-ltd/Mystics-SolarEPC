import { useGetQuotations, useCreateQuotation, getGetQuotationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Plus, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { motion } from "framer-motion";

function getStatusBadge(status: string) {
  switch (status) {
    case 'Approved': 
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] flex items-center gap-1 w-fit"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>;
    case 'Rejected':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] flex items-center gap-1 w-fit"><XCircle className="h-3 w-3" /> Rejected</Badge>;
    default:
      return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] flex items-center gap-1 w-fit"><Clock className="h-3 w-3" /> {status}</Badge>;
  }
}

export function QuotationsList() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const { data: quotations, isLoading } = useGetQuotations({}, {
    query: { queryKey: getGetQuotationsQueryKey({}) }
  });

  const filtered = quotations?.filter(q => 
    q.id.toString().includes(search) || 
    q.approvalStatus.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Quotations</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Manage sales proposals, BOQs, and approvals.</p>
        </div>
        <Button onClick={() => setLocation("/crm/quotations/new")} className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold tracking-wide rounded-[8px] h-10 px-5 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Create Quotation
        </Button>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search by ID or Status..." 
              className="pl-9 h-10 bg-white border-gray-200 text-sm font-medium focus-visible:ring-[#EA580C] shadow-sm rounded-[8px]"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5 w-[160px]">Quote ID</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white w-[140px]">Lead Ref</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white text-right">Amount</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-6">Status</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Valid Till</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white text-right px-5">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((quote) => (
                  <TableRow key={quote.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer group" onClick={() => setLocation(`/crm/quotations/${quote.id}`)}>
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-orange-50 text-[#EA580C] flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-mono font-bold text-sm text-gray-900 group-hover:text-[#EA580C] transition-colors">QTN-{quote.id.toString().padStart(4, '0')}</span>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Version {quote.version}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Link href={`/crm/leads/${quote.leadId}`} className="inline-flex items-center text-sm font-semibold text-gray-600 hover:text-[#EA580C] bg-gray-100 hover:bg-orange-50 px-2.5 py-1 rounded-[6px] transition-colors" onClick={e => e.stopPropagation()}>
                        LD-{quote.leadId.toString().padStart(4, '0')}
                      </Link>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <span className="font-mono font-bold text-gray-900 text-[15px]">₹{Number(quote.totalAmount || 0).toLocaleString("en-IN")}</span>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      {getStatusBadge(quote.approvalStatus)}
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-medium text-gray-600">
                        {quote.validTill ? format(new Date(quote.validTill), 'MMM d, yyyy') : <span className="text-gray-300">-</span>}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-right">
                      <span className="text-xs font-medium text-gray-400">
                        {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered?.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                       <div className="flex flex-col items-center justify-center text-gray-400">
                        <FileText className="h-8 w-8 mb-2 opacity-20" />
                        <span className="text-sm font-medium">No quotations found.</span>
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
