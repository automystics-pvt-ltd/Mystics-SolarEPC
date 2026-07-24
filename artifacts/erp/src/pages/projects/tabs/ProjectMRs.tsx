import { useGetMaterialRequests, getGetMaterialRequestsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  PackageSearch, ExternalLink, ArrowUpRight, ShoppingCart,
  FileText, ChevronRight, Info,
} from "lucide-react";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionCard, StatusBadge, EmptyState, SkeletonList } from "@/components/shared";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function ProjectMRs({ projectId }: { projectId: number }) {
  const [, navigate] = useLocation();

  const { data: mrs, isPending, isLoading } = useGetMaterialRequests(
    { projectId },
    { query: { enabled: !!projectId, queryKey: getGetMaterialRequestsQueryKey({ projectId }) } }
  );

  if (isPending) return <SkeletonList rows={4} cols={3} showHeader />;

  const openMRs   = mrs?.filter(m => m.status === "Open" || m.status === "Pending").length ?? 0;
  const totalMRs  = mrs?.length ?? 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

      {/* ── Hub Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border bg-muted/20">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">Procurement Hub</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totalMRs} material request{totalMRs !== 1 ? "s" : ""} · {openMRs} open
              {totalMRs > 0 && " · Manage in the Procurement module"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => navigate("/procurement/pos")}
          >
            Purchase Orders <ExternalLink className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => navigate("/procurement/quotations")}
          >
            Quotations <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* ── Single-source-of-truth notice ───────────────────────────────────── */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-blue-50/60 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40">
        <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-snug">
          Material requests and purchase orders are managed in the{" "}
          <button
            onClick={() => navigate("/procurement/dashboard")}
            className="font-bold underline underline-offset-2"
          >
            Procurement module
          </button>
          . Create MRs here from the BOQ tab — all subsequent management (vendors, POs, GRNs, invoices) happens in Procurement.
        </p>
      </div>

      {/* ── MR list ─────────────────────────────────────────────────────────── */}
      <SectionCard
        title="Material Requests"
        noPadding={!!mrs?.length}
        actions={
          mrs?.length ? (
            <button
              onClick={() => navigate("/procurement/pos")}
              className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline"
            >
              View POs <ChevronRight className="h-3 w-3" />
            </button>
          ) : null
        }
      >
        {!mrs?.length ? (
          <EmptyState
            icon={PackageSearch}
            title="No material requests yet"
            description="Go to the BOQ tab and click 'Create MRs' to raise material requests for Procurement-sourced items."
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
                            Required:{" "}
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
                      {/* Line items */}
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

                      {/* Footer: open in procurement + quotations link */}
                      <div className="flex items-center justify-between px-5 py-3 bg-muted/20 border-t border-border/60">
                        <div className="flex items-center gap-3">
                          {mr.vendorQuotations && mr.vendorQuotations.length > 0 ? (
                            <span className="text-[11px] text-muted-foreground">
                              {mr.vendorQuotations.length} vendor quotation{mr.vendorQuotations.length !== 1 ? "s" : ""} received
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">No vendor quotations yet</span>
                          )}
                          <button
                            onClick={() => navigate("/procurement/quotations")}
                            className={cn(
                              "flex items-center gap-1 text-[11px] font-semibold hover:underline",
                              mr.vendorQuotations?.length
                                ? "text-primary"
                                : "text-muted-foreground"
                            )}
                          >
                            <FileText className="h-3 w-3" />
                            {mr.vendorQuotations?.length ? "View quotations" : "Get quotations"}
                            <ArrowUpRight className="h-2.5 w-2.5" />
                          </button>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1.5"
                          onClick={() => navigate("/procurement/pos")}
                        >
                          Open in Procurement <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
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
