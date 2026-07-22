import { useState, useRef, useEffect } from "react";
import { useGetQuotation, useCreateQuotation, useUpdateQuotation, useApproveQuotation, useLogClientPO } from "@workspace/api-client-react";
import { getGetQuotationQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Plus, Trash2, Save, FileCheck, CheckCircle, FileText, Calculator } from "lucide-react";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { motion } from "framer-motion";

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

  const initRef = useRef(false);
  useEffect(() => {
    if (quote && !initRef.current && !isNew) {
      setMarkupPct(quote.markupPct ?? 0);
      setBoqItems(quote.boqItems ?? []);
      if (quote.validTill) {
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
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[12px] premium-shadow border border-gray-100">
        <div className="flex items-center gap-5">
          <Button variant="outline" size="icon" onClick={() => setLocation("/crm/quotations")} className="h-10 w-10 rounded-[8px] border-gray-200 text-gray-500 hover:text-gray-900 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-mono">
                {isNew ? "New Quotation" : `QTN-${quoteId.toString().padStart(4, '0')}`}
              </h1>
              {!isNew && (
                <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wide border px-2 py-0.5 rounded-[4px] ${quote?.approvalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {quote?.approvalStatus}
                </Badge>
              )}
            </div>
            {!isNew && (
              <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
                <span className="font-bold">Version {quote?.version}</span>
                <span className="text-gray-300">•</span>
                <span className="font-mono text-xs text-gray-400">Lead ID: {quote?.leadId}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isNew && quote?.approvalStatus === 'Draft' && !isEditing && (
            <Button onClick={() => approveMutation.mutate({ id: quoteId, data: { action: 'Approve' } })} disabled={approveMutation.isPending} className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-[8px]">
              <CheckCircle className="h-4 w-4 mr-2" /> Approve Quote
            </Button>
          )}
          {!isNew && quote?.approvalStatus === 'Approved' && (
            <Button onClick={() => {
               const poNumber = prompt("Enter Client PO Number to Log & Convert to Project:");
               if (poNumber) {
                 logPoMutation.mutate({ id: quoteId, data: { clientPoNumber: poNumber, contractValue: calculatedTotal } });
               }
            }} disabled={logPoMutation.isPending} className="h-10 bg-[#0C1445] hover:bg-[#0A0F2C] text-white font-bold rounded-[8px]">
              <FileCheck className="h-4 w-4 mr-2" /> Convert to PO
            </Button>
          )}

          {isEditing ? (
            <>
              {!isNew && <Button variant="ghost" onClick={() => setIsEditing(false)} className="h-10 font-bold text-gray-500">Cancel</Button>}
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="h-10 bg-gray-900 hover:bg-black text-white font-bold rounded-[8px] px-6">
                {isNew || updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isNew ? "Create" : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto h-10 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold rounded-[8px] shadow-sm">
              Edit Configuration
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Settings Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Pricing Settings</h3>
            </div>
            <div className="p-5 space-y-5">
              {isNew && (
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Lead ID</label>
                  <Input value={leadId} onChange={e => setLeadId(e.target.value)} type="number" placeholder="Enter Lead ID" className="h-10 bg-gray-50 font-mono font-bold text-sm" />
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex justify-between">
                  <span>Markup Margin</span>
                  {isEditing && <span className="text-[#EA580C]">%</span>}
                </label>
                {isEditing ? (
                  <Input value={markupPct} onChange={e => setMarkupPct(Number(e.target.value))} type="number" className="h-10 bg-gray-50 font-mono font-bold text-sm" />
                ) : (
                  <p className="font-bold text-gray-900 text-lg">{markupPct}% <span className="text-xs text-gray-400 font-medium ml-1">applied to base</span></p>
                )}
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Valid Until</label>
                {isEditing ? (
                  <Input value={validTill} onChange={e => setValidTill(e.target.value)} type="date" className="h-10 bg-gray-50 font-bold text-sm" />
                ) : (
                  <p className="font-bold text-gray-900 text-sm">{quote?.validTill ? format(new Date(quote.validTill), 'MMMM d, yyyy') : 'No expiry set'}</p>
                )}
              </div>
              <div className="pt-5 border-t border-gray-100 mt-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Final Contract Value</p>
                <p className="text-3xl font-bold tracking-tight text-[#EA580C] font-mono">
                  ${calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-widest">Base: ${totalBaseAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* BOQ Editor */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Bill of Quantities (BOQ)</h3>
                  <p className="text-[11px] font-medium text-gray-500 mt-0.5">Define line items, unit costs, and quantities</p>
                </div>
              </div>
              {isEditing && (
                <Button size="sm" onClick={handleAddLine} className="h-8 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-[6px] shadow-none w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-1.5" /> Add Row
                </Button>
              )}
            </div>
            
            <div className="p-0 overflow-x-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white px-5 w-[40%]">Item Description</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white">Qty</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white">UoM</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white text-right">Unit Rate ($)</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white text-right px-5">Total ($)</TableHead>
                    {isEditing && <TableHead className="h-10 w-[50px] bg-white"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boqItems.map((item, idx) => (
                    <TableRow key={idx} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                      <TableCell className="px-5 py-3 align-top">
                        {isEditing ? (
                          <textarea 
                            value={item.description} 
                            onChange={e => updateLine(idx, 'description', e.target.value)} 
                            className="w-full h-10 p-2 text-sm bg-gray-50 border border-gray-200 rounded-[6px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EA580C] resize-none"
                            placeholder="Solar modules 550Wp..."
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900 leading-tight block">{item.description}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 align-top">
                        {isEditing ? (
                          <Input type="number" value={item.qty} onChange={e => updateLine(idx, 'qty', Number(e.target.value))} className="h-10 bg-gray-50 font-mono font-bold text-sm w-20" />
                        ) : (
                          <span className="font-mono font-bold text-sm text-gray-900">{item.qty}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 align-top">
                        {isEditing ? (
                          <Input value={item.unit} onChange={e => updateLine(idx, 'unit', e.target.value)} className="h-10 bg-gray-50 text-sm font-bold w-16" />
                        ) : (
                          <span className="text-sm font-bold text-gray-500">{item.unit}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 align-top text-right">
                        {isEditing ? (
                          <Input type="number" value={item.unitPrice} onChange={e => updateLine(idx, 'unitPrice', Number(e.target.value))} className="h-10 bg-gray-50 font-mono font-bold text-sm text-right ml-auto w-28" />
                        ) : (
                          <span className="font-mono font-bold text-sm text-gray-900">{item.unitPrice.toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-3 align-top text-right">
                        <span className="font-mono font-bold text-sm text-[#EA580C]">{(item.qty * item.unitPrice).toLocaleString()}</span>
                      </TableCell>
                      {isEditing && (
                        <TableCell className="py-3 align-top pr-3">
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500 hover:bg-red-50 h-10 w-10 rounded-[6px]" onClick={() => removeLine(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {boqItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isEditing ? 6 : 5} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <FileText className="h-8 w-8 mb-2 opacity-20" />
                          <span className="text-sm font-medium">BOQ is empty. Add line items.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {boqItems.length > 0 && (
              <div className="bg-gray-50/80 border-t border-gray-100 p-5 flex justify-end items-center gap-6 mt-auto">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Base Subtotal</span>
                <span className="text-2xl font-bold font-mono text-gray-900 tracking-tight">${totalBaseAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
