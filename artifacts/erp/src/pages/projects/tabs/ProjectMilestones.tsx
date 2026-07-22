import { useState } from "react";
import { useGetPaymentMilestones, useCreatePaymentMilestone, useTriggerPaymentMilestone, getGetPaymentMilestonesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Payment Milestones</h3>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Milestone</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Milestone</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMut.mutate({ data: { ...d, projectId } as any }))} className="space-y-4">
                <FormField control={form.control} name="milestoneName" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel>Amount ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="triggerCondition" render={({ field }) => (
                  <FormItem><FormLabel>Condition</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMut.isPending}>Add Milestone</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Milestone</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones?.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.milestoneName}</TableCell>
                  <TableCell className="text-muted-foreground">{m.triggerCondition || '-'}</TableCell>
                  <TableCell>{m.dueDate ? format(new Date(m.dueDate), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell className="text-right font-bold">${Number(m.amount ?? 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === 'Paid' ? 'default' : m.status === 'Triggered' ? 'secondary' : 'outline'}>
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {m.status === 'Pending' && (
                      <Button size="sm" variant="outline" className="gap-2 text-xs h-7" 
                        onClick={() => triggerMut.mutate({ id: m.id })} disabled={triggerMut.isPending}>
                        <Zap className="h-3 w-3 text-accent" /> Trigger
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!milestones?.length && (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No milestones defined.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
