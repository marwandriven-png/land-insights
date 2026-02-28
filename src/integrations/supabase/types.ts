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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
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
