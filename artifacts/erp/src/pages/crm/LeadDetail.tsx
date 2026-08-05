import { useGetLead, useUpdateLead, useGetQuotations } from "@workspace/api-client-react";
import {
  getGetLeadQueryKey, getGetLeadsQueryKey, getGetLeadsPipelineSummaryQueryKey,
  getGetQuotationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadSurvey } from "./tabs/LeadSurvey";
import { Loader2, ArrowLeft, Mail, Phone, UserSquare2, Edit2, Save, Plus, FileText, StickyNote, Clock, TrendingUp, FolderOpen, Layers } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { StatusBadge, DetailRow, DetailGrid, SectionCard, PageHeader } from "@/components/shared";
import { apiGet } from "@/lib/fetch";
import { usePermissions } from "@/lib/permissions";

function formatDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(d));
  } catch {
    return d;
  }
}

export function LeadDetail({ id }: { id: string }) {
  const leadId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: lead, isPending } = useGetLead(leadId, {
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
        queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadsPipelineSummaryQueryKey() });
        setIsEditing(false);
        toast({ title: "Lead updated successfully" });
      },
      onError: (e: any) => toast({ variant: "destructive", title: "Failed to update lead", description: e?.message }),
    }
  });

  const { data: linkedProjects = [] } = useQuery<any[]>({
    queryKey: ["lead-projects", leadId],
    queryFn: () => apiGet<any[]>(`/leads/${leadId}/projects`),
    enabled: !!leadId,
  });

  const { user } = useAuth();
  const { canEdit: isAdmin } = usePermissions("crm");

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    if (lead && !isEditing) {
      setEditForm({
        companyName:    lead.companyName    || "",
        contactName:    lead.contactName    || "",
        contactEmail:   lead.contactEmail   || "",
        contactPhone:   lead.contactPhone   || "",
        status:         lead.status         || "New",
        estimatedValue: lead.estimatedValue || 0,
        notes:          lead.notes          || "",
      });
    }
  }, [lead, isEditing]);

  if (isPending) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!lead) return <div>Lead not found</div>;

  const handleSave = () => {
    updateMutation.mutate({
      id: leadId,
      data: { ...editForm, estimatedValue: Number(editForm.estimatedValue) }
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="space-y-5 pb-10">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title={lead.companyName || "Unknown Company"}
        subtitle={lead.contactName ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation("/crm/leads")} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={updateMutation.isPending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="bg-foreground hover:bg-foreground/90 text-background gap-1.5">
                  {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Changes
                </Button>
              </>
            ) : isAdmin ? (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="gap-1.5">
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
            ) : null}
          </div>
        }
      />

      {/* ── Status Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-3 px-5 py-3 rounded-xl border bg-card">
        <StatusBadge status={lead.status} size="md" />
        <div className="h-4 w-px bg-border/60" />
        <span className="text-[12px] text-muted-foreground">Lead ID:</span>
        <span className="font-mono text-[12px] font-semibold text-foreground">LD-{lead.id.toString().padStart(4, "0")}</span>
        {lead.ownerName && (
          <>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[12px] text-muted-foreground">Assigned to:</span>
            <span className="text-[12px] font-semibold text-foreground">{lead.ownerName}</span>
          </>
        )}
        {lead.createdAt && (
          <>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[12px] text-muted-foreground">Created:</span>
            <span className="text-[12px] text-foreground">{formatDate(lead.createdAt as string)}</span>
          </>
        )}
        {lead.estimatedValue ? (
          <>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[12px] text-muted-foreground">Est. Value:</span>
            <span className="text-[12px] font-bold text-foreground font-mono">₹{Number(lead.estimatedValue).toLocaleString("en-IN")}</span>
          </>
        ) : null}
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* LEFT: 2/3 */}
        <div className="space-y-5 lg:col-span-2">

          {/* Lead Information */}
          <SectionCard title="Lead Information">
            <DetailGrid cols={2}>
              <DetailRow
                label="Company"
                value={isEditing ? (
                  <Input value={editForm.companyName} onChange={e => setEditForm({...editForm, companyName: e.target.value})} className="h-8 text-sm mt-1" />
                ) : lead.companyName}
              />
              <DetailRow
                label="Contact Person"
                value={isEditing ? (
                  <Input value={editForm.contactName} onChange={e => setEditForm({...editForm, contactName: e.target.value})} className="h-8 text-sm mt-1" />
                ) : lead.contactName}
              />
              <DetailRow
                label="Email"
                value={isEditing ? (
                  <Input value={editForm.contactEmail} onChange={e => setEditForm({...editForm, contactEmail: e.target.value})} className="h-8 text-sm mt-1" />
                ) : (
                  lead.contactEmail ? (
                    <a href={`mailto:${lead.contactEmail}`} className="text-[13px] font-semibold text-primary hover:underline flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {lead.contactEmail}
                    </a>
                  ) : undefined
                )}
              />
              <DetailRow
                label="Phone"
                value={isEditing ? (
                  <Input value={editForm.contactPhone} onChange={e => setEditForm({...editForm, contactPhone: e.target.value})} className="h-8 text-sm mt-1" />
                ) : (
                  lead.contactPhone ? (
                    <span className="flex items-center gap-1 text-[13px] font-semibold text-foreground">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {lead.contactPhone}
                    </span>
                  ) : undefined
                )}
              />
              <DetailRow
                label="Status / Stage"
                value={isEditing ? (
                  <Select value={editForm.status} onValueChange={val => setEditForm({...editForm, status: val})}>
                    <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
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
                ) : <StatusBadge status={lead.status} />}
              />
              <DetailRow
                label="Estimated Value"
                value={isEditing ? (
                  <Input type="number" value={editForm.estimatedValue} onChange={e => setEditForm({...editForm, estimatedValue: e.target.value})} className="h-8 text-sm font-mono mt-1" />
                ) : (
                  <span className="text-[18px] font-bold font-mono text-foreground">
                    ₹{Number(lead.estimatedValue || 0).toLocaleString("en-IN")}
                  </span>
                )}
              />
              <DetailRow label="Assigned Owner" value={lead.ownerName || "Unassigned"} />
              {(lead as any).source && <DetailRow label="Source" value={(lead as any).source} />}
              {(lead as any).category && <DetailRow label="Category" value={(lead as any).category} />}
            </DetailGrid>

            {/* Lead Score */}
            {(lead.score !== undefined && lead.score !== null) && (
              <div className="mt-5 pt-5 border-t border-border/60">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Lead Score
                  </p>
                  <span className="text-sm font-bold font-mono text-foreground">{lead.score}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      lead.score > 70 ? "bg-emerald-500" : lead.score > 40 ? "bg-amber-500" : "bg-muted-foreground/40"
                    )}
                    style={{ width: `${Math.min(100, lead.score || 0)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            {(lead.notes || isEditing) && (
              <div className="mt-5 pt-5 border-t border-border/60">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                {isEditing ? (
                  <textarea
                    className="w-full min-h-[120px] p-3 rounded-lg border border-border bg-muted/20 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-all resize-none"
                    value={editForm.notes || ""}
                    onChange={e => setEditForm({...editForm, notes: e.target.value})}
                    placeholder="Add background notes, meeting summaries, next steps..."
                  />
                ) : (
                  <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
                    {lead.notes || <span className="text-muted-foreground italic">No notes recorded.</span>}
                  </p>
                )}
              </div>
            )}
          </SectionCard>

          {/* Quotations / Survey (tabbed) */}
          <SectionCard noPadding>
            <Tabs defaultValue="quotations">
              <div className="border-b border-border px-2 pt-2 bg-muted/20">
                <TabsList className="bg-transparent h-11 p-0 gap-5 px-4">
                  <TabsTrigger
                    value="quotations"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-11 text-[13px] font-bold text-muted-foreground data-[state=active]:text-foreground transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Quotations
                  </TabsTrigger>
                  <TabsTrigger
                    value="survey"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-11 text-[13px] font-bold text-muted-foreground data-[state=active]:text-foreground transition-colors"
                  >
                    <StickyNote className="h-3.5 w-3.5 mr-1.5" /> Site Survey
                  </TabsTrigger>
                  <TabsTrigger
                    value="projects"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-11 text-[13px] font-bold text-muted-foreground data-[state=active]:text-foreground transition-colors"
                  >
                    <Layers className="h-3.5 w-3.5 mr-1.5" /> Projects
                    {linkedProjects.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        {linkedProjects.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="quotations" className="p-5 m-0 outline-none">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[13px] font-bold text-foreground">Active Proposals</h3>
                  <Button size="sm" variant="outline" className="h-8 text-[12px] gap-1.5" onClick={() => setLocation(`/crm/quotations/new?leadId=${lead.id}`)}>
                    <Plus className="h-3.5 w-3.5" /> Create
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {quotations?.length === 0 ? (
                    <div className="border-2 border-dashed border-border rounded-xl h-44 flex flex-col items-center justify-center text-center p-6">
                      <FileText className="h-7 w-7 text-muted-foreground/40 mb-2.5" />
                      <p className="text-sm font-semibold text-muted-foreground">No quotations yet</p>
                      <Button variant="link" className="text-primary font-semibold mt-1 h-auto p-0" onClick={() => setLocation(`/crm/quotations/new?leadId=${lead.id}`)}>
                        Create the first proposal
                      </Button>
                    </div>
                  ) : (
                    quotations?.map(quote => (
                      <div
                        key={quote.id}
                        onClick={() => setLocation(`/crm/quotations/${quote.id}`)}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:border-primary/40 bg-card hover:bg-primary/5 transition-all cursor-pointer"
                      >
                        <div className="mb-2 sm:mb-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <span className="font-mono font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                              QTN-{quote.id.toString().padStart(4, "0")}
                            </span>
                            <StatusBadge status={quote.approvalStatus} />
                          </div>
                          <p className="text-[11px] font-medium text-muted-foreground">
                            Version {quote.version} · Created {format(new Date(quote.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="sm:text-right flex sm:block items-end justify-between w-full sm:w-auto pt-2 border-t border-border sm:border-0 sm:pt-0">
                          <p className="text-base font-bold text-foreground font-mono">₹{Number(quote.totalAmount || 0).toLocaleString("en-IN")}</p>
                          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                            Valid till {quote.validTill ? format(new Date(quote.validTill), "MMM d") : "—"}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="survey" className="p-5 m-0 outline-none">
                <LeadSurvey leadId={lead.id} />
              </TabsContent>

              <TabsContent value="projects" className="p-5 m-0 outline-none">
                {linkedProjects.length === 0 ? (
                  <div className="border-2 border-dashed border-border rounded-xl h-44 flex flex-col items-center justify-center text-center p-6">
                    <Layers className="h-7 w-7 text-muted-foreground/40 mb-2.5" />
                    <p className="text-sm font-semibold text-muted-foreground">No linked projects yet</p>
                    <p className="text-[12px] text-muted-foreground mt-1">Projects appear here once a quotation is approved and converted.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {linkedProjects.map((proj: any) => (
                      <div
                        key={proj.id}
                        onClick={() => setLocation(`/projects/${proj.id}`)}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:border-primary/40 bg-card hover:bg-primary/5 transition-all cursor-pointer"
                      >
                        <div className="mb-2 sm:mb-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                            <span className="font-mono font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                              PRJ-{String(proj.id).padStart(4, "0")}
                            </span>
                            <StatusBadge status={proj.status} />
                          </div>
                          <p className="text-[13px] font-medium text-foreground ml-6">{proj.name}</p>
                        </div>
                        <div className="sm:text-right flex sm:block items-end justify-between w-full sm:w-auto pt-2 border-t border-border sm:border-0 sm:pt-0">
                          {proj.contractValue && (
                            <p className="text-base font-bold text-foreground font-mono">
                              ₹{Number(proj.contractValue).toLocaleString("en-IN")}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5 sm:justify-end">
                            <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${proj.percentComplete ?? 0}%` }} />
                            </div>
                            <span className="text-[11px] text-muted-foreground">{proj.percentComplete ?? 0}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </SectionCard>
        </div>

        {/* RIGHT: 1/3 */}
        <div className="space-y-5">

          {/* Quick Actions */}
          <SectionCard title="Quick Actions">
            <div className="space-y-2">
              <Button
                className="w-full justify-start gap-2 text-[13px] bg-primary text-primary-foreground hover:bg-primary/90"
                size="sm"
                onClick={() => setLocation(`/crm/quotations/new?leadId=${lead.id}`)}
              >
                <FileText className="w-3.5 h-3.5" /> Create Quotation
              </Button>
              {isAdmin && !isEditing && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-[13px]"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Lead Details
                </Button>
              )}
              {lead.contactEmail && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-[13px]"
                  size="sm"
                  asChild
                >
                  <a href={`mailto:${lead.contactEmail}`}>
                    <Mail className="w-3.5 h-3.5" /> Email Contact
                  </a>
                </Button>
              )}
              {lead.contactPhone && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-[13px]"
                  size="sm"
                  asChild
                >
                  <a href={`tel:${lead.contactPhone}`}>
                    <Phone className="w-3.5 h-3.5" /> Call Contact
                  </a>
                </Button>
              )}
            </div>
          </SectionCard>

          {/* Activity Timeline */}
          {((lead as any).activityLog ?? []).length > 0 && (
            <SectionCard title="Activity">
              <div className="space-y-3">
                {((lead as any).activityLog as any[]).map((log: any, idx: number) => (
                  <div key={log.id ?? idx} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center shrink-0">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                      </div>
                      {idx < ((lead as any).activityLog as any[]).length - 1 && (
                        <div className="w-px flex-1 bg-border/60 mt-1" />
                      )}
                    </div>
                    <div className="pb-3 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground leading-snug">{log.action ?? log.event}</p>
                      {log.note && <p className="text-[11px] text-muted-foreground mt-0.5">{log.note}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString("en-IN") : ""}
                        {log.performedByName ? ` · ${log.performedByName}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Lead Meta */}
          <SectionCard title="Lead Details">
            <div className="space-y-3">
              <DetailRow label="Lead ID" value={`LD-${lead.id.toString().padStart(4, "0")}`} mono />
              <DetailRow label="Created" value={formatDate((lead as any).createdAt)} />
              {(lead as any).updatedAt && <DetailRow label="Last Updated" value={formatDate((lead as any).updatedAt)} />}
              {(lead as any).source && <DetailRow label="Source" value={(lead as any).source} />}
              {(lead as any).category && <DetailRow label="Category" value={(lead as any).category} />}
            </div>
          </SectionCard>
        </div>
      </div>
    </motion.div>
  );
}
