import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/audit";

export type TemplateType = "adaptive" | "fixed";
export type TemplateStatus = "draft" | "active";
export type SkillSelectionMode = "top_n" | "custom";

export interface AssessmentTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  type: TemplateType;
  status: TemplateStatus;
  duration_minutes: number;
  max_attempts: number;
  reattempt_enabled: boolean; // derived: max_attempts > 1
  // adaptive
  domain_id: string | null;
  skill_selection_mode: SkillSelectionMode | null;
  skills_per_assessment: number;
  questions_per_skill: number;
  question_types: string[];
  // fixed
  shuffle_questions: boolean;
  shuffle_options: boolean;
  // audit
  created_at: string;
  modified_at: string | null;
  created_by: string | null;
  modified_by: string | null;
}

export interface TemplateSkill {
  id: string;
  template_id: string;
  skill_id: string;
}

export interface TemplateQuestion {
  id: string;
  template_id: string;
  question_id: string;
  position: number;
}

export interface SaveTemplateInput {
  id?: string;
  tenant_id: string;
  name: string;
  description: string;
  type: TemplateType;
  status: TemplateStatus;
  duration_minutes: number;
  max_attempts: number;
  reattempt_enabled: boolean;
  domain_id: string | null;
  skill_selection_mode: SkillSelectionMode | null;
  skills_per_assessment: number;
  questions_per_skill: number;
  question_types: string[];
  shuffle_questions: boolean;
  shuffle_options: boolean;
  // related
  skill_ids?: string[];
  question_ids?: string[];
}

interface FetchOptions { force?: boolean }

interface TemplateStore {
  templates: AssessmentTemplate[];
  skillsByTemplate: Map<string, string[]>;
  questionsByTemplate: Map<string, string[]>;
  loading: boolean;
  initialized: boolean;

  fetchTemplates: (options?: FetchOptions) => Promise<void>;
  getTemplate: (id: string) => AssessmentTemplate | undefined;
  fetchTemplateRelations: (id: string) => Promise<{ skill_ids: string[]; question_ids: string[] }>;
  saveTemplate: (input: SaveTemplateInput) => Promise<string | null>;
  deleteTemplate: (id: string) => Promise<void>;
  setTemplateStatus: (id: string, status: TemplateStatus) => Promise<void>;
}

function rowToTemplate(r: any): AssessmentTemplate {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    name: r.name,
    description: r.description ?? "",
    type: r.type,
    status: r.status,
    duration_minutes: r.duration_minutes,
    max_attempts: r.max_attempts,
    reattempt_enabled: r.reattempt_enabled,
    domain_id: r.domain_id,
    skill_selection_mode: r.skill_selection_mode,
    skills_per_assessment: r.skills_per_assessment ?? 5,
    questions_per_skill: r.questions_per_skill ?? 4,
    question_types: Array.isArray(r.question_types) ? r.question_types : ["mcq"],
    shuffle_questions: !!r.shuffle_questions,
    shuffle_options: !!r.shuffle_options,
    created_at: r.created_at,
    modified_at: r.modified_at,
    created_by: r.created_by,
    modified_by: r.modified_by,
  };
}

let fetchTemplatesInFlight: Promise<void> | null = null;

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: [],
  skillsByTemplate: new Map(),
  questionsByTemplate: new Map(),
  loading: false,
  initialized: false,

  fetchTemplates: async (options = {}) => {
    const { force = false } = options;
    const state = get();
    if (!force && state.initialized) return;
    if (!force && fetchTemplatesInFlight) return fetchTemplatesInFlight;

    fetchTemplatesInFlight = (async () => {
      set({ loading: true });
      try {
      const { data, error } = await supabase
        .from("assessment_templates")
        .select("id, tenant_id, name, description, type, status, duration_minutes, max_attempts, reattempt_enabled, domain_id, skill_selection_mode, skills_per_assessment, questions_per_skill, question_types, shuffle_questions, shuffle_options, created_at, modified_at, created_by, modified_by")
        .order("created_at", { ascending: false });
      if (error) throw error;
        set({ templates: (data || []).map(rowToTemplate), loading: false, initialized: true });
      } catch (err) {
        console.error("Failed to fetch templates:", err);
        set({ loading: false, initialized: true });
      } finally {
        fetchTemplatesInFlight = null;
      }
    })();

    return fetchTemplatesInFlight;
  },

  getTemplate: (id) => get().templates.find((t) => t.id === id),

  fetchTemplateRelations: async (id) => {
    const [skillsRes, questionsRes] = await Promise.all([
      supabase.from("assessment_template_skills").select("skill_id").eq("template_id", id),
      supabase.from("assessment_template_questions").select("question_id, position").eq("template_id", id).order("position"),
    ]);
    const skill_ids = (skillsRes.data || []).map((s: any) => s.skill_id);
    const question_ids = (questionsRes.data || []).map((q: any) => q.question_id);
    set((state) => {
      const skillMap = new Map(state.skillsByTemplate);
      const qMap = new Map(state.questionsByTemplate);
      skillMap.set(id, skill_ids);
      qMap.set(id, question_ids);
      return { skillsByTemplate: skillMap, questionsByTemplate: qMap };
    });
    return { skill_ids, question_ids };
  },

  saveTemplate: async (input) => {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const payload = {
      tenant_id: input.tenant_id,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      type: input.type,
      status: input.status,
      duration_minutes: input.duration_minutes,
      max_attempts: input.max_attempts,
      reattempt_enabled: input.reattempt_enabled,
      domain_id: input.type === "adaptive" ? input.domain_id : null,
      skill_selection_mode: input.type === "adaptive" ? input.skill_selection_mode : null,
      skills_per_assessment: input.skills_per_assessment,
      questions_per_skill: input.questions_per_skill,
      question_types: input.question_types,
      shuffle_questions: input.shuffle_questions,
      shuffle_options: input.shuffle_options,
    };

    let templateId = input.id ?? null;

    if (input.id) {
      const { error } = await supabase
        .from("assessment_templates")
        .update({ ...payload, modified_at: now, modified_by: userId })
        .eq("id", input.id);
      if (error) {
        console.error("Failed to update template:", error);
        return null;
      }
    } else {
      const { data, error } = await supabase
        .from("assessment_templates")
        .insert({ ...payload, created_by: userId })
        .select()
        .single();
      if (error || !data) {
        console.error("Failed to create template:", error);
        return null;
      }
      templateId = data.id;
    }

    if (!templateId) return null;

    // Replace skill_ids
    if (input.skill_ids) {
      await supabase.from("assessment_template_skills").delete().eq("template_id", templateId);
      if (input.skill_ids.length > 0) {
        await supabase
          .from("assessment_template_skills")
          .insert(input.skill_ids.map((skill_id) => ({ template_id: templateId!, skill_id })));
      }
    }

    // Replace question_ids (with order)
    if (input.question_ids) {
      await supabase.from("assessment_template_questions").delete().eq("template_id", templateId);
      if (input.question_ids.length > 0) {
        await supabase
          .from("assessment_template_questions")
          .insert(
            input.question_ids.map((question_id, position) => ({ template_id: templateId!, question_id, position })),
          );
      }
    }

    await get().fetchTemplates({ force: true });
    await get().fetchTemplateRelations(templateId);
    return templateId;
  },

  deleteTemplate: async (id) => {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("assessment_templates")
      .update({ deleted_on: now, deleted_by: userId })
      .eq("id", id);
    if (error) {
      console.error("Failed to delete template:", error);
      throw error;
    }
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
  },

  setTemplateStatus: async (id, status) => {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("assessment_templates")
      .update({ status, modified_at: now, modified_by: userId })
      .eq("id", id);
    if (error) {
      console.error("Failed to update template status:", error);
      return;
    }
    set((state) => ({
      templates: state.templates.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
  },
}));
