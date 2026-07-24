import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { motion } from "framer-motion";
import { SectionCard, StatusBadge, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { ClipboardList, Plus, Send, CheckCircle2, MapPin, Loader2, ExternalLink } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Survey {
  id: number; projectId: number; surveyDate: string | null; surveyedBy: number | null;
  siteAreaSqm: number | null; roofType: string | null; roofCondition: string | null;
  structuralStatus: string | null; shadingAnalysis: string | null;
  gridConnectionType: string | null; gridVoltage: string | null; meterLocation: string | null;
  accessRoad: boolean; latitude: number | null; longitude: number | null;
  proposedCapacityKwp: number | null; panelLayout: string | null; inverterLocation: string | null;
  cableRoute: string | null; earthingStatus: string | null; safetyHazards: string | null;
  attachmentUrls: string[]; status: string; notes: string | null;
  approvedBy: number | null; approvedAt: string | null; createdAt: string; updatedAt: string;
}

const ROOF_TYPES = ["RCC Flat", "Metal Sheet", "Mangalore Tile", "Polycarbonate", "Ground Mount", "Other"];
const ROOF_CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "Requires Repair"];
const STRUCTURAL_STATUSES = ["Suitable", "Suitable with Reinforcement", "Not Suitable", "Assessment Pending"];
const GRID_TYPES = ["LT Overhead", "LT Underground", "HT", "DISCOM Net Meter", "Standalone"];

function SurveyForm({ projectId, survey, onSaved }: {
  projectId: number; survey?: Survey; onSaved: () => void;
}) {
  const { register, handleSubmit, control, setValue } = useForm<any>({
    defaultValues: survey ? {
      surveyDate: survey.surveyDate, siteAreaSqm: survey.siteAreaSqm,
      roofType: survey.roofType, roofCondition: survey.roofCondition,
      structuralStatus: survey.structuralStatus, shadingAnalysis: survey.shadingAnalysis,
      gridConnectionType: survey.gridConnectionType, gridVoltage: survey.gridVoltage,
      meterLocation: survey.meterLocation, accessRoad: survey.accessRoad,
      latitude: survey.latitude, longitude: survey.longitude,
      proposedCapacityKwp: survey.proposedCapacityKwp, panelLayout: survey.panelLayout,
      inverterLocation: survey.inverterLocation, cableRoute: survey.cableRoute,
      earthingStatus: survey.earthingStatus, safetyHazards: survey.safetyHazards, notes: survey.notes,
    } : { accessRoad: true },
  });

  const mut = useMutation({
    mutationFn: (d: any) => survey
      ? apiPatch(`/project-site-surveys/${survey.id}`, d)
      : apiPost(`/projects/${projectId}/site-surveys`, d),
    onSuccess: onSaved,
  });

  const onSubmit = (d: any) => mut.mutate(d);

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
      {children}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Site Details */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Site Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <F label="Survey Date"><Input type="date" className="h-9" {...register("surveyDate")} /></F>
          <F label="Site Area (sqm)"><Input type="number" step="0.01" className="h-9" {...register("siteAreaSqm")} /></F>
          <F label="Access Road">
            <Controller control={control} name="accessRoad" render={({ field }) => (
              <Select value={field.value ? "yes" : "no"} onValueChange={v => field.onChange(v === "yes")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
              </Select>
            )} />
          </F>
          <F label="Latitude"><Input type="number" step="0.000001" className="h-9" {...register("latitude")} /></F>
          <F label="Longitude"><Input type="number" step="0.000001" className="h-9" {...register("longitude")} /></F>
        </div>
      </div>

      <Separator />

      {/* Structural */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Structural Assessment</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <F label="Roof Type">
            <Controller control={control} name="roofType" render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{ROOF_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </F>
          <F label="Roof Condition">
            <Controller control={control} name="roofCondition" render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{ROOF_CONDITIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </F>
          <F label="Structural Status">
            <Controller control={control} name="structuralStatus" render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{STRUCTURAL_STATUSES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </F>
          <div className="sm:col-span-2 lg:col-span-3">
            <F label="Shading Analysis"><Textarea className="h-16 resize-none" {...register("shadingAnalysis")} /></F>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <F label="Safety Hazards"><Textarea className="h-16 resize-none" {...register("safetyHazards")} /></F>
          </div>
        </div>
      </div>

      <Separator />

      {/* Electrical */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Electrical Assessment</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <F label="Grid Connection Type">
            <Controller control={control} name="gridConnectionType" render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{GRID_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </F>
          <F label="Grid Voltage"><Input className="h-9" placeholder="e.g. 415V 3-phase" {...register("gridVoltage")} /></F>
          <F label="Meter Location"><Input className="h-9" {...register("meterLocation")} /></F>
          <F label="Earthing Status"><Input className="h-9" placeholder="e.g. GI Earth Pipe existing" {...register("earthingStatus")} /></F>
        </div>
      </div>

      <Separator />

      {/* Proposed Design */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Proposed Design</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <F label="Proposed Capacity (kWp)"><Input type="number" step="0.001" className="h-9" {...register("proposedCapacityKwp")} /></F>
          <div className="sm:col-span-2">
            <F label="Panel Layout"><Textarea className="h-16 resize-none" {...register("panelLayout")} /></F>
          </div>
          <F label="Inverter Location"><Input className="h-9" {...register("inverterLocation")} /></F>
          <div className="sm:col-span-2">
            <F label="Cable Route"><Textarea className="h-16 resize-none" {...register("cableRoute")} /></F>
          </div>
        </div>
      </div>

      <Separator />

      <F label="Notes"><Textarea className="h-20 resize-none" {...register("notes")} /></F>

      <div className="flex gap-2 justify-end">
        <Button type="submit" disabled={mut.isPending} className="gap-1.5">
          {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {survey ? "Save Changes" : "Create Survey"}
        </Button>
      </div>
    </form>
  );
}

export function ProjectSiteSurvey({ projectId }: { projectId: number }) {
  const { user } = useAuth();
  const role = (user as any)?.role ?? "";
  const canApprove = ["admin", "director"].includes(role);
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

  const { data: surveys = [], isPending } = useQuery<Survey[]>({
    queryKey: ["project-site-surveys", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/site-surveys`),
    enabled: !!projectId,
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => apiPatch(`/project-site-surveys/${id}`, { status: "Approved", approvedAt: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-site-surveys", projectId] }),
  });

  const submitMut = useMutation({
    mutationFn: (id: number) => apiPatch(`/project-site-surveys/${id}`, { status: "Submitted" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-site-surveys", projectId] }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project-site-surveys", projectId] });
    setCreating(false);
  };

  const survey = surveys[0]; // Latest survey

  if (isPending) return <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>;

  if (!survey && !creating) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <EmptyState
          icon={ClipboardList}
          title="No site survey yet"
          description="Record a pre-execution site assessment including structural, electrical, and design details."
          action={{ label: "Start Survey", onClick: () => setCreating(true) }}
        />
      </motion.div>
    );
  }

  if (creating) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <SectionCard title="New Site Survey" actions={
          <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
        }>
          <SurveyForm projectId={projectId} onSaved={invalidate} />
        </SectionCard>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <SectionCard
        title="Site Survey"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={survey.status} size="sm" />
            {survey.status === "Draft" && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                onClick={() => submitMut.mutate(survey.id)} disabled={submitMut.isPending}>
                <Send className="h-3 w-3" /> Submit
              </Button>
            )}
            {survey.status === "Submitted" && canApprove && (
              <Button size="sm" className="h-7 gap-1 text-xs"
                onClick={() => approveMut.mutate(survey.id)} disabled={approveMut.isPending}>
                <CheckCircle2 className="h-3 w-3" /> Approve
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setCreating(true)}>
              <Plus className="h-3 w-3" /> New Survey
            </Button>
          </div>
        }
      >
        {/* Map preview if lat/lng */}
        {survey.latitude && survey.longitude && (
          <a
            href={`https://maps.google.com/?q=${survey.latitude},${survey.longitude}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors"
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span>GPS: {survey.latitude.toFixed(5)}, {survey.longitude.toFixed(5)}</span>
            <ExternalLink className="h-3.5 w-3.5 ml-auto" />
          </a>
        )}
        <SurveyForm projectId={projectId} survey={survey} onSaved={invalidate} />
      </SectionCard>
    </motion.div>
  );
}
