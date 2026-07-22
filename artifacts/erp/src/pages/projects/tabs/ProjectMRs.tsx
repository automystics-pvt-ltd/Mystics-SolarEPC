import { useGetMaterialRequests, getGetMaterialRequestsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function ProjectMRs({ projectId }: { projectId: number }) {
  const { data: mrs, isLoading } = useGetMaterialRequests(
    { projectId },
    { query: { enabled: !!projectId, queryKey: getGetMaterialRequestsQueryKey({ projectId }) } }
  );

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Material Requests</h3>
      </div>

      {mrs?.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
            No material requests found for this project.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {mrs?.map(mr => (
            <Card key={mr.id} className="shadow-sm overflow-hidden">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value={`mr-${mr.id}`} className="border-b-0">
                  <AccordionTrigger className="hover:no-underline px-4 py-3 bg-muted/20">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-medium">{mr.mrNumber || `MR-${mr.id.toString().padStart(4, '0')}`}</span>
                        <Badge variant={mr.status === 'Approved' ? 'default' : mr.status === 'Draft' ? 'secondary' : 'outline'}>
                          {mr.status}
                        </Badge>
                      </div>
                      <div className="text-sm font-normal text-muted-foreground flex items-center gap-4">
                        <span>Required: {mr.requiredByDate ? format(new Date(mr.requiredByDate), 'MMM d, yyyy') : '-'}</span>
                        <span>Items: {mr.items?.length || 0}</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 border-t">
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Specs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mr.items?.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.itemName}</TableCell>
                            <TableCell className="font-mono text-xs">{item.itemCode || '-'}</TableCell>
                            <TableCell className="text-right font-semibold">{item.qty}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{item.specifications || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {mr.vendorQuotations && mr.vendorQuotations.length > 0 && (
                      <div className="p-4 bg-muted/30 border-t">
                        <h4 className="text-sm font-semibold mb-3">Vendor Quotations</h4>
                        <div className="grid gap-4 md:grid-cols-2">
                          {mr.vendorQuotations.map(vq => (
                            <div key={vq.id} className="bg-card p-3 rounded border shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-semibold text-sm">{vq.vendorName}</p>
                                  <p className="text-xs text-muted-foreground">{vq.quotationNumber || `VQ-${vq.id}`}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-primary">${vq.quotedAmount.toLocaleString()}</p>
                                  <Badge variant="outline" className="text-[10px] mt-1">{vq.status}</Badge>
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
