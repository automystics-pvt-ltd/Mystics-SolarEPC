import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { apiPut } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Bell, Save, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Template = {
  type: string; subject: string; body: string; enabled: boolean; updated_at: string;
};

function TemplateCard({ tpl, onSave, saving }: {
  tpl: Template;
  onSave: (t: Template) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [enabled, setEnabled] = useState(tpl.enabled);
  const dirty = subject !== tpl.subject || body !== tpl.body || enabled !== tpl.enabled;

  return (
    <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Bell className="w-4 h-4 text-violet-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-mono font-medium text-zinc-200">{tpl.type}</p>
            {!tpl.enabled && <Badge className="bg-zinc-800 text-zinc-500 text-[10px] px-1.5">disabled</Badge>}
          </div>
          <p className="text-xs text-zinc-500 truncate">{tpl.subject || "No subject"}</p>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <Switch
            checked={enabled}
            onCheckedChange={v => { setEnabled(v); }}
            className="data-[state=checked]:bg-violet-600"
          />
          {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Subject</label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject…"
              className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Body — use {"{{variable}}"} for placeholders</label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={6}
              className="text-xs bg-zinc-800 border-zinc-700 text-zinc-200 font-mono resize-none"
            />
          </div>
          {dirty && (
            <Button
              size="sm"
              disabled={saving}
              onClick={() => onSave({ ...tpl, subject, body, enabled })}
              className="h-7 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs"
            >
              <Save className="w-3 h-3" />
              Save Template
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export function AdminNotifTemplates() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["pa-notif-templates"],
    queryFn: () => apiGet<Template[]>("/platform-admin/notification-templates"),
  });

  const save = useMutation({
    mutationFn: (t: Template) =>
      apiPut(`/platform-admin/notification-templates/${t.type}`, {
        subject: t.subject, body: t.body, enabled: t.enabled,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pa-notif-templates"] }); toast({ title: "Template saved" }); },
    onError: () => toast({ title: "Failed to save template", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Notification Templates</h2>
        <p className="text-xs text-zinc-500">Configure outbound email and alert messages</p>
      </div>

      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-zinc-900 border-zinc-800 p-4">
                <Skeleton className="h-4 w-32 bg-zinc-800 mb-1.5" />
                <Skeleton className="h-3 w-64 bg-zinc-800" />
              </Card>
            ))
          : templates.map(t => (
              <TemplateCard
                key={t.type}
                tpl={t}
                saving={save.isPending}
                onSave={save.mutate}
              />
            ))}
      </div>
    </div>
  );
}
