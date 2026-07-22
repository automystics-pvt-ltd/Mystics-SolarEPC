import { useGetQuotations, useCreateQuotation, getGetQuotationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quotations</h2>
          <p className="text-muted-foreground mt-1">Manage sales proposals and approvals.</p>
        </div>
        <Button onClick={() => setLocation("/crm/quotations/new")} className="gap-2">
          <Plus className="h-4 w-4" /> Create Quotation
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="p-4 border-b">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by ID or Status..." 
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Quotation ID</TableHead>
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid Till</TableHead>
                  <TableHead className="text-right">Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((quote) => (
                  <TableRow key={quote.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setLocation(`/crm/quotations/${quote.id}`)}>
                    <TableCell className="font-mono font-medium">QTN-{quote.id.toString().padStart(4, '0')}</TableCell>
                    <TableCell>
                      <Link href={`/crm/leads/${quote.leadId}`} className="text-primary hover:underline" onClick={e => e.stopPropagation()}>
                        Lead #{quote.leadId}
                      </Link>
                    </TableCell>
                    <TableCell>v{quote.version}</TableCell>
                    <TableCell className="font-semibold">${quote.totalAmount?.toLocaleString() || 0}</TableCell>
                    <TableCell>
                      <Badge variant={quote.approvalStatus === 'Approved' ? 'default' : quote.approvalStatus === 'Rejected' ? 'destructive' : 'secondary'}>
                        {quote.approvalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{quote.validTill ? format(new Date(quote.validTill), 'MMM d, yyyy') : '-'}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered?.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No quotations found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
