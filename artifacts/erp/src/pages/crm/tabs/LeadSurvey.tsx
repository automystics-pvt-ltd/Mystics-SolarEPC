import { useState } from "react";
import { useGetLeadSurvey, useUpsertLeadSurvey, getGetLeadSurveyQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, Sun, Home, Zap, CheckCircle2, Edit3, Save } from "lucide-react";
import { cn } from "@/lib/utils";

const ROOF_TYPES = ["Flat", "Sloped", "Ground-mount"];
const SHADOW_OPTS = ["None", "Partial", "Heavy"];
const FEASIBILITY_OPTS = ["Pending", "Feasible", "NotFeasible", "ConditionallyFeasible"];

const feasibilityColors: Record<string, string> = {
  Feasible: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NotFeasible: "bg-red-50 text-red-700 border-red-200",
  ConditionallyFeasible: "bg-amber-50 text-amber-700 border-amber-200",
  Pending: "bg-slate-100 text-slate-600 border-slate-200",
};

interface Props { leadId: number; }

export function LeadSurvey({ leadId }: Props) {
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();

  const { data: survey, isPending, isLoading, isError } = useGetLeadSurvey(leadId, {
    query: { queryKey: getGetLeadSurveyQueryKey(leadId), enabled: !!leadId, retry: false }
  });

  const upsertMut = useUpsertLeadSurvey();
  const { register, handleSubmit, setValue, reset } = useForm<any>({
    defaultValues: survey ?? {}
  });

  const onSubmit = (d: any) => {
    const cleaned: any = { ...d };
    if (d.roofArea) cleaned.roofArea = Number(d.roofArea);
    if (d.gpsLat) cleaned.gpsLat = Number(d.gpsLat);
    if (d.gpsLng) cleaned.gpsLng = Number(d.gpsLng);
    if (d.sanctionedLoad) cleaned.sanctionedLoad = Number(d.sanctionedLoad);
    if (d.avgMonthlyBill) cleaned.avgMonthlyBill = Number(d.avgMonthlyBill);
    if (d.proposedCapacity) cleaned.proposedCapacity = Number(d.proposedCapacity);
    upsertMut.mutate({ id: leadId, data: cleaned }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLeadSurveyQueryKey(leadId) });
        setEditing(false);
      }
    });
  };

  const startEdit = () => {
    if (survey) reset(survey);
    setEditing(true);
  };

  if (isPending) return <div className="space-y-3 pt-4">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>;

  if (!survey || isError) {
    return (
      <div className="pt-4">
        <div className="flex flex-col items-center justify-center py-12 gap-4 border-2 border-dashed border-slate-200 rounded-xl">
          <MapPin className="w-10 h-10 text-slate-300" />
          <div className="text-center">
            <p className="text-slate-600 font-medium">No site survey yet</p>
            <p className="text-slate-400 text-sm mt-1">Record roof measurements, GPS location, shadow analysis, and feasibility assessment</p>
          </div>
          <Button size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Edit3 className="w-3.5 h-3.5" /> Start Site Survey
          </Button>
        </div>
        {editing && <SurveyForm register={register} handleSubmit={handleSubmit} onSubmit={onSubmit} setValue={setValue} isPending={upsertMut.isPending} onCancel={() => setEditing(false)} />}
      </div>
    );
  }

  const feasColor = feasibilityColors[survey.feasibilityStatus] ?? feasibilityColors["Pending"];

  return (
    <div className="pt-4 space-y-5">
      {/* Feasibility banner */}
      <div className={cn("flex items-center justify-between px-4 py-3 rounded-xl border", feasColor)}>
        <div className="flex items-center gap-2">
          {survey.feasibilityStatus === "Feasible" && <CheckCircle2 className="w-4 h-4" />}
          <span className="text-sm font-medium">{survey.feasibilityStatus.replace(/([A-Z])/g, ' $1').trim()}</span>
          {survey.feasibilityNotes && <span className="text-xs opacity-80">— {survey.feasibilityNotes}</span>}
        </div>
        {!editing && (
          <Button size="sm" variant="outline" className="h-7 text-xs bg-white/60 border-current/20" onClick={startEdit}>
            <Edit3 className="w-3 h-3 mr-1" /> Edit
          </Button>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Site info */}
          <Card className="premium-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Home className="w-4 h-4 text-slate-400" /> Site Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Roof Type" value={survey.roofType} />
              <Row label="Roof Area" value={survey.roofArea ? `${survey.roofArea} sq ft` : undefined} />
              <Row label="Shadow Analysis" value={survey.shadowAnalysis} />
              <Row label="Survey Date" value={survey.surveyDate} />
              {(survey.gpsLat && survey.gpsLng) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">GPS</span>
                  <a href={`https://maps.google.com/?q=${survey.gpsLat},${survey.gpsLng}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 font-medium flex items-center gap-1 text-xs hover:underline">
                    <MapPin className="w-3 h-3" /> {survey.gpsLat?.toFixed(4)}, {survey.gpsLng?.toFixed(4)}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Electrical info */}
          <Card className="premium-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-slate-400" /> Electrical & System</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Sanctioned Load" value={survey.sanctionedLoad ? `${survey.sanctionedLoad} kW` : undefined} />
              <Row label="Avg Monthly Bill" value={survey.avgMonthlyBill ? `₹${Number(survey.avgMonthlyBill).toLocaleString("en-IN")}` : undefined} />
              <Row label="Proposed Capacity" value={survey.proposedCapacity ? `${survey.proposedCapacity} kWp` : undefined} />
            </CardContent>
          </Card>

          {/* Notes */}
          {survey.structuralNotes && (
            <Card className="premium-card md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Structural Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600">{survey.structuralNotes}</p></CardContent>
            </Card>
          )}

          {/* Photos */}
          {survey.photos && survey.photos.length > 0 && (
            <Card className="premium-card md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Site Photos</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {survey.photos.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline bg-slate-100 px-2 py-1 rounded">Photo {i + 1}</a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <SurveyForm register={register} handleSubmit={handleSubmit} onSubmit={onSubmit} setValue={setValue} isPending={upsertMut.isPending} onCancel={() => setEditing(false)} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value ?? <span className="text-slate-300 font-normal">—</span>}</span>
    </div>
  );
}

function SurveyForm({ register, handleSubmit, onSubmit, setValue, isPending, onCancel }: any) {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-5 bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-800">Site Survey Details</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><Label>Survey Date</Label><Input {...register("surveyDate")} type="date" className="mt-1" /></div>
        <div>
          <Label>Roof Type</Label>
          <Select onValueChange={v => setValue("roofType", v)} defaultValue="Flat">
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{ROOF_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Roof Area (sq ft)</Label><Input {...register("roofArea")} type="number" placeholder="e.g. 2400" className="mt-1" /></div>
        <div>
          <Label>Shadow Analysis</Label>
          <Select onValueChange={v => setValue("shadowAnalysis", v)} defaultValue="None">
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{SHADOW_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>GPS Latitude</Label><Input {...register("gpsLat")} type="number" step="any" placeholder="e.g. 28.6139" className="mt-1" /></div>
        <div><Label>GPS Longitude</Label><Input {...register("gpsLng")} type="number" step="any" placeholder="e.g. 77.2090" className="mt-1" /></div>
        <div><Label>Sanctioned Load (kW)</Label><Input {...register("sanctionedLoad")} type="number" step="any" placeholder="e.g. 50" className="mt-1" /></div>
        <div><Label>Avg Monthly Bill (₹)</Label><Input {...register("avgMonthlyBill")} type="number" placeholder="e.g. 45000" className="mt-1" /></div>
        <div><Label>Proposed Capacity (kWp)</Label><Input {...register("proposedCapacity")} type="number" step="any" placeholder="e.g. 100" className="mt-1" /></div>
        <div>
          <Label>Feasibility Status</Label>
          <Select onValueChange={v => setValue("feasibilityStatus", v)} defaultValue="Pending">
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{FEASIBILITY_OPTS.map(o => <SelectItem key={o} value={o}>{o.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Structural Notes</Label><Textarea {...register("structuralNotes")} placeholder="Roof condition, load-bearing observations, shading structures..." className="mt-1 min-h-[80px]" /></div>
      <div><Label>Feasibility Notes</Label><Textarea {...register("feasibilityNotes")} placeholder="Summary of feasibility assessment..." className="mt-1" /></div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending} className="gap-1.5">
          <Save className="w-3.5 h-3.5" />{isPending ? "Saving…" : "Save Survey"}
        </Button>
      </div>
    </form>
  );
}
