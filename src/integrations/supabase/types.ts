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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_evaluations: {
        Row: {
          attempt_id: string
          confidence: number
          created_at: string | null
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          dimensions: Json
          feedback: string
          id: string
          modified_at: string | null
          modified_by: string | null
          question_id: string
          score: number
        }
        Insert: {
          attempt_id: string
          confidence?: number
          created_at?: string | null
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          dimensions?: Json
          feedback?: string
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          question_id: string
          score?: number
        }
        Update: {
          attempt_id?: string
          confidence?: number
          created_at?: string | null
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          dimensions?: Json
          feedback?: string
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          question_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_evaluations_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempts: {
        Row: {
          assessment_id: string
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          employee_id: string
          evaluated_at: string | null
          id: string
          modified_at: string | null
          modified_by: string | null
          paused_at: string | null
          remaining_seconds: number | null
          started_at: string
          status: string
          submitted_at: string | null
          tenant_id: string
          total_ai_score: number | null
        }
        Insert: {
          assessment_id: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          employee_id: string
          evaluated_at?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          paused_at?: string | null
          remaining_seconds?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          tenant_id: string
          total_ai_score?: number | null
        }
        Update: {
          assessment_id?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          employee_id?: string
          evaluated_at?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          paused_at?: string | null
          remaining_seconds?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          total_ai_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          created_at: string | null
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          id: string
          modified_at: string | null
          modified_by: string | null
          question_id: string
          skill_id: string
          target_level: string
        }
        Insert: {
          assessment_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          question_id: string
          skill_id: string
          target_level: string
        }
        Update: {
          assessment_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          question_id?: string
          skill_id?: string
          target_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          created_at: string
          created_by: string | null
          cycle_id: string | null
          deleted_by: string | null
          deleted_on: string | null
          domain_id: string
          duration_minutes: number
          employee_id: string
          id: string
          is_reassessment: boolean
          modified_at: string | null
          modified_by: string | null
          parent_assessment_id: string | null
          status: string
          submission_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cycle_id?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          domain_id: string
          duration_minutes?: number
          employee_id: string
          id?: string
          is_reassessment?: boolean
          modified_at?: string | null
          modified_by?: string | null
          parent_assessment_id?: string | null
          status?: string
          submission_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cycle_id?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          domain_id?: string
          duration_minutes?: number
          employee_id?: string
          id?: string
          is_reassessment?: boolean
          modified_at?: string | null
          modified_by?: string | null
          parent_assessment_id?: string | null
          status?: string
          submission_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      attempt_answers: {
        Row: {
          answer_text: string
          attempt_id: string
          created_at: string | null
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          id: string
          modified_at: string | null
          modified_by: string | null
          question_id: string
          time_spent_seconds: number
        }
        Insert: {
          answer_text?: string
          attempt_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          question_id: string
          time_spent_seconds?: number
        }
        Update: {
          answer_text?: string
          attempt_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          question_id?: string
          time_spent_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_skill_scores: {
        Row: {
          attempt_id: string
          avg_score: number
          calculated_level: number
          created_at: string | null
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          id: string
          modified_at: string | null
          modified_by: string | null
          question_count: number
          skill_id: string
        }
        Insert: {
          attempt_id: string
          avg_score?: number
          calculated_level?: number
          created_at?: string | null
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          question_count?: number
          skill_id: string
        }
        Update: {
          attempt_id?: string
          avg_score?: number
          calculated_level?: number
          created_at?: string | null
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          question_count?: number
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_skill_scores_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      competency_levels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          label: string
          level: number
          min_questions: number
          modified_at: string | null
          modified_by: string | null
          name: string
          score_range_max: number
          score_range_min: number
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          label: string
          level: number
          min_questions?: number
          modified_at?: string | null
          modified_by?: string | null
          name: string
          score_range_max?: number
          score_range_min?: number
          status?: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          label?: string
          level?: number
          min_questions?: number
          modified_at?: string | null
          modified_by?: string | null
          name?: string
          score_range_max?: number
          score_range_min?: number
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      domain_skill_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          domain_id: string
          id: string
          modified_at: string | null
          modified_by: string | null
          skill_id: string
          skill_weight: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          domain_id: string
          id: string
          modified_at?: string | null
          modified_by?: string | null
          skill_id: string
          skill_weight?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          domain_id?: string
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          skill_id?: string
          skill_weight?: number
          tenant_id?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          description: string | null
          domain_lead_id: string | null
          id: string
          modified_at: string | null
          modified_by: string | null
          name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          description?: string | null
          domain_lead_id?: string | null
          id: string
          modified_at?: string | null
          modified_by?: string | null
          name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          description?: string | null
          domain_lead_id?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_domain_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          domain_id: string
          employee_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain_id: string
          employee_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain_id?: string
          employee_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      manager_reviews: {
        Row: {
          assessment_id: string
          attempt_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          domain_id: string
          employee_id: string
          employee_name: string
          id: string
          modified_at: string | null
          modified_by: string | null
          overall_comment: string | null
          reviewer_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          attempt_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          domain_id: string
          employee_id: string
          employee_name: string
          id: string
          modified_at?: string | null
          modified_by?: string | null
          overall_comment?: string | null
          reviewer_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          attempt_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          domain_id?: string
          employee_id?: string
          employee_name?: string
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          overall_comment?: string | null
          reviewer_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_link: string | null
          created_at: string
          id: string
          message: string
          read: boolean | null
          reference_id: string
          target_role: string
          target_user_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          action_link?: string | null
          created_at?: string
          id: string
          message: string
          read?: boolean | null
          reference_id: string
          target_role: string
          target_user_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          action_link?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          reference_id?: string
          target_role?: string
          target_user_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: []
      }
      official_skill_entries: {
        Row: {
          ai_level: number
          assessment_reference: string
          created_at: string
          created_by: string | null
          cycle: string
          deleted_by: string | null
          deleted_on: string | null
          employee_id: string
          final_level: number
          id: string
          manager_comments: string | null
          modified_at: string | null
          modified_by: string | null
          review_id: string
          self_rating: number
          skill_id: string
          tenant_id: string
        }
        Insert: {
          ai_level: number
          assessment_reference: string
          created_at?: string
          created_by?: string | null
          cycle: string
          deleted_by?: string | null
          deleted_on?: string | null
          employee_id: string
          final_level: number
          id: string
          manager_comments?: string | null
          modified_at?: string | null
          modified_by?: string | null
          review_id: string
          self_rating: number
          skill_id: string
          tenant_id: string
        }
        Update: {
          ai_level?: number
          assessment_reference?: string
          created_at?: string
          created_by?: string | null
          cycle?: string
          deleted_by?: string | null
          deleted_on?: string | null
          employee_id?: string
          final_level?: number
          id?: string
          manager_comments?: string | null
          modified_at?: string | null
          modified_by?: string | null
          review_id?: string
          self_rating?: number
          skill_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          ai_generated: boolean | null
          competency_level: string
          created_at: string
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          evaluation_guidelines: string | null
          id: string
          modified_at: string | null
          modified_by: string | null
          question_text: string
          question_type: string
          skill_id: string
          status: string
          tenant_id: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          competency_level: string
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          evaluation_guidelines?: string | null
          id: string
          modified_at?: string | null
          modified_by?: string | null
          question_text: string
          question_type: string
          skill_id: string
          status?: string
          tenant_id: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          competency_level?: string
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          evaluation_guidelines?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          question_text?: string
          question_type?: string
          skill_id?: string
          status?: string
          tenant_id?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reassessment_requests: {
        Row: {
          assessment_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          review_id: string
          skill_ids: Json
          status: string
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          review_id: string
          skill_ids?: Json
          status?: string
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          review_id?: string
          skill_ids?: Json
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      review_cycles: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          end_date: string
          grace_period_days: number
          id: string
          modified_at: string | null
          modified_by: string | null
          name: string
          start_date: string
          status: string
          tenant_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          grace_period_days?: number
          id: string
          modified_at?: string | null
          modified_by?: string | null
          name: string
          start_date: string
          status?: string
          tenant_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          grace_period_days?: number
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          name?: string
          start_date?: string
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      review_skill_entries: {
        Row: {
          ai_calculated_level: number
          ai_score: number
          id: string
          manager_action: string | null
          manager_adjusted_level: number | null
          manager_comment: string | null
          review_id: string
          self_rating: number
          skill_id: string
        }
        Insert: {
          ai_calculated_level: number
          ai_score?: number
          id?: string
          manager_action?: string | null
          manager_adjusted_level?: number | null
          manager_comment?: string | null
          review_id: string
          self_rating: number
          skill_id: string
        }
        Update: {
          ai_calculated_level?: number
          ai_score?: number
          id?: string
          manager_action?: string | null
          manager_adjusted_level?: number | null
          manager_comment?: string | null
          review_id?: string
          self_rating?: number
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_skill_entries_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "manager_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_categories: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          description: string | null
          id: string
          modified_at: string | null
          modified_by: string | null
          name: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          description?: string | null
          id: string
          modified_at?: string | null
          modified_by?: string | null
          name: string
          status?: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          description?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          name?: string
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      skill_registry_submissions: {
        Row: {
          created_at: string
          created_by: string | null
          cycle: string
          cycle_id: string | null
          deleted_by: string | null
          deleted_on: string | null
          domain_id: string
          employee_id: string
          id: string
          modified_at: string | null
          modified_by: string | null
          status: string
          submitted_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cycle: string
          cycle_id?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          domain_id: string
          employee_id: string
          id: string
          modified_at?: string | null
          modified_by?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cycle?: string
          cycle_id?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          domain_id?: string
          employee_id?: string
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      skill_self_ratings: {
        Row: {
          comment: string | null
          id: string
          rating: number
          skill_id: string
          submission_id: string
        }
        Insert: {
          comment?: string | null
          id?: string
          rating: number
          skill_id: string
          submission_id: string
        }
        Update: {
          comment?: string | null
          id?: string
          rating?: number
          skill_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_self_ratings_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "skill_registry_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_topics: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          description: string | null
          id: string
          modified_at: string | null
          modified_by: string | null
          name: string
          skill_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          description?: string | null
          id: string
          modified_at?: string | null
          modified_by?: string | null
          name: string
          skill_id: string
          status?: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          description?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          name?: string
          skill_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          id: string
          modified_at: string | null
          modified_by: string | null
          skill_category: string | null
          skill_description: string | null
          skill_name: string
          status: string
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          id: string
          modified_at?: string | null
          modified_by?: string | null
          skill_category?: string | null
          skill_description?: string | null
          skill_name: string
          status?: string
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          skill_category?: string | null
          skill_description?: string | null
          skill_name?: string
          status?: string
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          deleted_by: string | null
          deleted_on: string | null
          department: string | null
          designation: string | null
          domain_id: string | null
          email: string
          full_name: string
          id: string
          modified_at: string | null
          modified_by: string | null
          role: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          department?: string | null
          designation?: string | null
          domain_id?: string | null
          email: string
          full_name: string
          id: string
          modified_at?: string | null
          modified_by?: string | null
          role?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          department?: string | null
          designation?: string | null
          domain_id?: string | null
          email?: string
          full_name?: string
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          role?: string
          status?: string
          tenant_id?: string
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
