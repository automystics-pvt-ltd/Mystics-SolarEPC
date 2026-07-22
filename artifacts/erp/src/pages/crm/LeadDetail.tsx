import { useGetLead, useUpdateLead, useAssignLead, useGetQuotations } from "@workspace/api-client-react";
import { getGetLeadQueryKey, getGetQuotationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadSurvey } from "./tabs/LeadSurvey";
import { Loader2, ArrowLeft, Building2, Mail, Phone, UserSquare2, Edit2, Save, X, Plus, FileText, StickyNote, Building } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";

function getStatusColor(status: string) {
  switch (status) {
    case 'Closed Won': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Closed Lost': return 'bg-red-100 text-red-800 border-red-200';
    case 'New': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Proposal':
    case 'Negotiation': return 'bg-amber-100 text-amber-800 border-amber-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

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
        notes: lead.notes || "",
      });
    }
  }, [lead, isEditing]);

  if (isLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[12px] premium-shadow border border-gray-100">
        <div className="flex items-center gap-5">
          <Button variant="outline" size="icon" onClick={() => setLocation("/crm/leads")} className="h-10 w-10 rounded-[8px] border-gray-200 text-gray-500 hover:text-gray-900 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">{lead.companyName || 'Unknown Company'}</h1>
              <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wide border px-2 py-0.5 rounded-[4px] ${getStatusColor(lead.status)}`}>
                {lead.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
              <span className="flex items-center gap-1.5"><UserSquare2 className="h-4 w-4" /> {lead.contactName}</span>
              <span className="text-gray-300">•</span>
              <span className="font-mono text-xs text-gray-400">ID: LD-{lead.id.toString().padStart(4, '0')}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={updateMutation.isPending} className="h-10 text-gray-500 font-bold">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending} className="h-10 bg-gray-900 hover:bg-black text-white font-bold rounded-[8px] px-6">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto h-10 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold rounded-[8px] shadow-sm">
              <Edit2 className="h-4 w-4 mr-2" /> Edit Details
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Left Column: Details */}
        <div className="space-y-6 lg:col-span-1">
          
          <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Contact Info</h3>
            </div>
            <div className="p-5 space-y-5">
              <InfoRow 
                icon={Building} label="Company" 
                value={lead.companyName} editValue={editForm.companyName} 
                isEditing={isEditing} onChange={(v: string) => setEditForm({...editForm, companyName: v})} 
              />
              <InfoRow 
                icon={UserSquare2} label="Contact Person" 
                value={lead.contactName} editValue={editForm.contactName} 
                isEditing={isEditing} onChange={(v: string) => setEditForm({...editForm, contactName: v})} 
              />
              <InfoRow 
                icon={Mail} label="Email Address" 
                value={lead.contactEmail} editValue={editForm.contactEmail} 
                isEditing={isEditing} onChange={(v: string) => setEditForm({...editForm, contactEmail: v})} 
                isLink
              />
              <InfoRow 
                icon={Phone} label="Phone Number" 
                value={lead.contactPhone} editValue={editForm.contactPhone} 
                isEditing={isEditing} onChange={(v: string) => setEditForm({...editForm, contactPhone: v})} 
              />
            </div>
          </div>

          <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Qualification</h3>
            </div>
            <div className="p-5 space-y-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Stage / Status</p>
                {isEditing ? (
                  <Select value={editForm.status} onValueChange={val => setEditForm({...editForm, status: val})}>
                    <SelectTrigger className="h-10 bg-gray-50 font-semibold text-sm rounded-[8px]"><SelectValue /></SelectTrigger>
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
                  <Badge variant="outline" className={`font-bold text-[11px] uppercase tracking-wide border px-2 py-0.5 rounded-[4px] ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </Badge>
                )}
              </div>
              
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Estimated Value</p>
                {isEditing ? (
                  <Input type="number" value={editForm.estimatedValue} onChange={e => setEditForm({...editForm, estimatedValue: e.target.value})} className="h-10 bg-gray-50 font-mono font-bold" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900 tracking-tight font-mono">
                    ₹{Number(lead.estimatedValue || 0).toLocaleString("en-IN")}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Lead Score</p>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${lead.score && lead.score > 70 ? 'bg-emerald-500' : lead.score && lead.score > 40 ? 'bg-amber-500' : 'bg-gray-400'}`} 
                      style={{ width: `${Math.min(100, lead.score || 0)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold font-mono text-gray-700">{lead.score || 0}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Assigned Owner</p>
                <p className="text-sm font-semibold text-gray-900">{lead.ownerName || 'Unassigned'}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Tabs */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 h-full flex flex-col overflow-hidden">
            <Tabs defaultValue="quotations" className="flex-1 flex flex-col">
              <div className="border-b border-gray-100 px-2 pt-2 bg-gray-50/30">
                <TabsList className="bg-transparent h-12 p-0 gap-6 px-4">
                  <TabsTrigger value="quotations" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-0 h-12 text-sm font-bold text-gray-500 data-[state=active]:text-gray-900 transition-colors">
                    <FileText className="h-4 w-4 mr-2" /> Quotations
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-0 h-12 text-sm font-bold text-gray-500 data-[state=active]:text-gray-900 transition-colors">
                    <StickyNote className="h-4 w-4 mr-2" /> Notes
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="quotations" className="p-6 m-0 flex-1 outline-none">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-base font-bold text-gray-900 tracking-tight">Active Proposals</h3>
                  <Button size="sm" className="bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-[6px] h-8 shadow-none" onClick={() => setLocation(`/crm/quotations/new?leadId=${lead.id}`)}>
                    <Plus className="h-4 w-4 mr-1.5" /> Create
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {quotations?.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-200 rounded-[12px] h-48 flex flex-col items-center justify-center text-center p-6 bg-gray-50/50">
                      <FileText className="h-8 w-8 text-gray-300 mb-3" />
                      <p className="text-sm font-bold text-gray-600">No quotations generated yet</p>
                      <Button variant="link" className="text-[#EA580C] font-semibold mt-1" onClick={() => setLocation(`/crm/quotations/new?leadId=${lead.id}`)}>
                        Create the first proposal
                      </Button>
                    </div>
                  ) : (
                    quotations?.map(quote => (
                      <div key={quote.id} 
                        onClick={() => setLocation(`/crm/quotations/${quote.id}`)}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[8px] border border-gray-200 hover:border-orange-200 bg-white hover:bg-orange-50/30 transition-all cursor-pointer shadow-sm hover:shadow-md"
                      >
                        <div className="mb-3 sm:mb-0">
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="font-mono font-bold text-gray-900 text-sm group-hover:text-[#EA580C] transition-colors">QTN-{quote.id.toString().padStart(4, '0')}</span>
                            <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider rounded-[4px] border ${quote.approvalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {quote.approvalStatus}
                            </Badge>
                          </div>
                          <p className="text-xs font-medium text-gray-500">
                            Version {quote.version} • Created {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="sm:text-right flex sm:block items-end justify-between w-full sm:w-auto pt-3 border-t border-gray-100 sm:border-0 sm:pt-0">
                          <p className="text-lg font-bold text-gray-900 font-mono">₹{Number(quote.totalAmount || 0).toLocaleString("en-IN")}</p>
                          <p className="text-[11px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">Valid till {quote.validTill ? format(new Date(quote.validTill), 'MMM d') : '-'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="notes" className="p-6 m-0 flex-1 outline-none flex flex-col">
                {isEditing ? (
                  <textarea 
                    className="w-full flex-1 min-h-[300px] p-4 rounded-[8px] border border-gray-200 bg-gray-50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/20 focus-visible:border-[#EA580C] transition-all resize-none"
                    value={editForm.notes || ""}
                    onChange={e => setEditForm({...editForm, notes: e.target.value})}
                    placeholder="Add background notes, meeting summaries, next steps..."
                  />
                ) : (
                  <div className="flex-1 min-h-[300px] p-5 rounded-[8px] border border-gray-100 bg-gray-50/50 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 shadow-inner">
                    {lead.notes || <span className="text-gray-400 italic font-medium">No notes recorded. Click edit to add context.</span>}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="survey" className="p-6 m-0 flex-1 outline-none">
                <LeadSurvey leadId={lead.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function InfoRow({ icon: Icon, label, value, editValue, isEditing, onChange, isLink }: any) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-0.5 p-2 bg-gray-50 rounded-md text-gray-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        {isEditing ? (
          <Input 
            value={editValue} 
            onChange={e => onChange(e.target.value)} 
            className="h-9 bg-gray-50 text-sm font-semibold rounded-[6px]"
          />
        ) : (
          isLink && value ? (
            <a href={`mailto:${value}`} className="text-sm font-bold text-[#EA580C] hover:underline truncate block">{value}</a>
          ) : (
            <p className="text-sm font-bold text-gray-900 truncate">{value || '-'}</p>
          )
        )}
      </div>
    </div>
  );
}
