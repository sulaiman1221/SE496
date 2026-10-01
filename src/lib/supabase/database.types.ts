// Generated from the Supabase database schema. Do not edit by hand.

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          checked_in_at: string | null
          created_at: string
          exam_id: string
          id: string
          seat_id: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          exam_id: string
          id?: string
          seat_id?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          exam_id?: string
          id?: string
          seat_id?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exam_id_student_id_fkey"
            columns: ["exam_id", "student_id"]
            isOneToOne: true
            referencedRelation: "seat_assignments"
            referencedColumns: ["exam_id", "student_id"]
          },
          {
            foreignKeyName: "attendance_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          course_code: string
          course_name: string
          created_at: string
          id: string
        }
        Insert: {
          course_code: string
          course_name: string
          created_at?: string
          id?: string
        }
        Update: {
          course_code?: string
          course_name?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_courses: {
        Row: {
          course_id: string
          exam_id: string
          id: string
        }
        Insert: {
          course_id: string
          exam_id: string
          id?: string
        }
        Update: {
          course_id?: string
          exam_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_courses_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string | null
          exam_date: string
          id: string
          room_id: string
          seating_constraints: Json
          start_time: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          exam_date: string
          id?: string
          room_id: string
          seating_constraints?: Json
          start_time: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          exam_date?: string
          id?: string
          room_id?: string
          seating_constraints?: Json
          start_time?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      readers: {
        Row: {
          created_at: string
          hardware_identifier: string
          id: string
          is_active: boolean
          label: string | null
          seat_id: string | null
        }
        Insert: {
          created_at?: string
          hardware_identifier: string
          id?: string
          is_active?: boolean
          label?: string | null
          seat_id?: string | null
        }
        Update: {
          created_at?: string
          hardware_identifier?: string
          id?: string
          is_active?: boolean
          label?: string | null
          seat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "readers_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: true
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          id: string
          layout_type: string
          name: string
        }
        Insert: {
          capacity: number
          created_at?: string
          id?: string
          layout_type?: string
          name: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          layout_type?: string
          name?: string
        }
        Relationships: []
      }
      seat_assignments: {
        Row: {
          course_id: string
          created_at: string
          exam_id: string
          id: string
          seat_id: string
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          exam_id: string
          id?: string
          seat_id: string
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          exam_id?: string
          id?: string
          seat_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_assignments_exam_id_course_id_fkey"
            columns: ["exam_id", "course_id"]
            isOneToOne: false
            referencedRelation: "exam_courses"
            referencedColumns: ["exam_id", "course_id"]
          },
          {
            foreignKeyName: "seat_assignments_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_assignments_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_assignments_student_id_course_id_fkey"
            columns: ["student_id", "course_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["student_id", "course_id"]
          },
          {
            foreignKeyName: "seat_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      seats: {
        Row: {
          column_index: number
          created_at: string
          id: string
          is_active: boolean
          room_id: string
          row_index: number
          seat_code: string
        }
        Insert: {
          column_index: number
          created_at?: string
          id?: string
          is_active?: boolean
          room_id: string
          row_index: number
          seat_code: string
        }
        Update: {
          column_index?: number
          created_at?: string
          id?: string
          is_active?: boolean
          room_id?: string
          row_index?: number
          seat_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "seats_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          institution_student_id: string
          rfid_uid: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          institution_student_id: string
          rfid_uid?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          institution_student_id?: string
          rfid_uid?: string | null
          updated_at?: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
