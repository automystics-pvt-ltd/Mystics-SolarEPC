import { Card } from "@/components/ui/card";
import { Database, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function AdminDbConsole() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Database Console</h2>
        <p className="text-xs text-zinc-500">Execute raw SQL queries against the live database</p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 p-8 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-violet-600/20 flex items-center justify-center">
          <Database className="w-7 h-7 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-1">Full DB Console Available</h3>
          <p className="text-xs text-zinc-500 max-w-sm">
            The complete database console with schema explorer, SQL runner, table browser, and CSV export
            is available in the dedicated DB Admin section of the main app.
          </p>
        </div>
        <Link href="/admin/db">
          <a>
            <Button className="gap-2 bg-violet-600 hover:bg-violet-700 text-white h-8 text-xs">
              <ExternalLink className="w-3.5 h-3.5" />
              Open DB Admin Console
            </Button>
          </a>
        </Link>
      </Card>
    </div>
  );
}
