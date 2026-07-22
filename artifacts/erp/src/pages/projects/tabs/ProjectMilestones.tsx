import { useState } from "react";
import { useGetPaymentMilestones, useCreatePaymentMilestone, useTriggerPaymentMilestone, getGetPaymentMilestonesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Zap, Flag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

const msSchema = z.object({
  milestoneName: z.string().min(1, "Required"),
  triggerCondition: z.string().optional(),
  amount: z.coerce.number().min(1, "Required"),
  dueDate: z.string().optional()
});

export function ProjectMilestones({ projectId }: { projectId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: milestones, isLoading } = useGetPaymentMilestones(projectId, {
    query: { enabled: !!projectId, queryKey: getGetPaymentMilestonesQueryKey(projectId) }
  });

  const form = useForm<z.infer<typeof msSchema>>({
    resolver: zodResolver(msSchema)
  });

  const createMut = useCreatePaymentMilestone({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPaymentMilestonesQueryKey(projectId) });
        setIsOpen(false);
        form.reset();
      }
    }
  });

  const triggerMut = useTriggerPaymentMilestone({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPaymentMilestonesQueryKey(projectId) });
      }
    }
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-[12px] border border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <Flag className="h-4 w-4 text-gray-400" />
          Payment Milestones
        </h3>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0C1445] hover:bg-[#0A0F2C] text-white font-bold rounded-[6px] h-8 shadow-none"><Plus className="h-4 w-4 mr-1.5" /> Add Milestone</Button>
          </DialogTrigger>
          <DialogContent className="p-6">
            <DialogHeader className="mb-4"><DialogTitle className="text-xl font-bold tracking-tight">New Milestone</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMut.mutate({ id: projectId, data: { ...d, projectId } as any }))} className="space-y-5">
                <FormField control={form.control} name="milestoneName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Name</FormLabel><FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Amount ($)</FormLabel><FormControl><Input type="number" className="h-10 bg-gray-50 font-mono font-bold" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="triggerCondition" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Condition</FormLabel><FormControl><Input className="h-10 bg-gray-50" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Due Date</FormLabel><FormControl><Input type="date" className="h-10 bg-gray-50" {...field} /></FormControl></FormItem>
                )} />
                <Button type="submit" className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-[8px] mt-2" disabled={createMut.isPending}>Add Milestone</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-gray-200 rounded-[12px] overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-100 bg-gray-50/80 hover:bg-gray-50/80">
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 px-5">Milestone</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500">Condition</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500">Due Date</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Amount</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-500 px-5">Status</TableHead>
              <TableHead className="h-10 w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones?.map(m => (
              <TableRow key={m.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                <TableCell className="px-5 py-3 font-bold text-sm text-gray-900">{m.milestoneName}</TableCell>
                <TableCell className="py-3 text-xs font-medium text-gray-500">{m.triggerCondition || '-'}</TableCell>
                <TableCell className="py-3 text-sm font-semibold text-gray-700">{m.dueDate ? format(new Date(m.dueDate), 'MMM d, yyyy') : '-'}</TableCell>
                <TableCell className="py-3 text-right font-mono font-bold text-[15px] text-gray-900">₹{Number(m.amount ?? 0).toLocaleString("en-IN")}</TableCell>
                <TableCell className="px-5 py-3">
                  <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                    m.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                    m.status === 'Triggered' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                    'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {m.status}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 pr-5 text-right">
                  {m.status === 'Pending' && (
                    <Button size="sm" className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold h-8 rounded-[6px] shadow-none gap-1.5 text-xs" 
                      onClick={() => triggerMut.mutate({ id: m.id })} disabled={triggerMut.isPending}>
                      <Zap className="h-3 w-3" /> Trigger
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!milestones?.length && (
              <TableRow><TableCell colSpan={6} className="text-center h-24 text-gray-500 font-medium text-sm">No milestones defined.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
