import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetch";
import { apiPut } from "@/lib/fetch";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Save, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Setting = { key: string; value: any; description: string; updated_at: string };

const BOOL_KEYS = new Set(["mfa_required", "maintenance_mode"]);
const NUM_KEYS  = new Set(["session_timeout", "max_login_attempts", "smtp_port"]);

function SettingRow({ setting, onSave, saving }: {
  setting: Setting;
  onSave: (key: string, value: any) => void;
  saving: boolean;
}) {
  const [val, setVal] = useState<any>(setting.value);
  useEffect(() => { setVal(setting.value); }, [setting.value]);

  const isBool = BOOL_KEYS.has(setting.key);
  const isNum  = NUM_KEYS.has(setting.key);
  const dirty  = val !== setting.value;

  return (
    <div className="flex items-center gap-4 py-3 border-b border-zinc-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-medium text-zinc-200">{setting.key}</p>
        <p className="text-[11px] text-zinc-500 truncate">{setting.description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isBool ? (
          <Switch
            checked={Boolean(val)}
            onCheckedChange={v => { setVal(v); onSave(setting.key, v); }}
            className="data-[state=checked]:bg-violet-600"
          />
        ) : (
          <>
            <Input
              value={String(val ?? "")}
              type={isNum ? "number" : "text"}
              onChange={e => setVal(isNum ? Number(e.target.value) : e.target.value.replace(/^"|"$/g, ""))}
              className="w-52 h-7 text-xs bg-zinc-800 border-zinc-700 text-zinc-200"
            />
            {dirty && (
              <Button
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => onSave(setting.key, val)}
                className="h-7 px-2 text-violet-400 hover:text-violet-200 hover:bg-violet-900/30"
              >
                <Save className="w-3.5 h-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function AdminSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["pa-settings"],
    queryFn: () => apiGet<Setting[]>("/platform-admin/settings"),
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) =>
      apiPut("/platform-admin/settings", { key, value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pa-settings"] }); toast({ title: "Setting saved" }); },
    onError: () => toast({ title: "Failed to save setting", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">System Settings</h2>
        <p className="text-xs text-zinc-500">Application-wide configuration values</p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 px-4 py-1">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-32 bg-zinc-800" />
                  <Skeleton className="h-3 w-48 bg-zinc-800" />
                </div>
                <Skeleton className="h-7 w-48 bg-zinc-800" />
              </div>
            ))
          : settings.map(s => (
              <SettingRow
                key={s.key}
                setting={s}
                saving={save.isPending}
                onSave={(key, value) => save.mutate({ key, value })}
              />
            ))}
      </Card>
    </div>
  );
}
