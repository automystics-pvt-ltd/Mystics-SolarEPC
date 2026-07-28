import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Table2, Terminal, Database, Rows3, Upload, ShieldCheck,
  Wrench, ScrollText, AlertTriangle, Search, Loader2, RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/fetch";
import { PageHeader } from "@/components/shared";
import RecordBrowserTab from "./RecordBrowserTab";
import SqlConsoleTab from "./SqlConsoleTab";
import SchemaTab from "./SchemaTab";
import BulkOpsTab from "./BulkOpsTab";
import ImportExportTab from "./ImportExportTab";
import IntegrityTab from "./IntegrityTab";
import MaintenanceTab from "./MaintenanceTab";
import DangerZoneTab from "./DangerZoneTab";
import AuditLogs from "../AuditLogs";
import type { TableSummary, BulkOpsState } from "./types";

// ── Tabs definition ────────────────────────────────────────────────────────────
const TABS = [
  { id: "records",     label: "Record Browser",  icon: Table2     },
  { id: "sql",         label: "SQL Console",     icon: Terminal   },
  { id: "schema",      label: "Schema",          icon: Database   },
  { id: "bulk",        label: "Bulk Ops",        icon: Rows3      },
  { id: "importexport",label: "Import / Export", icon: Upload     },
  { id: "integrity",   label: "Integrity",       icon: ShieldCheck},
  { id: "maintenance", label: "Maintenance",     icon: Wrench     },
  { id: "auditlog",    label: "DB Audit Log",    icon: ScrollText },
  { id: "danger",      label: "Danger Zone",     icon: AlertTriangle },
] as const;

type TabId = typeof TABS[number]["id"];

interface TablesResponse {
  tables: TableSummary[];
  total: number;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function TableSidebar({
  tables,
  selected,
  onSelect,
  isLoading,
  onRefresh,
}: {
  tables: TableSummary[];
  selected: string;
  onSelect: (name: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => tables.filter(t => t.name.toLowerCase().includes(search.toLowerCase())),
    [tables, search]
  );

  return (
    <div className="flex flex-col h-full w-56 shrink-0 border-r border-border bg-muted/20">
      <div className="px-3 py-2.5 border-b border-border/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Tables
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/60">{tables.length}</span>
            <button onClick={onRefresh} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter tables…"
            className="pl-6 h-7 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-20 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground/60 text-center">No tables match</div>
        ) : (
          filtered.map(t => (
            <button
              key={t.name}
              onClick={() => onSelect(t.name)}
              className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between group ${
                selected === t.name
                  ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span className="font-mono text-xs truncate">{t.name}</span>
              <span className="text-[10px] shrink-0 tabular-nums opacity-50 group-hover:opacity-80 ml-1">
                {t.rowCount.toLocaleString()}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DbAdmin() {
  const [activeTab, setActiveTab] = useState<TabId>("records");
  const [selectedTable, setSelectedTable] = useState("");
  const [bulkState, setBulkState] = useState<BulkOpsState>({ selectedIds: new Set(), pkCol: "id" });

  const { data, isLoading, refetch } = useQuery<TablesResponse>({
    queryKey: ["db-admin-tables"],
    queryFn: () => apiGet<TablesResponse>("/db-admin/tables"),
    staleTime: 30_000,
  });

  const tables = data?.tables ?? [];

  // Auto-select first table when loaded
  const handleTablesLoad = (list: TableSummary[]) => {
    if (!selectedTable && list.length > 0) setSelectedTable(list[0].name);
  };

  if (data && !selectedTable && tables.length > 0) {
    handleTablesLoad(tables);
  }

  const handleTableSelect = (name: string) => {
    setSelectedTable(name);
    // Don't auto-switch tab; user may be on SQL Console etc.
  };

  // Tab content
  const renderTab = () => {
    if (!selectedTable && activeTab !== "sql" && activeTab !== "integrity" && activeTab !== "maintenance" && activeTab !== "auditlog") {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
          <Database className="h-10 w-10 opacity-20" />
          <p className="text-sm">Select a table from the sidebar</p>
        </div>
      );
    }

    switch (activeTab) {
      case "records":
        return (
          <RecordBrowserTab
            table={selectedTable}
            bulkState={bulkState}
            onBulkChange={setBulkState}
          />
        );
      case "sql":
        return <SqlConsoleTab />;
      case "schema":
        return <SchemaTab table={selectedTable} />;
      case "bulk":
        return (
          <BulkOpsTab
            table={selectedTable}
            bulkState={bulkState}
            onBulkChange={setBulkState}
          />
        );
      case "importexport":
        return <ImportExportTab table={selectedTable} />;
      case "integrity":
        return <IntegrityTab />;
      case "maintenance":
        return <MaintenanceTab />;
      case "auditlog":
        return (
          <div className="p-4 overflow-y-auto h-full">
            <AuditLogs />
          </div>
        );
      case "danger":
        return <DangerZoneTab table={selectedTable} tables={tables} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full -mx-4 -mt-2"
      style={{ height: "calc(100vh - 120px)" }}
    >
      <div className="px-4 pt-2 pb-3 border-b border-border/60 shrink-0">
        <PageHeader
          title="DB Admin"
          subtitle="Browse tables, run SQL, inspect schemas, manage data, and run maintenance operations"
        />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border/60 bg-muted/10 overflow-x-auto shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? tab.id === "danger"
                    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                    : "bg-white dark:bg-card text-foreground border border-border shadow-sm"
                  : tab.id === "danger"
                    ? "text-red-500/70 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-card/60"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${tab.id === "danger" ? "text-current" : ""}`} />
              {tab.label}
              {tab.id === "bulk" && bulkState.selectedIds.size > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold">
                  {bulkState.selectedIds.size}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <TableSidebar
          tables={tables}
          selected={selectedTable}
          onSelect={handleTableSelect}
          isLoading={isLoading}
          onRefresh={() => refetch()}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {renderTab()}
        </div>
      </div>
    </motion.div>
  );
}
