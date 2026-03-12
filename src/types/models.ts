// ============================================
// SIAP - Core Data Models (Phase 1 MVP)
// All models include tenant_id for multi-tenant isolation
// ============================================

export type UserRole = 'admin' | 'manager' | 'employee';

export type AssessmentStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'reviewed';

export type QuestionType = 'mcq' | 'short_answer' | 'scenario_based' | 'code_snippet';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type SkillProficiency = 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';

// ---- Organization / Tenant ----
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  industry?: string;
  size?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
  designation?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Skill Framework ----
export interface SkillCategory {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  parent_id?: string;
  order: number;
  created_at: string;
}

export interface Skill {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description?: string;
  proficiency_levels: ProficiencyDefinition[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProficiencyDefinition {
  level: SkillProficiency;
  description: string;
  criteria: string[];
}

// ---- Domain Management ----
export interface Domain {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  lead_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DomainSkillMapping {
  id: string;
  tenant_id: string;
  domain_id: string;
  skill_id: string;
  required_proficiency: SkillProficiency;
  is_mandatory: boolean;
  created_at: string;
}

// ---- Question Bank ----
export interface Question {
  id: string;
  tenant_id: string;
  skill_id: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  question_text: string;
  options?: string[];
  correct_answer?: string;
  rubric?: string;
  ai_generated: boolean;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Assessment ----
export interface Assessment {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  domain_id?: string;
  skill_ids: string[];
  question_ids: string[];
  duration_minutes: number;
  status: AssessmentStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AssessmentAttempt {
  id: string;
  tenant_id: string;
  assessment_id: string;
  employee_id: string;
  started_at: string;
  completed_at?: string;
  answers: AnswerEntry[];
  ai_score?: number;
  manager_score?: number;
  final_score?: number;
  status: AssessmentStatus;
}

export interface AnswerEntry {
  question_id: string;
  answer_text: string;
  ai_evaluation?: string;
  ai_score?: number;
  time_spent_seconds?: number;
}

// ---- Manager Review ----
export interface ManagerReview {
  id: string;
  tenant_id: string;
  attempt_id: string;
  reviewer_id: string;
  status: ReviewStatus;
  comments?: string;
  adjusted_scores?: Record<string, number>;
  reviewed_at?: string;
  created_at: string;
}

// ---- Skill Registry ----
export interface SkillRegistryEntry {
  id: string;
  tenant_id: string;
  employee_id: string;
  skill_id: string;
  proficiency: SkillProficiency;
  assessment_id?: string;
  validated_by?: string;
  validated_at?: string;
  created_at: string;
  updated_at: string;
}

// ---- Navigation & UI ----
export interface NavItem {
  title: string;
  href: string;
  icon: string;
  roles: UserRole[];
  badge?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}
