import { useLocation } from "wouter";
import { Users, FileText, FileCheck, Boxes, FolderKanban, ClipboardList } from "lucide-react";
import { SectionCard } from "@/components/shared";

const ACTIONS = [
  { label: "New Lead", icon: Users, href: "/crm/leads" },
  { label: "Create Quote", icon: FileText, href: "/crm/quotations/new" },
  { label: "Log Client PO", icon: FileCheck, href: "/crm/client-pos" },
  { label: "Issue GRN", icon: Boxes, href: "/procurement/grns/new" },
  { label: "New Project", icon: FolderKanban, href: "/projects" },
  { label: "Raise MR", icon: ClipboardList, href: "/procurement/quotations/new" },
];

export function QuickActionsGrid() {
  const [, setLocation] = useLocation();

  return (
    <SectionCard title="Quick Actions">
      <div className="grid grid-cols-3 gap-2.5">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            role="button"
            tabIndex={0}
            onClick={() => setLocation(action.href)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLocation(action.href);
              }
            }}
            className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-transparent bg-muted/40 hover:bg-orange-50 hover:border-orange-200 transition-all duration-150 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <action.icon className="h-5 w-5 text-muted-foreground group-hover:text-orange-500 transition-colors" />
            <span className="text-[12px] font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight transition-colors">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
