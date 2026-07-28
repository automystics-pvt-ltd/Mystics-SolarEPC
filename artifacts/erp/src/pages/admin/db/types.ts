export interface TableSummary {
  name: string;
  rowCount: number;
  size: string;
}

export interface TableRecord {
  [key: string]: unknown;
}

export interface ColumnSchema {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

export interface IndexSchema {
  index_name: string;
  is_unique: boolean;
  columns: string[];
}

export interface ForeignKeySchema {
  column_name: string;
  foreign_table: string;
  foreign_column: string;
  constraint_name: string;
}

export interface ReferencedBySchema {
  source_table: string;
  source_column: string;
  target_column: string;
  constraint_name: string;
}

export interface SchemaResult {
  columns: ColumnSchema[];
  indexes: IndexSchema[];
  foreignKeys: ForeignKeySchema[];
  referencedBy: ReferencedBySchema[];
}

export interface SqlResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  fields: string[];
}

export interface IntegrityViolation {
  constraintName: string;
  table: string;
  column: string;
  foreignTable: string;
  foreignColumn: string;
  violationCount: number;
  sampleIds: unknown[];
}

export interface MaintenanceStat {
  table_name: string;
  n_live_tup: number;
  n_dead_tup: number;
  last_autovacuum: string | null;
  last_autoanalyze: string | null;
  last_vacuum: string | null;
  last_analyze: string | null;
  n_mod_since_analyze: number;
  total_size: string;
}

export interface BulkOpsState {
  selectedIds: Set<string>;
  pkCol: string;
}
