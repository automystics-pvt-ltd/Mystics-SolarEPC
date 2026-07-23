import { useGetMaterialRequests, getGetMaterialRequestsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageSearch } from "lucide-react";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionCard, StatusBadge, EmptyState, SkeletonList } from "@/components/shared";
import { motion } from "framer-motion";

export function ProjectMRs({ projectId }: { projectId: number }) {
  const { data: mrs, isLoading } = useGetMaterialRequests(
    { projectId },
    { query: { enabled: !!projectId, queryKey: getGetMaterialRequestsQueryKey({ projectId }) } }
  );

  if (isLoading) {
    return <SkeletonList rows={4} cols={3} showHeader />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionCard title="Material Requests" noPadding={!!mrs?.length}>
        {!mrs?.length ? (
          <EmptyState
            icon={PackageSearch}
            title="No material requests found"
            description="Material requests linked to this project will appear here."
            size="sm"
          />
        ) : (
          <div className="space-y-3 p-4">
            {mrs.map(mr => (
              <div key={mr.id} className="border border-border rounded-xl bg-card overflow-hidden">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value={`mr-${mr.id}`} className="border-none">
                    <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          <span className="font-mono font-bold text-sm text-foreground">
                            {mr.mrNumber || `MR-${mr.id.toString().padStart(4, "0")}`}
                          </span>
                          <StatusBadge status={mr.status} size="sm" />
                        </div>
                        <div className="text-xs font-medium text-muted-foreground flex items-center gap-6">
                          <span>
                            Req:{" "}
                            <span className="text-foreground ml-1">
                              {mr.requiredByDate ? format(new Date(mr.requiredByDate), "MMM d, yyyy") : "—"}
                            </span>
                          </span>
                          <span>
                            Items:{" "}
                            <span className="text-foreground ml-1">{mr.items?.length || 0}</span>
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-border/60">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow className="border-b border-border/60">
                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-5 w-[40%]">Item Name</TableHead>
                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Code</TableHead>
                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Qty</TableHead>
                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-4">Unit</TableHead>
                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-5">Specs</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mr.items?.map((item, idx) => (
                            <TableRow key={idx} className="border-b border-border/40">
                              <TableCell className="px-5 py-3 font-semibold text-sm text-foreground">{item.itemName}</TableCell>
                              <TableCell className="py-3 font-mono text-[11px] font-medium text-muted-foreground">{item.itemCode || "—"}</TableCell>
                              <TableCell className="py-3 text-right font-mono font-semibold text-sm text-foreground">{item.qty}</TableCell>
                              <TableCell className="py-3 pl-4 text-sm text-muted-foreground">{item.unit}</TableCell>
                              <TableCell className="px-5 py-3 text-xs text-muted-foreground max-w-xs truncate">{item.specifications || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {mr.vendorQuotations && mr.vendorQuotations.length > 0 && (
                        <div className="p-5 bg-muted/20 border-t border-border/60">
                          <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                            Vendor Quotations
                          </h4>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {mr.vendorQuotations.map(vq => (
                              <div key={vq.id} className="bg-card p-4 rounded-lg border border-border flex justify-between items-start">
                                <div>
                                  <p className="font-semibold text-sm text-foreground leading-tight">{vq.vendorName}</p>
                                  <p className="text-[11px] font-mono text-muted-foreground mt-1">
                                    {vq.quotationNumber || `VQ-${vq.id}`}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-mono font-bold text-[15px] text-primary">
                                    ₹{Number(vq.quotedAmount).toLocaleString("en-IN")}
                                  </p>
                                  <div className="mt-1.5">
                                    <StatusBadge status={vq.status} size="sm" />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}
