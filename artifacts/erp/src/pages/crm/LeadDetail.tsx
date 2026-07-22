import { useGetLead, useUpdateLead, useAssignLead, useGetQuotations } from "@workspace/api-client-react";
import { getGetLeadQueryKey, getGetQuotationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Building, Mail, Phone, MapPin, UserSquare2, Edit, Save, X, PlusCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export function LeadDetail({ id }: { id: string }) {
  const leadId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: lead, isLoading } = useGetLead(leadId, { 
    query: { enabled: !!leadId, queryKey: getGetLeadQueryKey(leadId) } 
  });
  
  const { data: quotations } = useGetQuotations(
    { leadId },
    { query: { enabled: !!leadId, queryKey: getGetQuotationsQueryKey({ leadId }) } }
  );

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        setIsEditing(false);
        toast({ title: "Lead updated successfully" });
      }
    }
  });

  const assignMutation = useAssignLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        toast({ title: "Lead assigned successfully" });
      }
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    if (lead && !isEditing) {
      setEditForm({
        companyName: lead.companyName || "",
        contactName: lead.contactName || "",
        contactEmail: lead.contactEmail || "",
        contactPhone: lead.contactPhone || "",
        status: lead.status || "New",
        estimatedValue: lead.estimatedValue || 0,
      });
    }
  }, [lead, isEditing]);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!lead) return <div>Lead not found</div>;

  const handleSave = () => {
    updateMutation.mutate({
      id: leadId,
      data: {
        ...editForm,
        estimatedValue: Number(editForm.estimatedValue)
      }
    });
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/crm/leads")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">{lead.companyName || 'Unknown Company'}</h2>
              <Badge variant={lead.status === 'Closed Won' ? 'default' : 'secondary'} className="text-xs uppercase tracking-wider">
                {lead.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <UserSquare2 className="h-4 w-4" /> {lead.contactName} 
              <span className="text-border">•</span> 
              Lead ID: {lead.id}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={updateMutation.isPending}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" /> Edit Lead
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Details */}
        <div className="space-y-6 md:col-span-1">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Company</p>
                  {isEditing ? (
                    <Input 
                      value={editForm.companyName} 
                      onChange={e => setEditForm({...editForm, companyName: e.target.value})} 
                      className="mt-1 h-8"
                    />
                  ) : (
                    <p className="text-sm font-medium">{lead.companyName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <UserSquare2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Contact</p>
                  {isEditing ? (
                    <Input 
                      value={editForm.contactName} 
                      onChange={e => setEditForm({...editForm, contactName: e.target.value})} 
                      className="mt-1 h-8"
                    />
                  ) : (
                    <p className="text-sm font-medium">{lead.contactName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  {isEditing ? (
                    <Input 
                      value={editForm.contactEmail} 
                      onChange={e => setEditForm({...editForm, contactEmail: e.target.value})} 
                      className="mt-1 h-8"
                    />
                  ) : (
                    <a href={`mailto:${lead.contactEmail}`} className="text-sm text-primary hover:underline">{lead.contactEmail || '-'}</a>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  {isEditing ? (
                    <Input 
                      value={editForm.contactPhone} 
                      onChange={e => setEditForm({...editForm, contactPhone: e.target.value})} 
                      className="mt-1 h-8"
                    />
                  ) : (
                    <p className="text-sm font-medium">{lead.contactPhone || '-'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Lead Qualification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                {isEditing ? (
                  <Select value={editForm.status} onValueChange={val => setEditForm({...editForm, status: val})}>
                    <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Contacted">Contacted</SelectItem>
                      <SelectItem value="Qualified">Qualified</SelectItem>
                      <SelectItem value="Proposal">Proposal</SelectItem>
                      <SelectItem value="Negotiation">Negotiation</SelectItem>
                      <SelectItem value="Closed Won">Closed Won</SelectItem>
                      <SelectItem value="Closed Lost">Closed Lost</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium mt-1">{lead.status}</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Estimated Value</p>
                {isEditing ? (
                  <Input 
                    type="number"
                    value={editForm.estimatedValue} 
                    onChange={e => setEditForm({...editForm, estimatedValue: e.target.value})} 
                    className="mt-1 h-8"
                  />
                ) : (
                  <p className="text-lg font-bold text-foreground mt-1">
                    ${lead.estimatedValue?.toLocaleString() || 0}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Lead Score</p>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${lead.score && lead.score > 70 ? 'bg-emerald-500' : lead.score && lead.score > 40 ? 'bg-accent' : 'bg-muted-foreground'}`} 
                      style={{ width: `${Math.min(100, lead.score || 0)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold font-mono">{lead.score || 0}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Owner</p>
                <p className="text-sm font-medium mt-1">{lead.ownerName || 'Unassigned'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tabs */}
        <div className="md:col-span-2 space-y-6">
          <Tabs defaultValue="quotations" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
              <TabsTrigger value="quotations" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                Quotations
              </TabsTrigger>
              <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                Notes
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="quotations" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Related Quotations</h3>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setLocation(`/crm/quotations/new?leadId=${lead.id}`)}>
                  <PlusCircle className="h-4 w-4" /> Create Quotation
                </Button>
              </div>
              
              <div className="space-y-4">
                {quotations?.length === 0 ? (
                  <Card className="border-dashed shadow-none bg-muted/20">
                    <CardContent className="flex flex-col items-center justify-center h-40 text-center">
                      <p className="text-sm text-muted-foreground">No quotations generated yet.</p>
                      <Button variant="link" onClick={() => setLocation(`/crm/quotations/new?leadId=${lead.id}`)}>
                        Create the first one
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  quotations?.map(quote => (
                    <Card key={quote.id} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation(`/crm/quotations/${quote.id}`)}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">QTN-{quote.id.toString().padStart(4, '0')}</span>
                            <Badge variant={quote.approvalStatus === 'Approved' ? 'default' : 'secondary'} className="text-[10px]">
                              {quote.approvalStatus}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Version {quote.version} • {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${quote.totalAmount?.toLocaleString() || 0}</p>
                          <p className="text-xs text-muted-foreground">Valid till {quote.validTill ? format(new Date(quote.validTill), 'MMM d') : '-'}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="notes" className="mt-6">
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {isEditing ? (
                      <textarea 
                        className="w-full min-h-[200px] p-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={editForm.notes || ""}
                        onChange={e => setEditForm({...editForm, notes: e.target.value})}
                        placeholder="Add notes about this lead..."
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground min-h-[100px]">
                        {lead.notes || <span className="text-muted-foreground italic">No notes added.</span>}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
