// @refresh reset
import { useState, useMemo } from "react";
import {
  useGetProjects,
  useCreateProject,
  useGetPortfolioSummary,
  getGetProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatINRCompact } from "@/lib/currency";
import { differenceInDays, parseISO } from "date-fns";
import {
  Plus, Search, X, FolderKanban, MapPin, LayoutGrid, List,
  CheckCircle2, AlertTriangle, ChevronRight, CircleDot,
  DollarSign, Calendar, User2, TrendingUp, ArrowUpDown,
} from "lucide-react";
import { CanCreate } from "@/lib/permissions";
import { EmptyState, SkeletonCards } from "@/components/shared";

// ── Form schema ───────────────────────────────────────────────────────────────
const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  siteLocation: z.string().optional(),
  contractValue: z.coerce.number().optional(),
  startDate: z.string().optional(),
  plannedEnd: z.string().optional(),
});
type CreateProjectForm = z.infer<typeof createProjectSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode = "cards" | "list";
type SortOption = "newest" | "deadline_asc" | "value_desc" | "progress_desc" | "progress_asc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest",       label: "Newest" },
  { value: "deadline_asc", label: "Deadline ↑" },
  { value: "value_desc",   label: "Value ↓" },
  { value: "progress_desc",label: "Progress ↓" },
  { value: "progress_asc", label: "Progress ↑" },
];

interface Project {
  id: number;
  name: string;
  status: string;
  siteLocation?: string | null;
  contractValue?: number | null;
  percentComplete?: number | null;
  pmOwnerName?: string | null;
  startDate?: string | null;
  plannedEnd?: string | null;
  createdAt: string;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  dot: string; pill: string; border: string; progress: string; label: string;
}> = {
  Active:    { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",    border: "border-l-emerald-500", progress: "bg-emerald-500",  label: "Active"    },
  Planning:  { dot: "bg-blue-500",    pill: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",                      border: "border-l-blue-500",   progress: "bg-blue-500",    label: "Planning"  },
  "On Hold": { dot: "bg-amber-500",   pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",               border: "border-l-amber-400",  progress: "bg-amber-500",   label: "On Hold"   },
  Completed: { dot: "bg-violet-500",  pill: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800",         border: "border-l-violet-500", progress: "bg-violet-500",  label: "Completed" },
  Cancelled: { dot: "bg-rose-400",    pill: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",                     border: "border-l-rose-400",   progress: "bg-rose-400",    label: "Cancelled" },
};
const DEFAULT_STATUS = { dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground border-border", border: "border-l-muted-foreground/30", progress: "bg-muted-foreground", label: "Unknown" };

function getStatus(s: string) { return STATUS_CONFIG[s] ?? DEFAULT_STATUS; }

// ── Status filter options ─────────────────────────────────────────────────────
const STATUS_FILTERS = ["all", "Active", "Planning", "On Hold", "Completed", "Cancelled"] as const;

// ── Gradient palette (deterministic by project id) ────────────────────────────
const GRADIENTS = [
  "from-orange-400 to-rose-500",
  "from-blue-500 to-indigo-600",
  "from-emerald-400 to-teal-500",
  "from-violet-500 to-purple-600",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-fuchsia-500",
  "from-cyan-400 to-sky-500",
];
const projectGradient = (id: number) => GRADIENTS[id % GRADIENTS.length];
const projectCode     = (id: number) => `PRJ-${id.toString().padStart(4, "0")}`;

// ── Deadline label helper ─────────────────────────────────────────────────────
function deadlineLabel(plannedEnd?: string | null): { text: string; urgent: boolean } | null {
  if (!plannedEnd) return null;
  try {
    const days = differenceInDays(parseISO(plannedEnd), new Date());
    if (days < 0)  return { text: `${Math.abs(days)}d overdue`, urgent: true };
    if (days === 0) return { text: "Due today",                  urgent: true };
    if (days <= 30) return { text: `${days}d left`,              urgent: true };
    return          { text: `${days}d left`,                     urgent: false };
  } catch { return null; }
}

// ── Progress colour ───────────────────────────────────────────────────────────
const progressColor = (pct: number) =>
  pct >= 80 ? "text-emerald-600 dark:text-emerald-400" :
  pct >= 40 ? "text-blue-600 dark:text-blue-400" :
  "text-amber-600 dark:text-amber-400";

// ─────────────────────────────────────────────────────────────────────────────
// Project Card (grid view)
// ─────────────────────────────────────────────────────────────────────────────
function ProjectCard({ project }: { project: Project }) {
  const cfg  = getStatus(project.status);
  const pct  = project.percentComplete ?? 0;
  const dl   = deadlineLabel(project.plannedEnd);
  const code = projectCode(project.id);

  return (
    <Link href={`/projects/${project.id}`}>
      <motion.div
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        className={cn(
          "group flex flex-col bg-card border rounded-xl overflow-hidden cursor-pointer",
          "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]",
          "transition-shadow duration-200 border-l-[3px]",
          cfg.border
        )}
      >
        {/* ── Card body ── */}
        <div className="p-4 flex-1">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2 mb-3.5">
            {/* Avatar */}
            <div className={cn(
              "h-9 w-9 rounded-lg bg-gradient-to-br shrink-0 flex items-center justify-center shadow-sm",
              projectGradient(project.id)
            )}>
              <FolderKanban className="h-[18px] w-[18px] text-white" />
            </div>
            {/* Code + status */}
            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              <span className="text-[10px] font-mono font-bold text-muted-foreground/50 tracking-wider">
                {code}
              </span>
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full border",
                cfg.pill
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                {project.status}
              </span>
            </div>
          </div>

          {/* Name */}
          <h3 className="text-[14px] font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-2">
            {project.name}
          </h3>

          {/* Location */}
          {project.siteLocation ? (
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              <span className="truncate">{project.siteLocation}</span>
            </div>
          ) : (
            <div className="h-4" />
          )}
        </div>

        {/* ── Progress ── */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground">Progress</span>
            <span className={cn("text-[12px] font-bold tabular-nums", progressColor(pct))}>
              {pct}%
            </span>
          </div>
          <div className="h-[5px] bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", cfg.progress)}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-4 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Contract value */}
            <span className="text-[12px] font-bold font-mono text-foreground shrink-0">
              {project.contractValue ? formatINRCompact(project.contractValue) : <span className="text-muted-foreground/40 font-sans font-normal">No value</span>}
            </span>
            {/* PM */}
            {project.pmOwnerName && (
              <div className="flex items-center gap-1 min-w-0 pl-3 border-l border-border/60">
                <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-black text-primary leading-none">
                    {project.pmOwnerName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground truncate">
                  {project.pmOwnerName.split(" ")[0]}
                </span>
              </div>
            )}
          </div>
          {/* Deadline */}
          {dl && (
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0",
              dl.urgent
                ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                : "bg-muted text-muted-foreground"
            )}>
              {dl.text}
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Project List Row (table/list view)
// ─────────────────────────────────────────────────────────────────────────────
function ProjectRow({ project }: { project: Project }) {
  const cfg  = getStatus(project.status);
  const pct  = project.percentComplete ?? 0;
  const dl   = deadlineLabel(project.plannedEnd);
  const code = projectCode(project.id);

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="group flex items-center gap-4 px-4 py-3.5 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
        {/* Left status stripe */}
        <div className={cn("h-9 w-[3px] rounded-full shrink-0", cfg.dot)} />

        {/* Identity */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "h-8 w-8 rounded-lg bg-gradient-to-br shrink-0 hidden sm:flex items-center justify-center",
            projectGradient(project.id)
          )}>
            <FolderKanban className="h-[15px] w-[15px] text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors truncate leading-snug">
                {project.name}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0 hidden md:block">
                {code}
              </span>
            </div>
            {project.siteLocation && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{project.siteLocation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status pill */}
        <span className={cn(
          "hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full border shrink-0",
          cfg.pill
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
          {project.status}
        </span>

        {/* Progress bar */}
        <div className="hidden md:flex items-center gap-2 w-28 shrink-0">
          <div className="flex-1 h-[5px] bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full", cfg.progress)} style={{ width: `${pct}%` }} />
          </div>
          <span className={cn("text-[11px] font-bold tabular-nums w-8 text-right shrink-0", progressColor(pct))}>
            {pct}%
          </span>
        </div>

        {/* Contract value */}
        <span className="hidden lg:block text-[13px] font-bold font-mono text-foreground shrink-0 w-20 text-right">
          {project.contractValue ? formatINRCompact(project.contractValue) : <span className="text-muted-foreground/30 font-sans font-normal text-[12px]">—</span>}
        </span>

        {/* Deadline */}
        <div className="hidden sm:flex justify-end w-20 shrink-0">
          {dl ? (
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded",
              dl.urgent ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400" : "bg-muted text-muted-foreground"
            )}>
              {dl.text}
            </span>
          ) : null}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground/25 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Project Dialog
// ─────────────────────────────────────────────────────────────────────────────
function CreateProjectDialog({
  open, onOpenChange,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", siteLocation: "", startDate: "", plannedEnd: "" },
  });

  const createMutation = useCreateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectsQueryKey({}) });
        onOpenChange(false);
        form.reset();
      },
    },
  });

  const handleClose = () => {
    if (!createMutation.isPending) {
      onOpenChange(false);
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[520px] p-0 overflow-hidden gap-0">

        {/* ── Dialog header ── */}
        <DialogHeader className="px-6 pt-6 pb-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-[16px] font-bold text-foreground leading-none mb-0.5">
                New Project
              </DialogTitle>
              <p className="text-[12px] text-muted-foreground">
                Set up a new EPC project workspace
              </p>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate({ data: d }))}>

            {/* ── Section: Identity ── */}
            <div className="px-6 pt-5 pb-4 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                Project Identity
              </p>

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-semibold text-foreground/80">
                    Project Name <span className="text-red-500 ml-0.5">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      className="h-9 bg-muted/40 border-border/60 focus-visible:bg-background text-[13px] transition-colors"
                      placeholder="e.g. Rooftop Solar — Phase 2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )} />

              <FormField control={form.control} name="siteLocation" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-semibold text-foreground/80">
                    Site Location
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
                      <Input
                        className="h-9 bg-muted/40 border-border/60 focus-visible:bg-background text-[13px] pl-8 transition-colors"
                        placeholder="e.g. Pune, Maharashtra"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )} />
            </div>

            {/* ── Divider ── */}
            <div className="h-px bg-border/50 mx-6" />

            {/* ── Section: Timeline ── */}
            <div className="px-6 pt-4 pb-4 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                Timeline
              </p>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[12px] font-semibold text-foreground/80">
                      Start Date
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
                        <Input
                          className="h-9 bg-muted/40 border-border/60 focus-visible:bg-background text-[13px] pl-8 transition-colors"
                          type="date"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="plannedEnd" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[12px] font-semibold text-foreground/80">
                      Planned End
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
                        <Input
                          className="h-9 bg-muted/40 border-border/60 focus-visible:bg-background text-[13px] pl-8 transition-colors"
                          type="date"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="h-px bg-border/50 mx-6" />

            {/* ── Section: Financial ── */}
            <div className="px-6 pt-4 pb-5 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                Financial
              </p>

              <FormField control={form.control} name="contractValue" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-semibold text-foreground/80">
                    Contract Value
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-muted-foreground/60 pointer-events-none select-none">
                        ₹
                      </span>
                      <Input
                        className="h-9 bg-muted/40 border-border/60 focus-visible:bg-background text-[13px] font-mono pl-6 transition-colors"
                        type="number"
                        placeholder="0"
                        min={0}
                        step="any"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )} />
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/60 bg-muted/20">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={createMutation.isPending}
                className="text-[13px] text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending}
                className="h-9 px-5 gap-1.5 bg-primary hover:bg-primary/90 text-white font-bold text-[13px]"
              >
                {createMutation.isPending ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Creating…
                  </span>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Create Project
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio stat card
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, colorClass, iconBg, mono,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  colorClass: string;
  iconBg: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-4 flex items-start gap-3", colorClass)}>
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", iconBg)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-2">
          {label}
        </p>
        <p className={cn(
          "leading-none font-bold",
          mono ? "text-[17px] font-mono" : "text-[24px]",
        )}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export function ProjectsList() {
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode,     setViewMode]     = useState<ViewMode>("cards");
  const [sortBy,       setSortBy]       = useState<SortOption>("newest");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: projects, isPending } = useGetProjects({}, {
    query: { queryKey: getGetProjectsQueryKey({}) },
  });

  const { data: summary } = useGetPortfolioSummary();

  // ── Counts per status ──
  const counts = useMemo(() => {
    if (!projects) return {} as Record<string, number>;
    return STATUS_FILTERS.slice(1).reduce<Record<string, number>>((acc, s) => {
      acc[s] = projects.filter(p => p.status === s).length;
      return acc;
    }, {});
  }, [projects]);

  // ── Filtered + sorted list ──
  const filtered = useMemo(() => {
    const list = projects?.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.siteLocation ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    }) ?? [];

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "deadline_asc": {
          // nulls last
          if (!a.plannedEnd && !b.plannedEnd) return 0;
          if (!a.plannedEnd) return 1;
          if (!b.plannedEnd) return -1;
          return a.plannedEnd.localeCompare(b.plannedEnd);
        }
        case "value_desc":
          return (b.contractValue ?? 0) - (a.contractValue ?? 0);
        case "progress_desc":
          return (b.percentComplete ?? 0) - (a.percentComplete ?? 0);
        case "progress_asc":
          return (a.percentComplete ?? 0) - (b.percentComplete ?? 0);
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [projects, search, statusFilter, sortBy]);

  const hasFilters = search.length > 0 || statusFilter !== "all";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 pb-12"
    >

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-[20px] sm:text-[24px] font-bold text-foreground tracking-tight leading-none">
            Projects Hub
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Manage execution, budgets, and site milestones
          </p>
        </div>
        <CanCreate module="projects">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="h-9 px-4 gap-1.5 text-[13px] font-bold bg-primary hover:bg-primary/90 text-white shrink-0 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </CanCreate>
      </div>

      {/* ── Portfolio stat bar ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Active Projects"
          value={<span className="text-emerald-700 dark:text-emerald-400">{summary?.activeProjects ?? 0}</span>}
          icon={CircleDot}
          colorClass="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/60"
          iconBg="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Portfolio Value"
          value={<span className="text-blue-700 dark:text-blue-400">{formatINRCompact(summary?.totalBudget)}</span>}
          icon={DollarSign}
          colorClass="bg-blue-50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-900/60"
          iconBg="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
          mono
        />
        <StatCard
          label="On Track"
          value={summary?.onTrackCount ?? 0}
          icon={CheckCircle2}
          colorClass="bg-card border-border"
          iconBg="bg-muted text-muted-foreground"
        />
        <StatCard
          label="Delayed"
          value={
            <span className={(summary?.delayedCount ?? 0) > 0 ? "text-red-600 dark:text-red-400" : ""}>
              {summary?.delayedCount ?? 0}
            </span>
          }
          icon={AlertTriangle}
          colorClass={(summary?.delayedCount ?? 0) > 0
            ? "bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-900/60"
            : "bg-card border-border"
          }
          iconBg={(summary?.delayedCount ?? 0) > 0
            ? "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400"
            : "bg-muted text-muted-foreground"
          }
        />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">

        {/* Search + view toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or location…"
              className="h-8 pl-8 pr-8 text-[13px] bg-background border-border/60"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className={cn(
                "h-8 pl-7 pr-7 rounded-lg border border-border/60 bg-background text-[12px] font-medium text-foreground",
                "appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
                "hover:border-border transition-colors"
              )}
              aria-label="Sort projects"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/40 text-[10px]">▾</span>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 border border-border/60 rounded-lg shrink-0">
            {([
              { mode: "cards", Icon: LayoutGrid, label: "Card view" },
              { mode: "list",  Icon: List,       label: "List view" },
            ] as const).map(({ mode, Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-all",
                  viewMode === mode
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => {
            const isActive = statusFilter === s;
            const count    = s === "all" ? (projects?.length ?? 0) : (counts[s] ?? 0);
            const cfg      = s !== "all" ? getStatus(s) : null;

            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "h-7 px-2.5 rounded-full text-[12px] font-medium transition-all flex items-center gap-1.5 border",
                  isActive
                    ? "bg-foreground text-background border-foreground shadow-sm font-semibold"
                    : "bg-background text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
                )}
              >
                {cfg && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />}
                <span>{s === "all" ? "All" : s}</span>
                <span className={cn(
                  "text-[10px] font-bold tabular-nums",
                  isActive ? "text-background/60" : "text-muted-foreground/50"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {isPending ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SkeletonCards count={6} />
          </motion.div>

        ) : filtered.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={FolderKanban}
              heading={hasFilters ? "No matching projects" : "No projects yet"}
              message={hasFilters ? "Try adjusting your search or status filter." : "Create your first project to get started."}
              action={!hasFilters ? { label: "Create Project", onClick: () => setIsCreateOpen(true) } : undefined}
            />
          </motion.div>

        ) : viewMode === "cards" ? (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {filtered.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.05, 0.4) }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </motion.div>

        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            {/* List header (desktop) */}
            <div className="hidden md:flex items-center gap-4 px-4 py-2.5 border-b border-border/60 bg-muted/30">
              <div className="w-[3px] shrink-0" />
              <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 pl-11">
                Project
              </div>
              <div className="w-20 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hidden sm:block">
                Status
              </div>
              <div className="w-28 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hidden md:block">
                Progress
              </div>
              <div className="w-20 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hidden lg:block text-right">
                Value
              </div>
              <div className="w-20 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hidden sm:block text-center">
                Timeline
              </div>
              <div className="w-4 shrink-0" />
            </div>

            {filtered.map(project => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Count footer ──────────────────────────────────────────────────── */}
      {!isPending && filtered.length > 0 && (
        <p className="text-[12px] text-muted-foreground/50 text-center">
          Showing {filtered.length} of {projects?.length ?? 0} project{projects?.length !== 1 ? "s" : ""}
          {statusFilter !== "all" && ` · ${statusFilter}`}
          {search && ` · "${search}"`}
        </p>
      )}

      {/* ── Create dialog ─────────────────────────────────────────────────── */}
      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </motion.div>
  );
}
