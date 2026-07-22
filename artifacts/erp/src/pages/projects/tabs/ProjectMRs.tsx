import { useGetMaterialRequests, getGetMaterialRequestsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, PackageSearch } from "lucide-react";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function ProjectMRs({ projectId }: { projectId: number }) {
  const { data: mrs, isLoading } = useGetMaterialRequests(
    { projectId },
    { query: { enabled: !!projectId, queryKey: getGetMaterialRequestsQueryKey({ projectId }) } }
  );

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50/50 p-4 rounded-[12px] border border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <PackageSearch className="h-4 w-4 text-gray-400" />
          Material Requests
        </h3>
      </div>

      {mrs?.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-[12px] h-48 flex flex-col items-center justify-center text-center p-6 bg-gray-50/50">
          <PackageSearch className="h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm font-bold text-gray-600">No material requests found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mrs?.map(mr => (
            <div key={mr.id} className="border border-gray-200 rounded-[12px] bg-white overflow-hidden shadow-sm">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value={`mr-${mr.id}`} className="border-none">
                  <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-sm text-gray-900">{mr.mrNumber || `MR-${mr.id.toString().padStart(4, '0')}`}</span>
                        <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                          mr.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                          mr.status === 'Draft' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {mr.status}
                        </Badge>
                      </div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-6">
                        <span>Req: <span className="text-gray-900 ml-1">{mr.requiredByDate ? format(new Date(mr.requiredByDate), 'MMM d, yyyy') : '-'}</span></span>
                        <span>Items: <span className="text-gray-900 ml-1">{mr.items?.length || 0}</span></span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 border-t border-gray-100">
                    <Table>
                      <TableHeader className="bg-gray-50/80">
                        <TableRow className="border-b border-gray-100">
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-400 px-5 w-[40%]">Item Name</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-400">Code</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right">Quantity</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-400 pl-4">Unit</TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-gray-400 px-5">Specs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mr.items?.map((item, idx) => (
                          <TableRow key={idx} className="border-b border-gray-50">
                            <TableCell className="px-5 py-3 font-bold text-sm text-gray-900">{item.itemName}</TableCell>
                            <TableCell className="py-3 font-mono text-[11px] font-bold text-gray-500">{item.itemCode || '-'}</TableCell>
                            <TableCell className="py-3 text-right font-mono font-bold text-sm text-gray-900">{item.qty}</TableCell>
                            <TableCell className="py-3 pl-4 text-sm font-semibold text-gray-600">{item.unit}</TableCell>
                            <TableCell className="px-5 py-3 text-xs font-medium text-gray-500 max-w-xs truncate">{item.specifications || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {mr.vendorQuotations && mr.vendorQuotations.length > 0 && (
                      <div className="p-5 bg-orange-50/30 border-t border-gray-100">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Vendor Quotations</h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {mr.vendorQuotations.map(vq => (
                            <div key={vq.id} className="bg-white p-4 rounded-[8px] border border-gray-200 shadow-sm flex justify-between items-start">
                              <div>
                                <p className="font-bold text-sm text-gray-900 leading-tight">{vq.vendorName}</p>
                                <p className="text-[11px] font-mono font-bold text-gray-500 mt-1">{vq.quotationNumber || `VQ-${vq.id}`}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-bold text-[15px] text-[#EA580C]">${vq.quotedAmount.toLocaleString()}</p>
                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider rounded-[4px] mt-1.5">{vq.status}</Badge>
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
    </div>
  );
}
