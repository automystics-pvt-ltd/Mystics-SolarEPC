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
  DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronsUpDown, ChevronUp, ChevronDown, Search, Download,
  Settings2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  X, Loader2, LucideIcon,
} from "lucide-react";
import { EmptyState } from "./EmptyState";

// ── Filter option type ────────────────────────────────────────────────────────

export interface FilterOption {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

// ── DataTable props ───────────────────────────────────────────────────────────

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  loading?: boolean;
  /** Placeholder for the global search input */
  searchPlaceholder?: string;
  /** Right-side header actions */
  actions?: React.ReactNode;
  /** Shown when rows are selected */
  bulkActions?: (rows: TData[], clearSelection: () => void) => React.ReactNode;
  /** CSV export filename (without extension) */
  exportFilename?: string;
  /** Additional column-level filter dropdowns */
  filterOptions?: FilterOption[];
  /** Active filters from parent (tab-style) */
  activeFilters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Empty state config */
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  /** Default page size */
  pageSize?: number;
  /** Disable row selection */
  noSelection?: boolean;
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
        {sorted === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : sorted === "desc" ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5" />
        )}
      </span>
    </button>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportToCsv<TData>(filename: string, columns: ColumnDef<TData, any>[], data: TData[]) {
  const headers = columns
    .filter((c) => c.id !== "__select" && c.id !== "__actions")
    .map((c) => (typeof c.header === "string" ? c.header : c.id ?? ""));

  const rows = data.map((row) =>
    columns
      .filter((c) => c.id !== "__select" && c.id !== "__actions")
      .map((c) => {
        const key = (c as any).accessorKey;
        if (!key) return "";
        const val = (row as any)[key];
        if (val === null || val === undefined) return "";
        return typeof val === "string" && val.includes(",") ? `"${val}"` : String(val);
      })
  );

  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  filterOptions,
  onRowClick,
  emptyIcon,
  emptyTitle = "No results found",
  emptyDescription,
  emptyAction,
  pageSize: defaultPageSize = 20,
  noSelection = false,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  // Reset page on filter/search change
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [globalFilter, columnFilters]);

  // Prepend selection column if not disabled
  const columns = useMemo<ColumnDef<TData, any>[]>(() => {
    if (noSelection || !bulkActions) return rawColumns;
    const selectCol: ColumnDef<TData, any> = {
      id: "__select",
      size: 40,
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
          }
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

  const selectedRows = table
    .getSelectedRowModel()
    .rows.map((r) => r.original);

  const clearSelection = useCallback(() => setRowSelection({}), []);

  const hasActiveFilters =
    globalFilter.length > 0 || columnFilters.length > 0;

  const clearAllFilters = () => {
    setGlobalFilter("");
    setColumnFilters([]);
  };

  const totalFiltered = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div className={cn("flex flex-col gap-0 bg-card border border-border rounded-xl overflow-hidden", className)}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/20 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-8 pr-7 text-[13px] bg-background border-border/60"
            aria-label="Search table"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Column filters */}
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
                  <SelectItem key={opt.value} value={opt.value} className="text-[12px]">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-8 px-2.5 gap-1.5 text-muted-foreground text-[12px] hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Result count */}
          {!loading && data.length > 0 && (
            <span className="text-[11px] text-muted-foreground hidden md:block tabular-nums">
              {totalFiltered.toLocaleString("en-IN")} result{totalFiltered !== 1 ? "s" : ""}
            </span>
          )}

          {/* Export */}
          {exportFilename && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(exportFilename, columns, table.getFilteredRowModel().rows.map((r) => r.original))}
              className="h-8 gap-1.5 text-[12px] border-border/60"
              aria-label="Export to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}

          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] border-border/60" aria-label="Column options">
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(v) => col.toggleVisibility(v)}
                    className="text-[12px] capitalize"
                  >
                    {typeof col.columnDef.header === "string"
                      ? col.columnDef.header
                      : col.id.replace(/_/g, " ")}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Custom actions */}
          {actions}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectedRows.length > 0 && bulkActions && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/8 dark:bg-primary/12 border-b border-primary/15">
          <Badge variant="secondary" className="gap-1 text-[11px]">
            {selectedRows.length} selected
          </Badge>
          <div className="flex items-center gap-2">
            {bulkActions(selectedRows, clearSelection)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            className="h-7 px-2 text-[11px] ml-auto text-muted-foreground"
          >
            Clear
          </Button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto scrollbar-thin flex-1">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border/60 bg-muted/30 sticky top-0 z-[1]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap"
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <SortButton
                        sorted={header.column.getIsSorted()}
                        onClick={header.column.getToggleSortingHandler() as any}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </SortButton>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/40">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded-full animate-pulse" style={{ width: `${60 + (j * 13) % 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  {emptyIcon ? (
                    <EmptyState
                      icon={emptyIcon}
                      title={emptyTitle}
                      description={emptyDescription}
                      action={emptyAction}
                      size="md"
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      {hasActiveFilters ? "No results match your filters." : emptyTitle}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "border-b border-border/40 last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/40",
                    row.getIsSelected() && "bg-primary/[0.04] dark:bg-primary/[0.08]"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {!loading && totalFiltered > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/60 bg-muted/20 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden sm:block">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPagination({ pageIndex: 0, pageSize: Number(v) });
              }}
            >
              <SelectTrigger className="h-7 w-[64px] text-[12px] border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-[12px]">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:block mr-2">
              {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalFiltered)} of{" "}
              {totalFiltered.toLocaleString("en-IN")}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-border/60"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-border/60"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[12px] font-medium text-foreground px-2 tabular-nums">
              {pageIndex + 1} / {pageCount || 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-border/60"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-border/60"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
