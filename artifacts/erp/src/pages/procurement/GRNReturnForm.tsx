import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, ChevronRight, PackageX, Loader2, CheckCircle2 } from "lucide-react";
import { apiGet, apiPost } from "@/lib/fetch";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Step = "select-grn" | "select-items" | "details";

export default function GRNReturnForm() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("select-grn");
  const [selectedGrn, setSelectedGrn] = useState<any>(null);
  const [grnSearch, setGrnSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<number, { returnQty: string; rejectionReason: string }>>({});
  const [returnReason, setReturnReason] = useState("");
  const [returnType, setReturnType] = useState("Rejection");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");

  const { data: allGrns = [], isLoading: grnsLoading } = useQuery({
    queryKey: ["proc-grns-all"],
    queryFn: () => apiGet<any[]>("/proc-grns"),
  });

  const { data: grnDetail } = useQuery({
    queryKey: ["proc-grn-detail", selectedGrn?.id],
    queryFn: () => apiGet<any>(`/proc-grns/${selectedGrn?.id}`),
    enabled: !!selectedGrn?.id && step === "select-items",
  });

  const eligible = (allGrns as any[]).filter(g =>
    ["Accepted", "PartiallyAccepted"].includes(g.status) &&
    (!grnSearch || g.grnNumber?.toLowerCase().includes(grnSearch.toLowerCase()) ||
      g.vendorName?.toLowerCase().includes(grnSearch.toLowerCase()))
  );

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost<any>("/grn-returns", body),
    onSuccess: (data: any) => {
      toast({ title: "GRN Return created", description: `${data.returnNumber} created successfully` });
      setLocation("/procurement/grn-returns");
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to create return" });
    },
  });

  const handleSubmit = () => {
    const items = Object.entries(selectedItems)
      .filter(([, v]) => v.returnQty && Number(v.returnQty) > 0)
      .map(([grnItemId, v]) => {
        const item = grnDetail?.items?.find((i: any) => i.id === Number(grnItemId));
        return {
          grnItemId: Number(grnItemId),
          materialId: item?.materialId,
          materialCode: item?.materialCode,
          materialName: item?.itemName || item?.materialName || "Unknown",
          uom: item?.uom || "Nos",
          returnQty: Number(v.returnQty),
          unitPrice: item?.unitPrice || 0,
          rejectionReason: v.rejectionReason,
        };
      });

    if (items.length === 0) {
      toast({ variant: "destructive", title: "No items", description: "Select at least one item with qty > 0" });
      return;
    }
    if (!returnReason.trim()) {
      toast({ variant: "destructive", title: "Required", description: "Return reason is required" });
      return;
    }

    createMutation.mutate({
      grnId: selectedGrn?.id,
      returnReason, returnType, returnDate, remarks, items,
      userId: user?.id, userName: user?.name,
    });
  };

  const STEPS = ["select-grn", "select-items", "details"] as const;
  const stepLabels = ["Select GRN", "Select Items", "Return Details"];
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/procurement/grn-returns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New GRN Return</h1>
          <p className="text-sm text-gray-500">Return-to-Vendor (RTV) request</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold transition-colors",
              i < stepIdx ? "bg-emerald-500 text-white" :
              i === stepIdx ? "bg-orange-600 text-white" :
              "bg-gray-200 text-gray-500"
            )}>
              {i < stepIdx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn("text-sm font-medium", i === stepIdx ? "text-gray-900" : "text-gray-400")}>{label}</span>
            {i < stepLabels.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select GRN */}
      {step === "select-grn" && (
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select a GRN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by GRN number or vendor..."
                value={grnSearch}
                onChange={e => setGrnSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {grnsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            ) : eligible.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <PackageX className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No eligible GRNs found</p>
                <p className="text-xs mt-1">Only Accepted or Partially Accepted GRNs can have returns</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {eligible.map((g: any) => (
                  <div
                    key={g.id}
                    onClick={() => { setSelectedGrn(g); setStep("select-items"); }}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:border-orange-300 hover:bg-orange-50/30",
                      selectedGrn?.id === g.id ? "border-orange-400 bg-orange-50" : "border-gray-200"
                    )}
                  >
                    <div>
                      <p className="font-mono font-semibold text-orange-600 text-sm">{g.grnNumber}</p>
                      <p className="text-sm text-gray-700 font-medium">{g.vendorName}</p>
                      <p className="text-xs text-gray-400">{g.deliveryDate || "No delivery date"}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {g.status}
                      </Badge>
                      <p className="text-xs text-gray-400 mt-1">
                        {g.totalAcceptedQty ?? 0} accepted / {g.totalRejectedQty ?? 0} rejected
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Items */}
      {step === "select-items" && (
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Select Items to Return</CardTitle>
              <Badge variant="outline" className="font-mono text-orange-600">{selectedGrn?.grnNumber}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!grnDetail ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wide text-gray-500 bg-gray-50/50">
                        <th className="text-left px-3 py-2">Material</th>
                        <th className="text-center px-3 py-2">UOM</th>
                        <th className="text-center px-3 py-2">Received</th>
                        <th className="text-center px-3 py-2">Accepted</th>
                        <th className="text-center px-3 py-2">Rejected</th>
                        <th className="text-center px-3 py-2">Return Qty</th>
                        <th className="text-left px-3 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(grnDetail?.items ?? []).map((item: any) => {
                        const sel = selectedItems[item.id] || { returnQty: "", rejectionReason: "" };
                        return (
                          <tr key={item.id} className="border-b border-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{item.itemName || item.materialName}</td>
                            <td className="px-3 py-2 text-center text-gray-500">{item.uom}</td>
                            <td className="px-3 py-2 text-center">{item.receivedQty}</td>
                            <td className="px-3 py-2 text-center text-emerald-600">{item.acceptedQty}</td>
                            <td className="px-3 py-2 text-center text-red-500">{item.rejectedQty}</td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min={0}
                                max={item.receivedQty}
                                value={sel.returnQty}
                                onChange={e => setSelectedItems(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id] || { rejectionReason: "" }, returnQty: e.target.value }
                                }))}
                                className="w-20 h-7 text-center text-sm"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                value={sel.rejectionReason}
                                onChange={e => setSelectedItems(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id] || { returnQty: "" }, rejectionReason: e.target.value }
                                }))}
                                className="h-7 text-sm"
                                placeholder="Reason..."
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between mt-4">
                  <Button variant="outline" onClick={() => setStep("select-grn")}>Back</Button>
                  <Button
                    onClick={() => setStep("details")}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    disabled={!Object.values(selectedItems).some(v => Number(v.returnQty) > 0)}
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Details */}
      {step === "details" && (
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Return Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Return Type</Label>
                <Select value={returnType} onValueChange={setReturnType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Rejection", "Damage", "Excess", "Quality"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Return Date</Label>
                <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Return Reason <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Explain why items are being returned..."
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                placeholder="Additional notes (optional)..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("select-items")}>Back</Button>
              <Button
                onClick={handleSubmit}
                className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Return
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
