export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      areas: {
        Row: {
          area_code: string
          area_id: string
          area_name: string
          area_name_ar: string | null
          created_at: string
          date_added: string
          emirate: string
          is_active: boolean
          market_tier: string | null
          notes: string | null
          sub_zone: string | null
          updated_at: string
          zone_type: string
        }
        Insert: {
          area_code: string
          area_id?: string
          area_name: string
          area_name_ar?: string | null
          created_at?: string
          date_added?: string
          emirate?: string
          is_active?: boolean
          market_tier?: string | null
          notes?: string | null
          sub_zone?: string | null
          updated_at?: string
          zone_type: string
        }
        Update: {
          area_code?: string
          area_id?: string
          area_name?: string
          area_name_ar?: string | null
          created_at?: string
          date_added?: string
          emirate?: string
          is_active?: boolean
          market_tier?: string | null
          notes?: string | null
          sub_zone?: string | null
          updated_at?: string
          zone_type?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          log_id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string
          log_id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          log_id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      dc_access_logs: {
        Row: {
          created_at: string
          device: string | null
          email: string | null
          event: string
          id: string
          link_id: string
          mobile: string | null
          name: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          email?: string | null
          event?: string
          id?: string
          link_id: string
          mobile?: string | null
          name?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          email?: string | null
          event?: string
          id?: string
          link_id?: string
          mobile?: string | null
          name?: string | null
        }
        Relationships: []
      }
      dc_share_links: {
        Row: {
          created_at: string
          downloads: number
          expires_at: string | null
          id: string
          is_active: boolean
          mix_strategy: string
          overrides: Json | null
          plot_id: string
          plot_input: Json
          views: number
        }
        Insert: {
          created_at?: string
          downloads?: number
          expires_at?: string | null
          id: string
          is_active?: boolean
          mix_strategy: string
          overrides?: Json | null
          plot_id: string
          plot_input: Json
          views?: number
        }
        Update: {
          created_at?: string
          downloads?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          mix_strategy?: string
          overrides?: Json | null
          plot_id?: string
          plot_input?: Json
          views?: number
        }
        Relationships: []
      }
      developers: {
        Row: {
          active_areas: string[] | null
          created_at: string
          dev_name: string
          dev_name_ar: string | null
          developer_id: string
          notes: string | null
          rera_number: string | null
        }
        Insert: {
          active_areas?: string[] | null
          created_at?: string
          dev_name: string
          dev_name_ar?: string | null
          developer_id?: string
          notes?: string | null
          rera_number?: string | null
        }
        Update: {
          active_areas?: string[] | null
          created_at?: string
          dev_name?: string
          dev_name_ar?: string | null
          developer_id?: string
          notes?: string | null
          rera_number?: string | null
        }
        Relationships: []
      }
      development_parameters: {
        Row: {
          area_id: string
          bua_multiplier: number
          construction_psf: number | null
          created_at: string
          effective_date: string
          far_default: number | null
          far_max: number | null
          far_min: number | null
          has_studios: boolean
          notes: string | null
          param_id: string
          param_version: number
          sellable_area_pct: number
          service_charge_psf_max: number | null
          service_charge_psf_min: number | null
          superseded_date: string | null
          yield_est_max: number | null
          yield_est_min: number | null
        }
        Insert: {
          area_id: string
          bua_multiplier?: number
          construction_psf?: number | null
          created_at?: string
          effective_date?: string
          far_default?: number | null
          far_max?: number | null
          far_min?: number | null
          has_studios?: boolean
          notes?: string | null
          param_id?: string
          param_version?: number
          sellable_area_pct?: number
          service_charge_psf_max?: number | null
          service_charge_psf_min?: number | null
          superseded_date?: string | null
          yield_est_max?: number | null
          yield_est_min?: number | null
        }
        Update: {
          area_id?: string
          bua_multiplier?: number
          construction_psf?: number | null
          created_at?: string
          effective_date?: string
          far_default?: number | null
          far_max?: number | null
          far_min?: number | null
          has_studios?: boolean
          notes?: string | null
          param_id?: string
          param_version?: number
          sellable_area_pct?: number
          service_charge_psf_max?: number | null
          service_charge_psf_min?: number | null
          superseded_date?: string | null
          yield_est_max?: number | null
          yield_est_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "development_parameters_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["area_id"]
          },
        ]
      }
      dld_property_cache: {
        Row: {
          area: string | null
          certificate_no: string | null
          community: string | null
          data_source: string | null
          district: string | null
          geom: unknown
          id: string
          land_number: string
          land_status: string | null
          last_updated: string | null
          latitude: number
          longitude: number
          ownership_type: string | null
          property_type: string | null
          raw_data: Json | null
          size_sqft: number | null
          size_sqm: number | null
          title_deed_no: string | null
        }
        Insert: {
          area?: string | null
          certificate_no?: string | null
          community?: string | null
          data_source?: string | null
          district?: string | null
          geom?: unknown
          id?: string
          land_number: string
          land_status?: string | null
          last_updated?: string | null
          latitude: number
          longitude: number
          ownership_type?: string | null
          property_type?: string | null
          raw_data?: Json | null
          size_sqft?: number | null
          size_sqm?: number | null
          title_deed_no?: string | null
        }
        Update: {
          area?: string | null
          certificate_no?: string | null
          community?: string | null
          data_source?: string | null
          district?: string | null
          geom?: unknown
          id?: string
          land_number?: string
          land_status?: string | null
          last_updated?: string | null
          latitude?: number
          longitude?: number
          ownership_type?: string | null
          property_type?: string | null
          raw_data?: Json | null
          size_sqft?: number | null
          size_sqm?: number | null
          title_deed_no?: string | null
        }
        Relationships: []
      }
      market_snapshots: {
        Row: {
          area_id: string
          avg_rent_psf_yr: number | null
          created_at: string
          data_source: string | null
          gross_yield_est: number | null
          offplan_pct: number | null
          offplan_txns: number | null
          one_br_psf_avg: number | null
          one_br_psf_max: number | null
          one_br_psf_min: number | null
          period_end: string | null
          period_label: string
          period_start: string | null
          rental_contracts: number | null
          rental_renewal_pct: number | null
          resale_txns: number | null
          sales_txns_total: number | null
          snapshot_date: string
          snapshot_id: string
          studio_psf_avg: number | null
          studio_psf_max: number | null
          studio_psf_min: number | null
          three_br_psf_avg: number | null
          two_br_psf_avg: number | null
        }
        Insert: {
          area_id: string
          avg_rent_psf_yr?: number | null
          created_at?: string
          data_source?: string | null
          gross_yield_est?: number | null
          offplan_pct?: number | null
          offplan_txns?: number | null
          one_br_psf_avg?: number | null
          one_br_psf_max?: number | null
          one_br_psf_min?: number | null
          period_end?: string | null
          period_label: string
          period_start?: string | null
          rental_contracts?: number | null
          rental_renewal_pct?: number | null
          resale_txns?: number | null
          sales_txns_total?: number | null
          snapshot_date?: string
          snapshot_id?: string
          studio_psf_avg?: number | null
          studio_psf_max?: number | null
          studio_psf_min?: number | null
          three_br_psf_avg?: number | null
          two_br_psf_avg?: number | null
        }
        Update: {
          area_id?: string
          avg_rent_psf_yr?: number | null
          created_at?: string
          data_source?: string | null
          gross_yield_est?: number | null
          offplan_pct?: number | null
          offplan_txns?: number | null
          one_br_psf_avg?: number | null
          one_br_psf_max?: number | null
          one_br_psf_min?: number | null
          period_end?: string | null
          period_label?: string
          period_start?: string | null
          rental_contracts?: number | null
          rental_renewal_pct?: number | null
          resale_txns?: number | null
          sales_txns_total?: number | null
          snapshot_date?: string
          snapshot_id?: string
          studio_psf_avg?: number | null
          studio_psf_max?: number | null
          studio_psf_min?: number | null
          three_br_psf_avg?: number | null
          two_br_psf_avg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_snapshots_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["area_id"]
          },
        ]
      }
      project_unit_mix: {
        Row: {
          avg_size_sqft: number | null
          created_at: string
          mix_id: string
          pct_of_total: number | null
          price_from_aed: number | null
          project_id: string
          psf_max_aed: number | null
          psf_min_aed: number | null
          size_max_sqft: number | null
          size_min_sqft: number | null
          unit_count: number | null
          unit_type_id: string
        }
        Insert: {
          avg_size_sqft?: number | null
          created_at?: string
          mix_id?: string
          pct_of_total?: number | null
          price_from_aed?: number | null
          project_id: string
          psf_max_aed?: number | null
          psf_min_aed?: number | null
          size_max_sqft?: number | null
          size_min_sqft?: number | null
          unit_count?: number | null
          unit_type_id: string
        }
        Update: {
          avg_size_sqft?: number | null
          created_at?: string
          mix_id?: string
          pct_of_total?: number | null
          price_from_aed?: number | null
          project_id?: string
          psf_max_aed?: number | null
          psf_min_aed?: number | null
          size_max_sqft?: number | null
          size_min_sqft?: number | null
          unit_count?: number | null
          unit_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_unit_mix_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_unit_mix_unit_type_id_fkey"
            columns: ["unit_type_id"]
            isOneToOne: false
            referencedRelation: "unit_types"
            referencedColumns: ["unit_type_id"]
          },
        ]
      }
      projects: {
        Row: {
          area_id: string
          completion_quarter: string | null
          construction_pct: number | null
          construction_status: string | null
          created_at: string
          data_as_at: string | null
          data_source: string | null
          date_completion: string | null
          date_registered: string | null
          developer_id: string | null
          dld_project_number: string | null
          floors_formula: string | null
          is_furnished: boolean | null
          notes: string | null
          payment_construction: number | null
          payment_on_booking: number | null
          payment_on_handover: number | null
          payment_post_ho: number | null
          plot_area_sqft: number | null
          plot_area_sqm: number | null
          post_ho_months: number | null
          price_from_aed: number | null
          price_to_aed: number | null
          project_id: string
          project_name: string
          service_charge_psf: number | null
          service_chg_note: string | null
          total_units: number | null
          updated_at: string
        }
        Insert: {
          area_id: string
          completion_quarter?: string | null
          construction_pct?: number | null
          construction_status?: string | null
          created_at?: string
          data_as_at?: string | null
          data_source?: string | null
          date_completion?: string | null
          date_registered?: string | null
          developer_id?: string | null
          dld_project_number?: string | null
          floors_formula?: string | null
          is_furnished?: boolean | null
          notes?: string | null
          payment_construction?: number | null
          payment_on_booking?: number | null
          payment_on_handover?: number | null
          payment_post_ho?: number | null
          plot_area_sqft?: number | null
          plot_area_sqm?: number | null
          post_ho_months?: number | null
          price_from_aed?: number | null
          price_to_aed?: number | null
          project_id?: string
          project_name: string
          service_charge_psf?: number | null
          service_chg_note?: string | null
          total_units?: number | null
          updated_at?: string
        }
        Update: {
          area_id?: string
          completion_quarter?: string | null
          construction_pct?: number | null
          construction_status?: string | null
          created_at?: string
          data_as_at?: string | null
          data_source?: string | null
          date_completion?: string | null
          date_registered?: string | null
          developer_id?: string | null
          dld_project_number?: string | null
          floors_formula?: string | null
          is_furnished?: boolean | null
          notes?: string | null
          payment_construction?: number | null
          payment_on_booking?: number | null
          payment_on_handover?: number | null
          payment_post_ho?: number | null
          plot_area_sqft?: number | null
          plot_area_sqm?: number | null
          post_ho_months?: number | null
          price_from_aed?: number | null
          price_to_aed?: number | null
          project_id?: string
          project_name?: string
          service_charge_psf?: number | null
          service_chg_note?: string | null
          total_units?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "projects_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["developer_id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      unit_mix_templates: {
        Row: {
          area_id: string
          created_at: string
          pct_range_max: number
          pct_range_min: number
          pct_recommended: number
          rationale: string | null
          template_id: string
          template_name: string
          template_style: string | null
          unit_type_id: string
          viability_flag: string | null
        }
        Insert: {
          area_id: string
          created_at?: string
          pct_range_max: number
          pct_range_min: number
          pct_recommended: number
          rationale?: string | null
          template_id?: string
          template_name: string
          template_style?: string | null
          unit_type_id: string
          viability_flag?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string
          pct_range_max?: number
          pct_range_min?: number
          pct_recommended?: number
          rationale?: string | null
          template_id?: string
          template_name?: string
          template_style?: string | null
          unit_type_id?: string
          viability_flag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_mix_templates_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "unit_mix_templates_unit_type_id_fkey"
            columns: ["unit_type_id"]
            isOneToOne: false
            referencedRelation: "unit_types"
            referencedColumns: ["unit_type_id"]
          },
        ]
      }
      unit_types: {
        Row: {
          bedroom_count: number
          sort_order: number
          type_code: string
          type_name: string
          unit_type_id: string
        }
        Insert: {
          bedroom_count: number
          sort_order?: number
          type_code: string
          type_name: string
          unit_type_id?: string
        }
        Update: {
          bedroom_count?: number
          sort_order?: number
          type_code?: string
          type_name?: string
          unit_type_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      v_area_snapshot_latest: {
        Row: {
          active_projects: number | null
          area_code: string | null
          area_name: string | null
          avg_rent_psf_yr: number | null
          gross_yield_est: number | null
          market_tier: string | null
          offplan_pct: number | null
          one_br_psf_avg: number | null
          period_end: string | null
          period_label: string | null
          rental_contracts: number | null
          rental_renewal_pct: number | null
          resale_txns: number | null
          sales_txns_total: number | null
          studio_psf_avg: number | null
          total_pipeline_units: number | null
          two_br_psf_avg: number | null
          zone_type: string | null
        }
        Relationships: []
      }
      v_dld_freehold_plots: {
        Row: {
          area: string | null
          certificate_no: string | null
          community: string | null
          data_source: string | null
          district: string | null
          geom: unknown
          id: string | null
          land_number: string | null
          land_status: string | null
          last_updated: string | null
          latitude: number | null
          longitude: number | null
          ownership_type: string | null
          property_type: string | null
          raw_data: Json | null
          size_sqft: number | null
          size_sqm: number | null
          title_deed_no: string | null
        }
        Insert: {
          area?: string | null
          certificate_no?: string | null
          community?: string | null
          data_source?: string | null
          district?: string | null
          geom?: unknown
          id?: string | null
          land_number?: string | null
          land_status?: string | null
          last_updated?: string | null
          latitude?: number | null
          longitude?: number | null
          ownership_type?: string | null
          property_type?: string | null
          raw_data?: Json | null
          size_sqft?: number | null
          size_sqm?: number | null
          title_deed_no?: string | null
        }
        Update: {
          area?: string | null
          certificate_no?: string | null
          community?: string | null
          data_source?: string | null
          district?: string | null
          geom?: unknown
          id?: string | null
          land_number?: string | null
          land_status?: string | null
          last_updated?: string | null
          latitude?: number | null
          longitude?: number | null
          ownership_type?: string | null
          property_type?: string | null
          raw_data?: Json | null
          size_sqft?: number | null
          size_sqm?: number | null
          title_deed_no?: string | null
        }
        Relationships: []
      }
      v_project_unit_summary: {
        Row: {
          area_code: string | null
          area_name: string | null
          avg_size_sqft: number | null
          completion_quarter: string | null
          developer: string | null
          dld_project_number: string | null
          payment_on_booking: number | null
          payment_post_ho: number | null
          pct_of_total: number | null
          post_ho_months: number | null
          price_from_aed: number | null
          project_name: string | null
          psf_max_aed: number | null
          psf_min_aed: number | null
          service_charge_psf: number | null
          total_units: number | null
          type_code: string | null
          type_name: string | null
          unit_count: number | null
        }
        Relationships: []
      }
      v_recommended_mix_by_area: {
        Row: {
          area_code: string | null
          area_name: string | null
          market_tier: string | null
          pct_range_max: number | null
          pct_range_min: number | null
          pct_recommended: number | null
          rationale: string | null
          template_name: string | null
          template_style: string | null
          type_code: string | null
          type_name: string | null
          viability_flag: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      search_dld_plots_by_radius: {
        Args: { center_lat: number; center_lng: number; radius_meters: number }
        Returns: {
          area: string
          certificate_number: string
          distance_m: number
          land_number: string
          land_status: string
          latitude: number
          longitude: number
          plot_id: string
          property_type: string
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      upsert_dld_property: {
        Args: {
          p_area?: string
          p_land_number: string
          p_land_status?: string
          p_latitude: number
          p_longitude: number
          p_property_type?: string
          p_raw_data?: Json
          p_title_deed_no?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
