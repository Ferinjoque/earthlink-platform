/**
 * Generated Supabase database types.
 * Run `supabase gen types typescript --local > src/types/database.ts` to regenerate.
 * Manually maintained until a live Supabase project is connected.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      // ------------------------------------------------------------------
      // Reference Tables
      // ------------------------------------------------------------------
      fuel_types: {
        Row: {
          id: string;
          code: string;
          label: string;
          scope: 1;
          activity_kind: 'stationary_combustion' | 'mobile_combustion';
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          label: string;
          scope: 1;
          activity_kind: 'stationary_combustion' | 'mobile_combustion';
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          label?: string;
          scope?: 1;
          activity_kind?: 'stationary_combustion' | 'mobile_combustion';
          created_at?: string;
        };
      };

      refrigerants: {
        Row: {
          id: string;
          code: string;
          label: string;
          gwp_ar6: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          label: string;
          gwp_ar6: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          label?: string;
          gwp_ar6?: number;
          created_at?: string;
        };
      };

      grid_regions: {
        Row: {
          id: string;
          code: string;
          label: string;
          country: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          label: string;
          country: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          label?: string;
          country?: string;
          created_at?: string;
        };
      };

      emission_factors: {
        Row: {
          id: string;
          source_type: EmissionSourceType;
          fuel_type_id: string | null;
          refrigerant_id: string | null;
          grid_region_id: string | null;
          co2e_per_unit: number;
          unit: string;
          scope: 1 | 2;
          source_db: EmissionFactorSource;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
          // Derived by trigger (migration 006)
          activity_key: string | null;
          set_id: string | null;
          set_version: string | null;
        };
        Insert: {
          id?: string;
          source_type: EmissionSourceType;
          fuel_type_id?: string | null;
          refrigerant_id?: string | null;
          grid_region_id?: string | null;
          co2e_per_unit: number;
          unit: string;
          scope: 1 | 2;
          source_db: EmissionFactorSource;
          valid_from: string;
          valid_to?: string | null;
          created_at?: string;
          activity_key?: string | null;
          set_id?: string | null;
          set_version?: string | null;
        };
        Update: {
          id?: string;
          source_type?: EmissionSourceType;
          fuel_type_id?: string | null;
          refrigerant_id?: string | null;
          grid_region_id?: string | null;
          co2e_per_unit?: number;
          unit?: string;
          scope?: 1 | 2;
          source_db?: EmissionFactorSource;
          valid_from?: string;
          valid_to?: string | null;
          created_at?: string;
          activity_key?: string | null;
          set_id?: string | null;
          set_version?: string | null;
        };
      };

      unit_conversions: {
        Row: {
          id: string;
          from_unit: string;
          to_unit: string;
          factor: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          from_unit: string;
          to_unit: string;
          factor: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          from_unit?: string;
          to_unit?: string;
          factor?: number;
          notes?: string | null;
          created_at?: string;
        };
      };

      // ------------------------------------------------------------------
      // Access Tables
      // ------------------------------------------------------------------
      organizations: {
        Row: {
          id: string;
          name: string;
          industry: string;
          ruc: string | null;
          country: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          industry: string;
          ruc?: string | null;
          country?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          industry?: string;
          ruc?: string | null;
          country?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      suppliers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          category: string;
          contact_email: string | null;
          ruc: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          category: string;
          contact_email?: string | null;
          ruc?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          category?: string;
          contact_email?: string | null;
          ruc?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
      };

      memberships: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          role: MembershipRole;
          supplier_id: string | null;
          invited_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          role: MembershipRole;
          supplier_id?: string | null;
          invited_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          role?: MembershipRole;
          supplier_id?: string | null;
          invited_at?: string;
          accepted_at?: string | null;
        };
      };

      // ------------------------------------------------------------------
      // Transactional Tables
      // ------------------------------------------------------------------
      reporting_periods: {
        Row: {
          id: string;
          supplier_id: string;
          label: string;
          start_date: string;
          end_date: string;
          status: PeriodStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          label: string;
          start_date: string;
          end_date: string;
          status?: PeriodStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          label?: string;
          start_date?: string;
          end_date?: string;
          status?: PeriodStatus;
          created_at?: string;
          updated_at?: string;
        };
      };

      activity_entries: {
        Row: {
          id: string;
          reporting_period_id: string;
          source_type: EmissionSourceType;
          activity_kind: Json;
          raw_quantity: number;
          raw_unit: string;
          fuel_type_id: string | null;
          refrigerant_id: string | null;
          grid_region_id: string | null;
          notes: string | null;
          status: ActivityEntryStatus;
          submitted_by: string | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporting_period_id: string;
          source_type: EmissionSourceType;
          activity_kind: Json;
          raw_quantity: number;
          raw_unit: string;
          fuel_type_id?: string | null;
          refrigerant_id?: string | null;
          grid_region_id?: string | null;
          notes?: string | null;
          status?: ActivityEntryStatus;
          submitted_by?: string | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reporting_period_id?: string;
          source_type?: EmissionSourceType;
          activity_kind?: Json;
          raw_quantity?: number;
          raw_unit?: string;
          fuel_type_id?: string | null;
          refrigerant_id?: string | null;
          grid_region_id?: string | null;
          notes?: string | null;
          status?: ActivityEntryStatus;
          submitted_by?: string | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      emission_results: {
        Row: {
          id: string;
          activity_entry_id: string;
          reporting_period_id: string;
          scope: 1 | 2;
          co2e_kg: number;
          factor_used: number;
          factor_unit: string;
          normalized_quantity: number;
          normalized_unit: string;
          calc_hash: string;
          calc_version: string;
          emission_factor_id: string | null;
          calculated_at: string;
          calculated_by: string | null;
        };
        Insert: {
          id?: string;
          activity_entry_id: string;
          reporting_period_id: string;
          scope: 1 | 2;
          co2e_kg: number;
          factor_used: number;
          factor_unit: string;
          normalized_quantity: number;
          normalized_unit: string;
          calc_hash: string;
          calc_version: string;
          emission_factor_id?: string | null;
          calculated_at?: string;
          calculated_by?: string | null;
        };
        Update: never;
      };

      evidence_files: {
        Row: {
          id: string;
          activity_entry_id: string;
          storage_path: string;
          mime_type: string;
          file_size_bytes: number;
          original_name: string;
          sha256: string;
          uploaded_by: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          activity_entry_id: string;
          storage_path: string;
          mime_type: string;
          file_size_bytes: number;
          original_name: string;
          sha256: string;
          uploaded_by?: string | null;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          activity_entry_id?: string;
          storage_path?: string;
          mime_type?: string;
          file_size_bytes?: number;
          original_name?: string;
          sha256?: string;
          uploaded_by?: string | null;
          uploaded_at?: string;
        };
      };

      anomaly_flags: {
        Row: {
          id: string;
          activity_entry_id: string;
          detector: AnomalyDetector;
          severity: AnomalySeverity;
          z_score: number | null;
          threshold_used: number | null;
          message: string;
          is_resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
          flagged_at: string;
        };
        Insert: {
          id?: string;
          activity_entry_id: string;
          detector: AnomalyDetector;
          severity: AnomalySeverity;
          z_score?: number | null;
          threshold_used?: number | null;
          message: string;
          is_resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          flagged_at?: string;
        };
        Update: {
          id?: string;
          activity_entry_id?: string;
          detector?: AnomalyDetector;
          severity?: AnomalySeverity;
          z_score?: number | null;
          threshold_used?: number | null;
          message?: string;
          is_resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          flagged_at?: string;
        };
      };

      // ------------------------------------------------------------------
      // Audit Tables (append-only)
      // ------------------------------------------------------------------
      audit_log: {
        Row: {
          id: string;
          action: string;
          table_name: string | null;
          record_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          performed_by: string | null;
          performed_at: string;
          ip_address: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          action: string;
          table_name?: string | null;
          record_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          performed_by?: string | null;
          performed_at?: string;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Update: never;
      };

      report_exports: {
        Row: {
          id: string;
          organization_id: string;
          reporting_period_ids: string[];
          format: ReportFormat;
          scope_filter: number[];
          file_url: string;
          file_sha256: string;
          generated_by: string | null;
          generated_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          reporting_period_ids: string[];
          format: ReportFormat;
          scope_filter?: number[];
          file_url: string;
          file_sha256: string;
          generated_by?: string | null;
          generated_at?: string;
          expires_at?: string | null;
        };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// ---------------------------------------------------------------------------
// Domain enums — single source of truth for DB + application layer
// ---------------------------------------------------------------------------
export type EmissionSourceType =
  | 'stationary_combustion'
  | 'mobile_combustion'
  | 'purchased_electricity'
  | 'purchased_steam'
  | 'fugitive';

export type PeriodStatus = 'open' | 'calculating' | 'under_review' | 'locked';

export type ActivityEntryStatus = 'draft' | 'submitted' | 'validated' | 'rejected';

export type MembershipRole = 'supplier' | 'consultant' | 'admin';

export type AnomalyDetector = 'zscore_monthly' | 'unit_mismatch' | 'factor_outlier';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export type ReportFormat = 'pdf' | 'csv' | 'json';

export type EmissionFactorSource = 'IPCC_AR6' | 'DEFRA_2024' | 'MINEM_2023';

// ---------------------------------------------------------------------------
// Convenience row type aliases
// ---------------------------------------------------------------------------
export type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
export type SupplierRow = Database['public']['Tables']['suppliers']['Row'];
export type MembershipRow = Database['public']['Tables']['memberships']['Row'];
export type ReportingPeriodRow = Database['public']['Tables']['reporting_periods']['Row'];
export type ActivityEntryRow = Database['public']['Tables']['activity_entries']['Row'];
export type EmissionResultRow = Database['public']['Tables']['emission_results']['Row'];
export type EmissionFactorRow = Database['public']['Tables']['emission_factors']['Row'];
export type EvidenceFileRow = Database['public']['Tables']['evidence_files']['Row'];
export type AnomalyFlagRow = Database['public']['Tables']['anomaly_flags']['Row'];
export type AuditLogRow = Database['public']['Tables']['audit_log']['Row'];
export type ReportExportRow = Database['public']['Tables']['report_exports']['Row'];
export type FuelTypeRow = Database['public']['Tables']['fuel_types']['Row'];
export type RefrigerantRow = Database['public']['Tables']['refrigerants']['Row'];
export type GridRegionRow = Database['public']['Tables']['grid_regions']['Row'];
export type UnitConversionRow = Database['public']['Tables']['unit_conversions']['Row'];
