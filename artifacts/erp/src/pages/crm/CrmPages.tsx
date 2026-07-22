import { useGetClientPOs, useGetCrmInvoices, useGetTasks, useGetEscalations } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Loader2, FileCheck, DollarSign, CheckSquare, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { motion } from "framer-motion";

export function ClientPOsList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useGetClientPOs();

  const filtered = data?.filter(item =>
    (item.clientPoNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Client POs</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">Purchase orders received from clients.</p>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search PO Number..."
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
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5">PO Number</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white text-right">Value</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-6">Status</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Linked Project</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white text-right px-5">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((item) => (
                  <TableRow key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <FileCheck className="h-4 w-4" />
                        </div>
                        <span className="font-mono font-bold text-sm text-gray-900">{item.clientPoNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <span className="font-mono font-bold text-gray-900 text-[15px]">${Number(item.contractValue ?? 0).toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${item.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      {item.projectId ? (
                        <Link href={`/projects/${item.projectId}`} className="inline-flex items-center text-sm font-bold text-gray-600 hover:text-[#EA580C] bg-gray-100 hover:bg-orange-50 px-2.5 py-1 rounded-[6px] transition-colors">
                          PRJ-{item.projectId.toString().padStart(4, '0')}
                        </Link>
                      ) : (
                        <span className="text-gray-300 font-bold">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-right">
                      <span className="text-xs font-medium text-gray-400">
                        {format(new Date(item.createdAt), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <FileCheck className="h-8 w-8 mb-2 opacity-20" />
                        <span className="text-sm font-medium">No POs found.</span>
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

export function CrmInvoicesList() {
  const { data, isLoading } = useGetCrmInvoices();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Accounts Receivable</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">Client invoices and payment tracking.</p>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5">Invoice ID</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Type</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white text-right">Amount</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-6">Due Date</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((inv) => (
                  <TableRow key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <DollarSign className="h-4 w-4" />
                        </div>
                        <span className="font-mono font-bold text-sm text-gray-900">INV-{inv.id.toString().padStart(4, '0')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-bold text-gray-600">{inv.type}</span>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <span className="font-mono font-bold text-gray-900 text-[15px]">${inv.amount.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <span className="text-sm font-medium text-gray-600">{inv.dueDate ? format(new Date(inv.dueDate), 'MMM d, yyyy') : '-'}</span>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                        inv.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        inv.paymentStatus === 'Overdue' ? 'bg-red-50 text-red-700 border-red-200' : 
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {inv.paymentStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function TasksList() {
  const { data, isLoading } = useGetTasks();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tasks</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">To-dos and action items.</p>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5 w-[40%]">Task</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Priority</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Status</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white">Due</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white px-5">Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((task) => (
                  <TableRow key={task.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <CheckSquare className="h-4 w-4 text-gray-400 mt-0.5" />
                        <span className="font-bold text-sm text-gray-900 leading-tight">{task.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                        task.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' : 
                        task.priority === 'Medium' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {task.priority || 'Normal'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-bold text-gray-600">{task.status}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-medium text-gray-600">{task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : '-'}</span>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <span className="text-sm font-bold text-gray-900">{task.ownerName}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function EscalationsList() {
  const { data, isLoading } = useGetEscalations();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-red-600 tracking-tight flex items-center gap-3">
          <AlertTriangle className="h-7 w-7" /> Escalations
        </h1>
        <p className="text-sm font-medium text-gray-500 mt-1">Issues requiring immediate attention.</p>
      </div>

      <div className="bg-white rounded-[12px] premium-shadow border border-red-100 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-red-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-red-100 bg-red-50/30 hover:bg-red-50/30">
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-red-800 px-5 w-[30%]">Reason</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-red-800">Module</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-red-800">Severity</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-red-800">Status</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-red-800">Raised By</TableHead>
                  <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-red-800 px-5">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((esc) => (
                  <TableRow key={esc.id} className="border-b border-red-50 hover:bg-red-50/50 transition-colors">
                    <TableCell className="px-5 py-4">
                      <span className="font-bold text-sm text-gray-900 leading-tight block">{esc.reason}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-[6px]">{esc.module}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                        esc.severity === 'Critical' ? 'bg-red-600 text-white border-red-700' : 'bg-orange-100 text-orange-800 border-orange-200'
                      }`}>
                        {esc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-bold text-gray-600">{esc.status}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-bold text-gray-900">{esc.raisedByName}</span>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <span className="text-xs font-medium text-gray-500">{format(new Date(esc.createdAt), 'MMM d')}</span>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <CheckSquare className="h-8 w-8 mb-2 opacity-20" />
                        <span className="text-sm font-medium">No active escalations.</span>
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
