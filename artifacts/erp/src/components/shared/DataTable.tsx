import { useState, useMemo, useEffect, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type PaginationState,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuTrigger, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronsUpDown, ChevronUp, ChevronDown, Search,
  Settings2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  X, LucideIcon, AlignJustify, SlidersHorizontal,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import { ExportButton } from "./ExportButton";

// ── Filter option type ────────────────────────────────────────────────────────

export interface FilterOption {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

/**
 * Column responsive breakpoint — the column is hidden below this screen width.
 * Set via column `meta.responsive`:
 *   { accessorKey: "gstin", header: "GSTIN", meta: { responsive: "md" } }
 *
 * "sm"  → hidden on xs (<640 px),  visible sm+
 * "md"  → hidden on xs+sm (<768 px), visible md+
 * "lg"  → hidden on xs–md (<1024 px), visible lg+
 */
export type ColumnResponsive = "sm" | "md" | "lg";

function responsiveClass(r?: ColumnResponsive) {
  if (r === "sm") return "hidden sm:table-cell";
  if (r === "md") return "hidden md:table-cell";
  if (r === "lg") return "hidden lg:table-cell";
  return "";
}

// ── DataTable props ───────────────────────────────────────────────────────────

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  loading?: boolean;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  bulkActions?: (rows: TData[], clearSelection: () => void) => React.ReactNode;
  exportFilename?: string;
  exportModule?: string;
  exportTitle?: string;
  filterOptions?: FilterOption[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onRowClick?: (row: TData) => void;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  pageSize?: number;
  noSelection?: boolean;
  density?: "compact" | "default" | "comfortable";
  /**
   * When true, the first data column is pinned with `position: sticky` so it
   * stays visible while users scroll right on narrow screens.
   */
  stickyFirstCol?: boolean;
  className?: string;
}

// ── Sort header button ────────────────────────────────────────────────────────

function SortButton({ sorted, onClick, children }: {
  sorted: false | "asc" | "desc";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 group w-full text-left"
      aria-label={`Sort${sorted === "asc" ? " descending" : " ascending"}`}
    >
      <span>{children}</span>
      <span className={cn(
        "ml-auto shrink-0 transition-colors",
        sorted ? "text-primary" : "text-muted-foreground/30 group-hover:text-muted-foreground"
      )}>
        {sorted === "asc" ? <ChevronUp className="h-3.5 w-3.5" />
          : sorted === "desc" ? <ChevronDown className="h-3.5 w-3.5" />
          : <ChevronsUpDown className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

// ── Filter Chip ───────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium bg-primary/8 text-primary border border-primary/20">
      {label}
      <button onClick={onRemove} className="h-3.5 w-3.5 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ── Mobile filter sheet ───────────────────────────────────────────────────────

function MobileFilterSheet({
  filterOptions, columnFilters, setColumnFilters,
  globalFilter, setGlobalFilter, searchPlaceholder, hasActiveFilters,
}: {
  filterOptions?: FilterOption[];
  columnFilters: ColumnFiltersState;
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  globalFilter: string;
  setGlobalFilter: (v: string) => void;
  searchPlaceholder?: string;
  hasActiveFilters: boolean;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = (globalFilter ? 1 : 0) + columnFilters.length;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "h-9 gap-1.5 text-[12px] border-border/60 sm:hidden",
          hasActiveFilters && "border-primary/40 text-primary"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>Filter</span>
        {activeCount > 0 && (
          <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center ml-0.5">
            {activeCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-safe">
          <SheetHeader className="mb-5">
            <SheetTitle className="text-left">Filter & Search</SheetTitle>
          </SheetHeader>

          <div className="space-y-5">
            {/* Search */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">Search</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-11 pl-10 text-[14px]"
                  inputMode="search"
                />
                {globalFilter && (
                  <button onClick={() => setGlobalFilter("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Column filters */}
            {filterOptions?.map((filter) => {
              const current = columnFilters.find((f) => f.id === filter.key)?.value as string | undefined;
              return (
                <div key={filter.key}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">{filter.label}</p>
                  <Select
                    value={current ?? "all"}
                    onValueChange={(v) => {
                      if (v === "all") {
                        setColumnFilters((prev) => prev.filter((f) => f.id !== filter.key));
                      } else {
                        setColumnFilters((prev) => {
                          const rest = prev.filter((f) => f.id !== filter.key);
                          return [...rest, { id: filter.key, value: v }];
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="h-11 text-[14px]">
                      <SelectValue placeholder={`All ${filter.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All {filter.label}</SelectItem>
                      {filter.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}

            {/* Clear */}
            {hasActiveFilters && (
              <Button variant="outline" className="w-full h-11" onClick={() => { setGlobalFilter(""); setColumnFilters([]); }}>
                Clear all filters
              </Button>
            )}

            <Button className="w-full h-11" onClick={() => setOpen(false)}>
              Show results
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── DataTable ─────────────────────────────────────────────────────────────────

export function DataTable<TData>({
  data,
  columns: rawColumns,
  loading = false,
  searchPlaceholder = "Search…",
  actions,
  bulkActions,
  exportFilename,
  exportModule,
  exportTitle,
  filterOptions,
  onRowClick,
  emptyIcon,
  emptyTitle = "No results found",
  emptyDescription,
  emptyAction,
  pageSize: defaultPageSize = 20,
  noSelection = false,
  density: densityProp,
  stickyFirstCol = false,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting]               = useState<SortingState>([]);
  const [columnFilters, setColumnFilters]   = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection]     = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter]     = useState("");
  const [pagination, setPagination]         = useState<PaginationState>({ pageIndex: 0, pageSize: defaultPageSize });
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [density, setDensity]               = useState<"compact" | "default" | "comfortable">(densityProp ?? "default");

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [globalFilter, columnFilters]);

  const cellPadding = density === "compact" ? "px-3 py-1.5" : density === "comfortable" ? "px-4 py-4" : "px-3 sm:px-4 py-2.5 sm:py-3";

  const columns = useMemo<ColumnDef<TData, any>[]>(() => {
    if (noSelection || !bulkActions) return rawColumns;
    const selectCol: ColumnDef<TData, any> = {
      id: "__select",
      size: 40,
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
    };
    return [selectCol, ...rawColumns];
  }, [rawColumns, noSelection, bulkActions]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, rowSelection, globalFilter, pagination, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: !noSelection && !!bulkActions,
  });

  const selectedRows    = table.getSelectedRowModel().rows.map((r) => r.original);
  const clearSelection  = useCallback(() => setRowSelection({}), []);
  const hasActiveFilters = globalFilter.length > 0 || columnFilters.length > 0;
  const clearAllFilters  = () => { setGlobalFilter(""); setColumnFilters([]); };
  const totalFiltered    = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount        = table.getPageCount();

  // Index of the first real data column (skip __select)
  const firstDataColIndex = columns.findIndex((c) => c.id !== "__select");

  return (
    <div className={cn("flex flex-col gap-0 bg-card border border-border rounded-xl overflow-hidden", className)}>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-border/60 bg-muted/20 flex-wrap">

        {/* Desktop search */}
        <div className="relative hidden sm:flex flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-8 pr-7 text-[13px] bg-background border-border/60 w-full"
            aria-label="Search table"
          />
          {globalFilter && (
            <button onClick={() => setGlobalFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Mobile search (full-width, larger touch target) */}
        <div className="relative flex sm:hidden flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-8 pr-7 text-[14px] bg-background border-border/60 w-full"
            aria-label="Search table"
            inputMode="search"
          />
          {globalFilter && (
            <button onClick={() => setGlobalFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Desktop column filters */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          {filterOptions?.map((filter) => {
            const current = columnFilters.find((f) => f.id === filter.key)?.value as string | undefined;
            return (
              <Select
                key={filter.key}
                value={current ?? "all"}
                onValueChange={(v) => {
                  if (v === "all") {
                    setColumnFilters((prev) => prev.filter((f) => f.id !== filter.key));
                  } else {
                    setColumnFilters((prev) => {
                      const rest = prev.filter((f) => f.id !== filter.key);
                      return [...rest, { id: filter.key, value: v }];
                    });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-[12px] w-auto min-w-[110px] border-border/60 bg-background">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-[12px]">All {filter.label}</SelectItem>
                  {filter.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-[12px]">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}
              className="h-8 px-2.5 gap-1.5 text-muted-foreground text-[12px] hover:text-foreground">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>

        {/* Mobile filter sheet */}
        <MobileFilterSheet
          filterOptions={filterOptions}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          searchPlaceholder={searchPlaceholder}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Right side */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {!loading && data.length > 0 && (
            <span className="text-[11px] text-muted-foreground hidden lg:block tabular-nums mr-1">
              {totalFiltered.toLocaleString("en-IN")} result{totalFiltered !== 1 ? "s" : ""}
            </span>
          )}

          {exportFilename && (
            <ExportButton
              config={{
                title: exportTitle ?? exportFilename.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                module: exportModule ?? "data",
                filename: exportFilename,
                columns: columns
                  .filter((c) => c.id !== "__select" && c.id !== "__actions")
                  .filter((c) => {
                    const colId = (c as any).accessorKey ?? c.id ?? "";
                    return colId === "" || table.getColumn(colId)?.getIsVisible() !== false;
                  })
                  .map((c) => ({
                    header: typeof c.header === "string" ? c.header : ((c as any).accessorKey ?? c.id ?? "").replace(/[_-]/g, " "),
                    key: (c as any).accessorKey ?? c.id ?? "",
                  })),
                getRows: () => table.getFilteredRowModel().rows.map((r) => r.original as Record<string, unknown>),
              }}
              size="sm"
              className="h-8 text-[12px] border-border/60"
            />
          )}

          {/* Column visibility — hidden on mobile to keep toolbar compact */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] border-border/60 hidden sm:flex" aria-label="Column options">
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {table.getAllColumns().filter((col) => col.getCanHide()).map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(v)}
                  className="text-[12px] capitalize"
                >
                  {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id.replace(/_/g, " ")}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Density — desktop only */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] border-border/60 hidden md:flex" aria-label="Row density">
                <AlignJustify className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Density</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {(["compact", "default", "comfortable"] as const).map(d => (
                <DropdownMenuItem key={d} onClick={() => setDensity(d)}
                  className={cn("text-[12px] capitalize cursor-pointer", density === d && "font-semibold text-primary")}>
                  {d} {density === d && "✓"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {actions}
        </div>
      </div>

      {/* ── Active filter chips (desktop) ── */}
      {hasActiveFilters && (
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-background flex-wrap">
          <span className="text-[11px] text-muted-foreground font-medium">Filters:</span>
          {globalFilter && <FilterChip label={"Search: " + globalFilter} onRemove={() => setGlobalFilter("")} />}
          {columnFilters.map(f => {
            const opt = filterOptions?.find(fo => fo.key === f.id);
            const val = opt?.options.find(o => o.value === f.value)?.label ?? String(f.value);
            return (
              <FilterChip key={f.id}
                label={(opt?.label ?? f.id) + ": " + val}
                onRemove={() => setColumnFilters(prev => prev.filter(cf => cf.id !== f.id))}
              />
            );
          })}
          <button onClick={clearAllFilters} className="text-[11px] text-muted-foreground hover:text-foreground ml-1 underline-offset-2 hover:underline transition-colors">
            Clear all
          </button>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selectedRows.length > 0 && bulkActions && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/8 dark:bg-primary/12 border-b border-primary/15 flex-wrap">
          <Badge variant="secondary" className="gap-1 text-[11px]">{selectedRows.length} selected</Badge>
          <div className="flex items-center gap-2 flex-wrap">{bulkActions(selectedRows, clearSelection)}</div>
          <Button variant="ghost" size="sm" onClick={clearSelection}
            className="h-7 px-2 text-[11px] ml-auto text-muted-foreground">Clear</Button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto scrollbar-thin flex-1">
        <table className="w-full text-[13px]">
          <thead className="border-b-2 border-border/60 bg-muted/30 sticky top-0 z-[1]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header, hIdx) => {
                  const responsive: ColumnResponsive | undefined = (header.column.columnDef.meta as any)?.responsive;
                  const isFirstData = stickyFirstCol && hIdx === firstDataColIndex;
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      className={cn(
                        "px-3 sm:px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap",
                        responsiveClass(responsive),
                        isFirstData && "sticky left-0 z-[2] bg-muted/30 after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border/60"
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <SortButton sorted={header.column.getIsSorted()} onClick={header.column.getToggleSortingHandler() as any}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </SortButton>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/40">
                  {columns.map((col, j) => {
                    const responsive: ColumnResponsive | undefined = (col.meta as any)?.responsive;
                    return (
                      <td key={j} className={cn("px-3 sm:px-4 py-3", responsiveClass(responsive))}>
                        <div className="h-4 bg-muted rounded-full animate-pulse" style={{ width: `${60 + (j * 13) % 40}%` }} />
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  {hasActiveFilters ? (
                    <div className="py-16 text-center">
                      <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                        <Search className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-[14px] font-semibold text-foreground">No results match your filters</p>
                      <p className="text-[13px] text-muted-foreground mt-1">Try adjusting or clearing your search criteria</p>
                      <button onClick={clearAllFilters} className="mt-3 text-[13px] text-primary hover:underline">Clear all filters</button>
                    </div>
                  ) : emptyIcon ? (
                    <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} size="md" />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground text-sm">{emptyTitle}</div>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "border-b border-border/40 last:border-0 transition-all duration-100 group hover:bg-muted/40",
                    onRowClick && "cursor-pointer active:bg-muted/60",
                    row.getIsSelected() && "bg-primary/[0.04] dark:bg-primary/[0.08]",
                  )}
                >
                  {row.getVisibleCells().map((cell, cIdx) => {
                    const responsive: ColumnResponsive | undefined = (cell.column.columnDef.meta as any)?.responsive;
                    const isFirstData = stickyFirstCol && cIdx === firstDataColIndex;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "align-middle",
                          cellPadding,
                          responsiveClass(responsive),
                          isFirstData && "sticky left-0 z-[1] bg-card group-hover:bg-muted/40 transition-colors after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border/40"
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {!loading && totalFiltered > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-t border-border/60 bg-muted/20 flex-wrap">
          {/* Rows per page — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPagination({ pageIndex: 0, pageSize: Number(v) })}>
              <SelectTrigger className="h-7 w-[64px] text-[12px] border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-[12px]">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mobile: compact page info */}
          <span className="text-[12px] text-muted-foreground tabular-nums sm:hidden">
            {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalFiltered)} / {totalFiltered.toLocaleString("en-IN")}
          </span>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:block mr-2">
              {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalFiltered)} of{" "}
              {totalFiltered.toLocaleString("en-IN")}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 border-border/60"
              onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="First page">
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 border-border/60"
              onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="hidden sm:flex items-center gap-1.5 text-[12px] text-muted-foreground px-1">
              Page
              <input
                type="number"
                min={1}
                max={pageCount}
                value={pageIndex + 1}
                onChange={e => {
                  const p = Number(e.target.value) - 1;
                  if (p >= 0 && p < pageCount) table.setPageIndex(p);
                }}
                className="w-10 h-6 text-center text-[12px] font-medium border border-border/60 rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
              />
              of {pageCount || 1}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 border-border/60"
              onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 border-border/60"
              onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()} aria-label="Last page">
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
