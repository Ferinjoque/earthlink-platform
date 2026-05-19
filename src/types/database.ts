export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.4';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity_entries: {
        Row: {
          activity_kind: Json;
          corrects_entry_id: string | null;
          created_at: string;
          fuel_type_id: string | null;
          grid_region_id: string | null;
          id: string;
          notes: string | null;
          raw_quantity: number;
          raw_unit: string;
          refrigerant_id: string | null;
          reporting_period_id: string;
          source_type: string;
          status: string;
          submitted_at: string | null;
          submitted_by: string | null;
          updated_at: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          activity_kind: Json;
          corrects_entry_id?: string | null;
          created_at?: string;
          fuel_type_id?: string | null;
          grid_region_id?: string | null;
          id?: string;
          notes?: string | null;
          raw_quantity: number;
          raw_unit: string;
          refrigerant_id?: string | null;
          reporting_period_id: string;
          source_type: string;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          activity_kind?: Json;
          corrects_entry_id?: string | null;
          created_at?: string;
          fuel_type_id?: string | null;
          grid_region_id?: string | null;
          id?: string;
          notes?: string | null;
          raw_quantity?: number;
          raw_unit?: string;
          refrigerant_id?: string | null;
          reporting_period_id?: string;
          source_type?: string;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_entries_fuel_type_id_fkey';
            columns: ['fuel_type_id'];
            isOneToOne: false;
            referencedRelation: 'fuel_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_entries_grid_region_id_fkey';
            columns: ['grid_region_id'];
            isOneToOne: false;
            referencedRelation: 'grid_regions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_entries_refrigerant_id_fkey';
            columns: ['refrigerant_id'];
            isOneToOne: false;
            referencedRelation: 'refrigerants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_entries_reporting_period_id_fkey';
            columns: ['reporting_period_id'];
            isOneToOne: false;
            referencedRelation: 'reporting_periods';
            referencedColumns: ['id'];
          },
        ];
      };
      anomaly_flags: {
        Row: {
          activity_entry_id: string;
          detector: string;
          flagged_at: string;
          id: string;
          is_resolved: boolean;
          message: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: string;
          threshold_used: number | null;
          z_score: number | null;
        };
        Insert: {
          activity_entry_id: string;
          detector: string;
          flagged_at?: string;
          id?: string;
          is_resolved?: boolean;
          message: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity: string;
          threshold_used?: number | null;
          z_score?: number | null;
        };
        Update: {
          activity_entry_id?: string;
          detector?: string;
          flagged_at?: string;
          id?: string;
          is_resolved?: boolean;
          message?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          threshold_used?: number | null;
          z_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'anomaly_flags_activity_entry_id_fkey';
            columns: ['activity_entry_id'];
            isOneToOne: false;
            referencedRelation: 'activity_entries';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          id: string;
          ip_address: unknown;
          new_values: Json | null;
          old_values: Json | null;
          performed_at: string;
          performed_by: string | null;
          record_id: string | null;
          table_name: string | null;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          id?: string;
          ip_address?: unknown;
          new_values?: Json | null;
          old_values?: Json | null;
          performed_at?: string;
          performed_by?: string | null;
          record_id?: string | null;
          table_name?: string | null;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          id?: string;
          ip_address?: unknown;
          new_values?: Json | null;
          old_values?: Json | null;
          performed_at?: string;
          performed_by?: string | null;
          record_id?: string | null;
          table_name?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      emission_factors: {
        Row: {
          activity_key: string | null;
          co2e_per_unit: number;
          created_at: string;
          fuel_type_id: string | null;
          grid_region_id: string | null;
          id: string;
          refrigerant_id: string | null;
          scope: number;
          set_id: string | null;
          set_version: string | null;
          source_db: string;
          source_type: string;
          unit: string;
          valid_from: string;
          valid_to: string | null;
        };
        Insert: {
          activity_key?: string | null;
          co2e_per_unit: number;
          created_at?: string;
          fuel_type_id?: string | null;
          grid_region_id?: string | null;
          id?: string;
          refrigerant_id?: string | null;
          scope: number;
          set_id?: string | null;
          set_version?: string | null;
          source_db: string;
          source_type: string;
          unit: string;
          valid_from: string;
          valid_to?: string | null;
        };
        Update: {
          activity_key?: string | null;
          co2e_per_unit?: number;
          created_at?: string;
          fuel_type_id?: string | null;
          grid_region_id?: string | null;
          id?: string;
          refrigerant_id?: string | null;
          scope?: number;
          set_id?: string | null;
          set_version?: string | null;
          source_db?: string;
          source_type?: string;
          unit?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'emission_factors_fuel_type_id_fkey';
            columns: ['fuel_type_id'];
            isOneToOne: false;
            referencedRelation: 'fuel_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'emission_factors_grid_region_id_fkey';
            columns: ['grid_region_id'];
            isOneToOne: false;
            referencedRelation: 'grid_regions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'emission_factors_refrigerant_id_fkey';
            columns: ['refrigerant_id'];
            isOneToOne: false;
            referencedRelation: 'refrigerants';
            referencedColumns: ['id'];
          },
        ];
      };
      emission_results: {
        Row: {
          activity_entry_id: string;
          calc_hash: string;
          calc_version: string;
          calculated_at: string;
          calculated_by: string | null;
          co2e_kg: number;
          emission_factor_id: string | null;
          factor_unit: string;
          factor_used: number;
          id: string;
          normalized_quantity: number;
          normalized_unit: string;
          reporting_period_id: string;
          scope: number;
        };
        Insert: {
          activity_entry_id: string;
          calc_hash: string;
          calc_version: string;
          calculated_at?: string;
          calculated_by?: string | null;
          co2e_kg: number;
          emission_factor_id?: string | null;
          factor_unit: string;
          factor_used: number;
          id?: string;
          normalized_quantity: number;
          normalized_unit: string;
          reporting_period_id: string;
          scope: number;
        };
        Update: {
          activity_entry_id?: string;
          calc_hash?: string;
          calc_version?: string;
          calculated_at?: string;
          calculated_by?: string | null;
          co2e_kg?: number;
          emission_factor_id?: string | null;
          factor_unit?: string;
          factor_used?: number;
          id?: string;
          normalized_quantity?: number;
          normalized_unit?: string;
          reporting_period_id?: string;
          scope?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'emission_results_activity_entry_id_fkey';
            columns: ['activity_entry_id'];
            isOneToOne: false;
            referencedRelation: 'activity_entries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'emission_results_emission_factor_id_fkey';
            columns: ['emission_factor_id'];
            isOneToOne: false;
            referencedRelation: 'emission_factors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'emission_results_reporting_period_id_fkey';
            columns: ['reporting_period_id'];
            isOneToOne: false;
            referencedRelation: 'reporting_periods';
            referencedColumns: ['id'];
          },
        ];
      };
      evidence_files: {
        Row: {
          activity_entry_id: string;
          file_size_bytes: number;
          id: string;
          mime_type: string;
          original_name: string;
          sha256: string;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          activity_entry_id: string;
          file_size_bytes: number;
          id?: string;
          mime_type: string;
          original_name: string;
          sha256: string;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          activity_entry_id?: string;
          file_size_bytes?: number;
          id?: string;
          mime_type?: string;
          original_name?: string;
          sha256?: string;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'evidence_files_activity_entry_id_fkey';
            columns: ['activity_entry_id'];
            isOneToOne: false;
            referencedRelation: 'activity_entries';
            referencedColumns: ['id'];
          },
        ];
      };
      fuel_types: {
        Row: {
          activity_kind: string;
          code: string;
          created_at: string;
          id: string;
          label: string;
          scope: number;
        };
        Insert: {
          activity_kind: string;
          code: string;
          created_at?: string;
          id?: string;
          label: string;
          scope: number;
        };
        Update: {
          activity_kind?: string;
          code?: string;
          created_at?: string;
          id?: string;
          label?: string;
          scope?: number;
        };
        Relationships: [];
      };
      grid_regions: {
        Row: {
          code: string;
          country: string;
          created_at: string;
          id: string;
          label: string;
        };
        Insert: {
          code: string;
          country: string;
          created_at?: string;
          id?: string;
          label: string;
        };
        Update: {
          code?: string;
          country?: string;
          created_at?: string;
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          accepted_at: string | null;
          id: string;
          invited_at: string;
          organization_id: string;
          role: string;
          supplier_id: string | null;
          user_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          id?: string;
          invited_at?: string;
          organization_id: string;
          role: string;
          supplier_id?: string | null;
          user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          id?: string;
          invited_at?: string;
          organization_id?: string;
          role?: string;
          supplier_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'memberships_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_supplier_id_fkey';
            columns: ['supplier_id'];
            isOneToOne: false;
            referencedRelation: 'suppliers';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          country: string;
          created_at: string;
          id: string;
          industry: string;
          name: string;
          ruc: string | null;
          updated_at: string;
        };
        Insert: {
          country?: string;
          created_at?: string;
          id?: string;
          industry: string;
          name: string;
          ruc?: string | null;
          updated_at?: string;
        };
        Update: {
          country?: string;
          created_at?: string;
          id?: string;
          industry?: string;
          name?: string;
          ruc?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      refrigerants: {
        Row: {
          code: string;
          created_at: string;
          gwp_ar6: number;
          id: string;
          label: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          gwp_ar6: number;
          id?: string;
          label: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          gwp_ar6?: number;
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
      report_exports: {
        Row: {
          expires_at: string | null;
          file_sha256: string;
          file_url: string;
          format: string;
          generated_at: string;
          generated_by: string | null;
          id: string;
          organization_id: string;
          reporting_period_ids: string[];
          scope_filter: number[];
        };
        Insert: {
          expires_at?: string | null;
          file_sha256: string;
          file_url: string;
          format: string;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          organization_id: string;
          reporting_period_ids: string[];
          scope_filter?: number[];
        };
        Update: {
          expires_at?: string | null;
          file_sha256?: string;
          file_url?: string;
          format?: string;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          organization_id?: string;
          reporting_period_ids?: string[];
          scope_filter?: number[];
        };
        Relationships: [
          {
            foreignKeyName: 'report_exports_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      reporting_periods: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          label: string;
          start_date: string;
          status: string;
          supplier_id: string;
          unlock_reason: string | null;
          unlocked_at: string | null;
          unlocked_by: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_date: string;
          id?: string;
          label: string;
          start_date: string;
          status?: string;
          supplier_id: string;
          unlock_reason?: string | null;
          unlocked_at?: string | null;
          unlocked_by?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          label?: string;
          start_date?: string;
          status?: string;
          supplier_id?: string;
          unlock_reason?: string | null;
          unlocked_at?: string | null;
          unlocked_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reporting_periods_supplier_id_fkey';
            columns: ['supplier_id'];
            isOneToOne: false;
            referencedRelation: 'suppliers';
            referencedColumns: ['id'];
          },
        ];
      };
      suppliers: {
        Row: {
          archived_at: string | null;
          category: string;
          contact_email: string | null;
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
          ruc: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          category: string;
          contact_email?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
          ruc?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          category?: string;
          contact_email?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          ruc?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'suppliers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      unit_conversions: {
        Row: {
          created_at: string;
          factor: number;
          from_unit: string;
          id: string;
          notes: string | null;
          to_unit: string;
        };
        Insert: {
          created_at?: string;
          factor: number;
          from_unit: string;
          id?: string;
          notes?: string | null;
          to_unit: string;
        };
        Update: {
          created_at?: string;
          factor?: number;
          from_unit?: string;
          id?: string;
          notes?: string | null;
          to_unit?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      fn_is_org_member: { Args: { p_org_id: string }; Returns: boolean };
      fn_user_role_in_org: { Args: { p_org_id: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          format: string;
          id: string;
          name: string;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name?: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Relationships: [];
      };
      buckets_vectors: {
        Row: {
          created_at: string;
          id: string;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Relationships: [];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'objects_bucketId_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          metadata: Json | null;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_parts_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 's3_multipart_uploads_parts_upload_id_fkey';
            columns: ['upload_id'];
            isOneToOne: false;
            referencedRelation: 's3_multipart_uploads';
            referencedColumns: ['id'];
          },
        ];
      };
      vector_indexes: {
        Row: {
          bucket_id: string;
          created_at: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id: string;
          metadata_configuration: Json | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id?: string;
          metadata_configuration?: Json | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          data_type?: string;
          dimension?: number;
          distance_metric?: string;
          id?: string;
          metadata_configuration?: Json | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vector_indexes_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets_vectors';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] };
        Returns: boolean;
      };
      allow_only_operation: {
        Args: { expected_operation: string };
        Returns: boolean;
      };
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string };
        Returns: undefined;
      };
      extension: { Args: { name: string }; Returns: string };
      filename: { Args: { name: string }; Returns: string };
      foldername: { Args: { name: string }; Returns: string[] };
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string };
        Returns: string;
      };
      get_size_by_bucket: {
        Args: never;
        Returns: {
          bucket_id: string;
          size: number;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_token?: string;
          prefix_param: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      operation: { Args: never; Returns: string };
      search: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_by_timestamp: {
        Args: {
          p_bucket_id: string;
          p_level: number;
          p_limit: number;
          p_prefix: string;
          p_sort_column: string;
          p_sort_column_after: string;
          p_sort_order: string;
          p_start_after: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_v2: {
        Args: {
          bucket_name: string;
          levels?: number;
          limits?: number;
          prefix: string;
          sort_column?: string;
          sort_column_after?: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      buckettype: 'STANDARD' | 'ANALYTICS' | 'VECTOR';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ['STANDARD', 'ANALYTICS', 'VECTOR'],
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Convenience row type aliases (codebase-level)
// ---------------------------------------------------------------------------
export type Json2 = Json; // re-export alias

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

// ---------------------------------------------------------------------------
// Application-level string literal unions
// ---------------------------------------------------------------------------
export type EmissionSourceType =
  | 'stationary_combustion'
  | 'mobile_combustion'
  | 'purchased_electricity'
  | 'purchased_steam'
  | 'fugitive'
  | 'water_use'
  | 'waste';

export type ActivityEntryStatus = 'draft' | 'submitted' | 'validated' | 'rejected';

export type PeriodStatus = 'open' | 'calculating' | 'under_review' | 'locked';

export type MembershipRole = 'admin' | 'consultant' | 'supplier';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export type AnomalyDetector = 'zscore_monthly' | 'unit_mismatch' | 'factor_outlier';

export type ReportFormat = 'pdf' | 'csv' | 'json';

export type EmissionFactorSource = 'IPCC_AR6' | 'DEFRA_2024' | 'MINEM_2023';
