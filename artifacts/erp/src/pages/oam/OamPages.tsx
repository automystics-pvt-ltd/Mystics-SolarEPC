import { useLocation } from "wouter";
import AmcContractsList from "./AmcContractsList";
import MaintenanceList from "./MaintenanceList";
import ServiceTicketsList from "./ServiceTicketsList";
import { Wrench, FileCheck, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const TABS = [
  { id: "amc", label: "AMC Contracts", icon: FileCheck, path: "/oam/amc" },
  { id: "maintenance", label: "Maintenance", icon: Wrench, path: "/oam/maintenance" },
  { id: "tickets", label: "Service Tickets", icon: Ticket, path: "/oam/tickets" },
] as const;

export default function OamPages() {
  const [location, setLocation] = useLocation();
  const active = location.includes("maintenance") ? "maintenance" : location.includes("tickets") ? "tickets" : "amc";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setLocation(tab.path)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              active === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {active === "amc" && <AmcContractsList />}
      {active === "maintenance" && <MaintenanceList />}
      {active === "tickets" && <ServiceTicketsList />}
    </motion.div>
  );
}
