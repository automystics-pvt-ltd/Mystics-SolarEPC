import { useState } from "react";
import { useGetPaymentMilestones, useCreatePaymentMilestone, useTriggerPaymentMilestone, getGetPaymentMilestonesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Zap, Flag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { SectionCard, StatusBadge, EmptyState } from "@/components/shared";
import { motion } from "framer-motion";

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

  const addMilestoneDialog = (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Milestone
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold tracking-tight">New Milestone</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(d =>
              createMut.mutate({ id: projectId, data: { ...d, projectId } as any })
            )}
            className="space-y-5"
          >
            <FormField control={form.control} name="milestoneName" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</FormLabel>
                <FormControl><Input className="h-10" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹)</FormLabel>
                <FormControl><Input type="number" className="h-10 font-mono" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="triggerCondition" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Condition</FormLabel>
                <FormControl><Input className="h-10" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="dueDate" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Due Date</FormLabel>
                <FormControl><Input type="date" className="h-10" {...field} /></FormControl>
              </FormItem>
            )} />
            <Button
              type="submit"
              className="w-full h-11 mt-2"
              disabled={createMut.isPending}
            >
              {createMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding…</> : "Add Milestone"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <SectionCard
        title="Payment Milestones"
        actions={addMilestoneDialog}
        isLoading={isLoading}
        noPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-5">Milestone</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Condition</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Date</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
              <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-5">Status</TableHead>
              <TableHead className="h-10 w-[110px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones?.map(m => (
              <TableRow key={m.id} className="border-b border-border/40 hover:bg-muted/20">
                <TableCell className="px-5 py-3 font-semibold text-sm text-foreground">{m.milestoneName}</TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground">{m.triggerCondition || "—"}</TableCell>
                <TableCell className="py-3 text-sm font-medium text-foreground">
                  {m.dueDate ? format(new Date(m.dueDate), "MMM d, yyyy") : "—"}
                </TableCell>
                <TableCell className="py-3 text-right font-mono font-bold text-sm text-foreground">
                  ₹{Number(m.amount ?? 0).toLocaleString("en-IN")}
                </TableCell>
                <TableCell className="px-5 py-3">
                  <StatusBadge status={m.status} size="sm" />
                </TableCell>
                <TableCell className="py-3 pr-5 text-right">
                  {m.status === "Pending" && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => triggerMut.mutate({ id: m.id })}
                      disabled={triggerMut.isPending}
                    >
                      <Zap className="h-3 w-3" /> Trigger
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!milestones?.length && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={Flag}
                    title="No milestones defined"
                    description="Add payment milestones to track project billing."
                    size="sm"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>
    </motion.div>
  );
}
