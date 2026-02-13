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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ad_spend_log: {
        Row: {
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          created_at: string | null
          date: string
          id: string
          impressions: number | null
          source: string
          spend_eur: number
        }
        Insert: {
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          date: string
          id?: string
          impressions?: number | null
          source?: string
          spend_eur: number
        }
        Update: {
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          date?: string
          id?: string
          impressions?: number | null
          source?: string
          spend_eur?: number
        }
        Relationships: []
      }
      cal_bookings: {
        Row: {
          booking_kind: string | null
          cal_uid: string
          client_confirmation_sent_at: string | null
          created_at: string
          end_time: string | null
          event_type_id: number | null
          followup_sent_at: string | null
          id: string
          is_test: boolean
          last_trigger_event: string
          match_id: string | null
          metadata: Json
          organizer_username: string | null
          patient_id: string | null
          reminder_1h_sent_at: string | null
          reminder_24h_sent_at: string | null
          session_followup_sent_at: string | null
          source: string | null
          start_time: string | null
          status: string | null
          therapist_id: string | null
          therapist_notification_sent_at: string | null
          updated_at: string
        }
        Insert: {
          booking_kind?: string | null
          cal_uid: string
          client_confirmation_sent_at?: string | null
          created_at?: string
          end_time?: string | null
          event_type_id?: number | null
          followup_sent_at?: string | null
          id?: string
          is_test?: boolean
          last_trigger_event: string
          match_id?: string | null
          metadata?: Json
          organizer_username?: string | null
          patient_id?: string | null
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          session_followup_sent_at?: string | null
          source?: string | null
          start_time?: string | null
          status?: string | null
          therapist_id?: string | null
          therapist_notification_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          booking_kind?: string | null
          cal_uid?: string
          client_confirmation_sent_at?: string | null
          created_at?: string
          end_time?: string | null
          event_type_id?: number | null
          followup_sent_at?: string | null
          id?: string
          is_test?: boolean
          last_trigger_event?: string
          match_id?: string | null
          metadata?: Json
          organizer_username?: string | null
          patient_id?: string | null
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          session_followup_sent_at?: string | null
          source?: string | null
          start_time?: string | null
          status?: string | null
          therapist_id?: string | null
          therapist_notification_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cal_bookings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cal_bookings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cal_bookings_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      cal_slots_cache: {
        Row: {
          cached_at: string
          full_event_type_id: number | null
          full_slots: Json | null
          full_slots_count: number | null
          intro_event_type_id: number | null
          intro_slots: Json | null
          last_error: string | null
          next_full_date_iso: string | null
          next_full_time_label: string | null
          next_full_time_utc: string | null
          next_intro_date_iso: string | null
          next_intro_time_label: string | null
          next_intro_time_utc: string | null
          slots_count: number | null
          therapist_id: string
        }
        Insert: {
          cached_at?: string
          full_event_type_id?: number | null
          full_slots?: Json | null
          full_slots_count?: number | null
          intro_event_type_id?: number | null
          intro_slots?: Json | null
          last_error?: string | null
          next_full_date_iso?: string | null
          next_full_time_label?: string | null
          next_full_time_utc?: string | null
          next_intro_date_iso?: string | null
          next_intro_time_label?: string | null
          next_intro_time_utc?: string | null
          slots_count?: number | null
          therapist_id: string
        }
        Update: {
          cached_at?: string
          full_event_type_id?: number | null
          full_slots?: Json | null
          full_slots_count?: number | null
          intro_event_type_id?: number | null
          intro_slots?: Json | null
          last_error?: string | null
          next_full_date_iso?: string | null
          next_full_time_label?: string | null
          next_full_time_utc?: string | null
          next_intro_date_iso?: string | null
          next_intro_time_label?: string | null
          next_intro_time_utc?: string | null
          slots_count?: number | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cal_slots_cache_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: true
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          hashed_ip: string | null
          id: string
          level: string
          properties: Json
          type: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          hashed_ip?: string | null
          id?: string
          level?: string
          properties?: Json
          type: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          hashed_ip?: string | null
          id?: string
          level?: string
          properties?: Json
          type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      form_sessions: {
        Row: {
          created_at: string
          data: Json
          email: string | null
          expires_at: string | null
          id: string
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          email?: string | null
          expires_at?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          email?: string | null
          expires_at?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          commission_collected: number | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          notes: string | null
          patient_confirmed_at: string | null
          patient_id: string | null
          responded_at: string | null
          secure_uuid: string
          status: string | null
          therapist_contacted_at: string | null
          therapist_id: string | null
          therapist_responded_at: string | null
        }
        Insert: {
          commission_collected?: number | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          notes?: string | null
          patient_confirmed_at?: string | null
          patient_id?: string | null
          responded_at?: string | null
          secure_uuid?: string
          status?: string | null
          therapist_contacted_at?: string | null
          therapist_id?: string | null
          therapist_responded_at?: string | null
        }
        Update: {
          commission_collected?: number | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          notes?: string | null
          patient_confirmed_at?: string | null
          patient_id?: string | null
          responded_at?: string | null
          secure_uuid?: string
          status?: string | null
          therapist_contacted_at?: string | null
          therapist_id?: string | null
          therapist_responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_contacts: {
        Row: {
          city: string | null
          converted_at: string | null
          created_at: string
          email: string
          first_name: string | null
          first_sent_at: string | null
          follow_up_1_sent_at: string | null
          follow_up_2_sent_at: string | null
          full_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          opted_out_at: string | null
          phone: string | null
          replied_at: string | null
          source: string
          source_url: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          converted_at?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          first_sent_at?: string | null
          follow_up_1_sent_at?: string | null
          follow_up_2_sent_at?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          opted_out_at?: string | null
          phone?: string | null
          replied_at?: string | null
          source: string
          source_url?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          first_sent_at?: string | null
          follow_up_1_sent_at?: string | null
          follow_up_2_sent_at?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          opted_out_at?: string | null
          phone?: string | null
          replied_at?: string | null
          source?: string
          source_url?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          campaign_source: string | null
          campaign_variant: string | null
          created_at: string | null
          email: string | null
          id: string
          metadata: Json | null
          name: string | null
          phone_number: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          campaign_source?: string | null
          campaign_variant?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          phone_number?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          campaign_source?: string | null
          campaign_variant?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          phone_number?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: []
      }
      schwerpunkt_reference: {
        Row: {
          category_id: string
          category_label: string
          keywords: Json
          sort_order: number | null
        }
        Insert: {
          category_id: string
          category_label: string
          keywords?: Json
          sort_order?: number | null
        }
        Update: {
          category_id?: string
          category_label?: string
          keywords?: Json
          sort_order?: number | null
        }
        Relationships: []
      }
      session_blockers: {
        Row: {
          created_at: string
          id: string
          match_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_blockers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          clicks: number | null
          code: string
          created_at: string | null
          id: string
          last_clicked_at: string | null
          patient_id: string | null
          target_url: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          clicks?: number | null
          code: string
          created_at?: string | null
          id?: string
          last_clicked_at?: string | null
          patient_id?: string | null
          target_url: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          clicks?: number | null
          code?: string
          created_at?: string | null
          id?: string
          last_clicked_at?: string | null
          patient_id?: string | null
          target_url?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_links_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_gaps: {
        Row: {
          city: string | null
          created_at: string | null
          gender: string | null
          id: string
          modality: string | null
          patient_id: string | null
          schwerpunkt: string | null
          session_type: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          modality?: string | null
          patient_id?: string | null
          schwerpunkt?: string | null
          session_type?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          modality?: string | null
          patient_id?: string | null
          schwerpunkt?: string | null
          session_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_gaps_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_contracts: {
        Row: {
          contract_version: string
          created_at: string
          id: string
          ip_address: string | null
          signed_at: string
          therapist_id: string
          user_agent: string | null
        }
        Insert: {
          contract_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          signed_at?: string
          therapist_id: string
          user_agent?: string | null
        }
        Update: {
          contract_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          signed_at?: string
          therapist_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_contracts_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      therapists: {
        Row: {
          accepting_new: boolean
          approach_text: string | null
          availability_note: string | null
          cal_enabled: boolean
          cal_full_session_event_type_id: number | null
          cal_intro_event_type_id: number | null
          cal_user_id: number | null
          cal_username: string | null
          city: string | null
          created_at: string
          credential_tier: string
          email: string | null
          first_name: string | null
          gender: string | null
          id: string
          languages: Json | null
          last_name: string | null
          metadata: Json
          modalities: Json
          phone: string | null
          photo_url: string | null
          schwerpunkte: Json
          session_preferences: Json
          slug: string | null
          status: string
          typical_rate: number | null
          updated_at: string
          verification_notes: string | null
        }
        Insert: {
          accepting_new?: boolean
          approach_text?: string | null
          availability_note?: string | null
          cal_enabled?: boolean
          cal_full_session_event_type_id?: number | null
          cal_intro_event_type_id?: number | null
          cal_user_id?: number | null
          cal_username?: string | null
          city?: string | null
          created_at?: string
          credential_tier?: string
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          languages?: Json | null
          last_name?: string | null
          metadata?: Json
          modalities?: Json
          phone?: string | null
          photo_url?: string | null
          schwerpunkte?: Json
          session_preferences?: Json
          slug?: string | null
          status?: string
          typical_rate?: number | null
          updated_at?: string
          verification_notes?: string | null
        }
        Update: {
          accepting_new?: boolean
          approach_text?: string | null
          availability_note?: string | null
          cal_enabled?: boolean
          cal_full_session_event_type_id?: number | null
          cal_intro_event_type_id?: number | null
          cal_user_id?: number | null
          cal_username?: string | null
          city?: string | null
          created_at?: string
          credential_tier?: string
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          languages?: Json | null
          last_name?: string | null
          metadata?: Json
          modalities?: Json
          phone?: string | null
          photo_url?: string | null
          schwerpunkte?: Json
          session_preferences?: Json
          slug?: string | null
          status?: string
          typical_rate?: number | null
          updated_at?: string
          verification_notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
