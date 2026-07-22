import { useState, useRef, useEffect } from "react";
import { useGetQuotation, useCreateQuotation, useUpdateQuotation, useApproveQuotation, useLogClientPO } from "@workspace/api-client-react";
import { getGetQuotationQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Plus, Trash2, Save, FileCheck, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

export function QuotationDetail({ id }: { id?: string }) {
  const isNew = !id || id === "new";
  const quoteId = !isNew ? parseInt(id, 10) : 0;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [leadId, setLeadId] = useState("");
  const [markupPct, setMarkupPct] = useState(10);
  const [validTill, setValidTill] = useState("");
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(isNew);

  const { data: quote, isLoading } = useGetQuotation(quoteId, {
    query: { enabled: !isNew, queryKey: getGetQuotationQueryKey(quoteId) }
  });

  const createMutation = useCreateQuotation({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Quotation created successfully" });
        setLocation(`/crm/quotations/${data.id}`);
      }
    }
  });

  const updateMutation = useUpdateQuotation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quoteId) });
        setIsEditing(false);
        toast({ title: "Quotation updated successfully" });
      }
    }
  });

  const approveMutation = useApproveQuotation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quoteId) });
        toast({ title: "Quotation approved" });
      }
    }
  });

  const logPoMutation = useLogClientPO({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Client PO logged & Project Created!" });
        setLocation(`/crm/client-pos`);
      }
    }
  });

  // Init local state when quote loads — must be in useEffect, not during render
  const initRef = useRef(false);
  useEffect(() => {
    if (quote && !initRef.current && !isNew) {
      setMarkupPct(quote.markupPct ?? 0);
      setBoqItems(quote.boqItems ?? []);
      if (quote.validTill) {
        // validTill is a date string (YYYY-MM-DD) — safe to use directly
        setValidTill(quote.validTill.split('T')[0]);
      }
      initRef.current = true;
    }
  }, [quote, isNew]);

  const handleSave = () => {
    if (isNew) {
      createMutation.mutate({
        data: {
          leadId: parseInt(leadId, 10),
          markupPct,
          validTill: validTill ? new Date(validTill).toISOString() : undefined,
          boqItems: boqItems.map(item => ({ ...item, amount: item.qty * item.unitPrice }))
        }
      });
    } else {
      updateMutation.mutate({
        id: quoteId,
        data: {
          markupPct,
          validTill: validTill ? new Date(validTill).toISOString() : undefined,
          boqItems: boqItems.map(item => ({ ...item, amount: item.qty * item.unitPrice }))
        }
      });
    }
  };

  const handleAddLine = () => {
    setBoqItems([...boqItems, { description: "", qty: 1, unit: "NOS", unitPrice: 0 }]);
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newItems = [...boqItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setBoqItems(newItems);
  };

  const removeLine = (index: number) => {
    setBoqItems(boqItems.filter((_, i) => i !== index));
  };

  const totalBaseAmount = boqItems.reduce((acc, item) => acc + (item.qty * item.unitPrice), 0);
  const calculatedTotal = totalBaseAmount * (1 + markupPct / 100);

  if (!isNew && isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4 pb-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/crm/quotations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">
                {isNew ? "New Quotation" : `QTN-${quoteId.toString().padStart(4, '0')}`}
              </h2>
              {!isNew && (
                <Badge variant={quote?.approvalStatus === 'Approved' ? 'default' : 'secondary'} className="uppercase">
                  {quote?.approvalStatus}
                </Badge>
              )}
            </div>
            {!isNew && (
              <p className="text-muted-foreground mt-1">
                Version {quote?.version} • Lead #{quote?.leadId}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isNew && quote?.approvalStatus === 'Draft' && !isEditing && (
            <Button variant="outline" onClick={() => approveMutation.mutate({ id: quoteId, data: { action: 'Approve' } })} disabled={approveMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" /> Approve
            </Button>
          )}
          {!isNew && quote?.approvalStatus === 'Approved' && (
            <Button onClick={() => {
               const poNumber = prompt("Enter Client PO Number to Log & Convert to Project:");
               if (poNumber) {
                 logPoMutation.mutate({ id: quoteId, data: { clientPoNumber: poNumber, contractValue: calculatedTotal } });
               }
            }} disabled={logPoMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              <FileCheck className="h-4 w-4 mr-2" /> Log Client PO
            </Button>
          )}

          {isEditing ? (
            <>
              {!isNew && <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>}
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" /> {isNew ? "Create" : "Save"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>Edit</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm md:col-span-1">
          <CardHeader>
            <CardTitle>Quotation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isNew && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Lead ID</p>
                <Input value={leadId} onChange={e => setLeadId(e.target.value)} type="number" placeholder="Enter Lead ID" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Markup Percentage (%)</p>
              {isEditing ? (
                <Input value={markupPct} onChange={e => setMarkupPct(Number(e.target.value))} type="number" />
              ) : (
                <p className="font-medium text-lg">{markupPct}%</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Valid Till</p>
              {isEditing ? (
                <Input value={validTill} onChange={e => setValidTill(e.target.value)} type="date" />
              ) : (
                <p className="font-medium">{quote?.validTill ? format(new Date(quote.validTill), 'MMMM d, yyyy') : 'No expiry set'}</p>
              )}
            </div>
            <div className="pt-4 border-t border-border mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Final Amount</p>
              <p className="text-3xl font-bold tracking-tight text-primary">
                ${calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Bill of Quantities (BOQ)</CardTitle>
              <CardDescription>Line items and pricing</CardDescription>
            </div>
            {isEditing && (
              <Button variant="outline" size="sm" onClick={handleAddLine} className="gap-2">
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Unit Price ($)</TableHead>
                  <TableHead className="text-right">Amount ($)</TableHead>
                  {isEditing && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {boqItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {isEditing ? (
                        <Input value={item.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
                      ) : item.description}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input type="number" value={item.qty} onChange={e => updateLine(idx, 'qty', Number(e.target.value))} />
                      ) : item.qty}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input value={item.unit} onChange={e => updateLine(idx, 'unit', e.target.value)} />
                      ) : item.unit}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input type="number" value={item.unitPrice} onChange={e => updateLine(idx, 'unitPrice', Number(e.target.value))} />
                      ) : item.unitPrice.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {(item.qty * item.unitPrice).toLocaleString()}
                    </TableCell>
                    {isEditing && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeLine(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {boqItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isEditing ? 6 : 5} className="text-center text-muted-foreground h-24">
                      No items added to BOQ.
                    </TableCell>
                  </TableRow>
                )}
                {boqItems.length > 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={4} className="text-right font-bold">Base Total</TableCell>
                    <TableCell className="text-right font-bold">${totalBaseAmount.toLocaleString()}</TableCell>
                    {isEditing && <TableCell></TableCell>}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
