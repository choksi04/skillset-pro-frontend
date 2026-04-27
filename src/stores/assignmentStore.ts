import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';
import { useAssessmentStore, AssessmentQuestion } from './assessmentStore';
import { useTemplateStore, AssessmentTemplate } from './templateStore';
import { useQuestionStore } from './questionStore';
import { useRegistryStore } from './registryStore';

export type AssignmentStatus =
  | 'new'
  | 'in_progress'
  | 'submitted'
  | 'evaluated'
  | 'verified';

export const assignmentStatusConfig: Record<AssignmentStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', color: 'bg-info/15 text-info border-info/20' },
  submitted: { label: 'Submitted', color: 'bg-primary/15 text-primary border-primary/20' },
  evaluated: { label: 'Evaluated', color: 'bg-success/15 text-success border-success/20' },
  verified: { label: 'Verified', color: 'bg-success/15 text-success border-success/20' },
};

export interface AssessmentAssignment {
  id: string;
  tenant_id: string;
  template_id: string;
  employee_id: string;
  domain_id: string | null;
  status: AssignmentStatus;
  attempt_count: number;
  max_attempts: number;
  assessment_id: string | null;
  assigned_at: string;
  assigned_by: string | null;
  created_at: string;
}

export interface CreateAssignmentResult {
  created: { employee_id: string; assignment_id: string; assessment_id: string | null }[];
  skipped: { employee_id: string; reason: string }[];
  failed: { employee_id: string; reason: string }[];
}

interface AssignmentStore {
  assignments: AssessmentAssignment[];
  loading: boolean;
  initialized: boolean;
  fetchAssignments: () => Promise<void>;
  getActiveAssignmentsForEmployee: (templateId: string, employeeId: string) => AssessmentAssignment | undefined;
  getAssignmentsForTemplate: (templateId: string) => AssessmentAssignment[];
  getAssignmentByAssessmentId: (assessmentId: string) => AssessmentAssignment | undefined;
  createAssignments: (params: {
    template_id: string;
    employee_ids: string[];
    domain_id?: string | null;
    overrideDuplicates?: boolean;
  }) => Promise<CreateAssignmentResult>;
  revokeAssignment: (id: string) => Promise<void>;
  updateStatusForAssessment: (assessmentId: string, status: AssignmentStatus) => Promise<void>;
}

function rowToAssignment(r: any): AssessmentAssignment {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    template_id: r.template_id,
    employee_id: r.employee_id,
    domain_id: r.domain_id,
    status: r.status,
    attempt_count: r.attempt_count ?? 0,
    max_attempts: r.max_attempts ?? 1,
    assessment_id: r.assessment_id,
    assigned_at: r.assigned_at,
    assigned_by: r.assigned_by,
    created_at: r.created_at,
  };
}

const ACTIVE_STATUSES: AssignmentStatus[] = ['new', 'in_progress'];

/**
 * Generate the underlying assessment + questions for an assignment based on the template type.
 * Returns the new assessment id, or null on failure.
 */
async function generateAssessmentForTemplate(
  template: AssessmentTemplate,
  employeeId: string,
  tenantId: string,
): Promise<{ assessmentId: string | null; reason?: string }> {
  const userId = getCurrentUserId();
  const now = new Date().toISOString();

  if (template.type === 'fixed') {
    // Pull the registered question list
    const { data: tplQuestions, error: tqErr } = await supabase
      .from('assessment_template_questions')
      .select('question_id, position')
      .eq('template_id', template.id)
      .order('position');
    if (tqErr || !tplQuestions || tplQuestions.length === 0) {
      return { assessmentId: null, reason: 'Template has no questions' };
    }

    // Load each question to get skill_id + competency_level (target_level)
    const questionIds = tplQuestions.map((q: any) => q.question_id);
    const { data: questionRows } = await supabase
      .from('questions')
      .select('id, skill_id, competency_level')
      .in('id', questionIds);

    const orderedQuestions: AssessmentQuestion[] = tplQuestions
      .map((tq: any) => {
        const q = (questionRows || []).find((r: any) => r.id === tq.question_id);
        if (!q) return null;
        return {
          question_id: q.id,
          skill_id: q.skill_id,
          target_level: q.competency_level,
        } as AssessmentQuestion;
      })
      .filter(Boolean) as AssessmentQuestion[];

    if (orderedQuestions.length === 0) {
      return { assessmentId: null, reason: 'Template questions could not be loaded' };
    }

    // Insert assessment row
    const durationMinutes = template.duration_minutes ?? Math.max(30, orderedQuestions.length * 10);
    const skillIds = [...new Set(orderedQuestions.map((q) => q.skill_id))];
    const { data: aRow, error: aErr } = await supabase
      .from('assessments')
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        submission_id: `tmpl-${template.id}`,
        domain_id: template.domain_id ?? 'fixed',
        template_id: template.id,
        status: 'pending',
        duration_minutes: durationMinutes,
        created_by: userId,
      })
      .select()
      .single();

    if (aErr || !aRow) return { assessmentId: null, reason: aErr?.message ?? 'Failed to create assessment' };

    const assessmentId = (aRow as any).id;
    const { error: qErr } = await supabase
      .from('assessment_questions')
      .insert(
        orderedQuestions.map((q) => ({
          assessment_id: assessmentId,
          question_id: q.question_id,
          skill_id: q.skill_id,
          target_level: q.target_level,
          created_by: userId,
        })),
      );
    if (qErr) {
      console.error('Failed to insert template questions:', qErr);
    }

    // Sync into in-memory assessmentStore
    useAssessmentStore.setState((s) => ({
      assessments: [
        {
          id: assessmentId,
          tenant_id: tenantId,
          employee_id: employeeId,
          submission_id: `tmpl-${template.id}`,
          domain_id: template.domain_id ?? 'fixed',
          template_id: template.id,
          is_reassessment: false,
          is_adaptive: false,
          parent_assessment_id: null,
          skill_ids: skillIds,
          assessment_questions: orderedQuestions,
          status: 'pending',
          duration_minutes: durationMinutes,
          created_at: (aRow as any).created_at ?? now,
          updated_at: (aRow as any).updated_at ?? now,
        },
        ...s.assessments,
      ],
    }));

    return { assessmentId };
  }

  // ADAPTIVE: create an empty assessment row with is_adaptive=true.
  // Questions are picked one-by-one by the adaptive engine during the attempt.
  if (!template.domain_id) {
    return { assessmentId: null, reason: 'Adaptive template missing domain' };
  }

  // Verify the employee has a submitted registry for this domain (engine needs self-ratings).
  const { data: subs } = await supabase
    .from('skill_registry_submissions')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('domain_id', template.domain_id)
    .eq('status', 'submitted')
    .is('deleted_on', null)
    .order('submitted_at', { ascending: false })
    .limit(1);
  const submission = subs?.[0];
  if (!submission) {
    return { assessmentId: null, reason: 'Employee has not submitted a registry for this domain yet' };
  }

  // Pre-flight: make sure we can resolve at least one usable skill with MCQs.
  let candidateSkills: string[] = [];
  if (template.skill_selection_mode === 'custom') {
    const { data: tplSkills } = await supabase
      .from('assessment_template_skills')
      .select('skill_id')
      .eq('template_id', template.id);
    candidateSkills = (tplSkills || []).map((s: any) => s.skill_id);
  } else {
    const { data: ratingsData } = await supabase
      .from('skill_self_ratings')
      .select('skill_id, rating')
      .eq('submission_id', submission.id);
    candidateSkills = [...(ratingsData || [])]
      .sort((a: any, b: any) => b.rating - a.rating)
      .slice(0, template.skills_per_assessment)
      .map((r: any) => r.skill_id);
  }
  if (candidateSkills.length === 0) {
    return { assessmentId: null, reason: 'No matching skills in employee registry' };
  }
  const { data: mcqRows } = await supabase
    .from('questions')
    .select('skill_id')
    .in('skill_id', candidateSkills)
    .eq('question_type', 'mcq')
    .eq('status', 'published')
    .is('deleted_on', null);
  if (!mcqRows || mcqRows.length === 0) {
    return { assessmentId: null, reason: 'No published MCQs available for the selected skills' };
  }

  const durationMinutes = template.duration_minutes ?? 45;
  const { data: aRow, error: aErr } = await supabase
    .from('assessments')
    .insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      submission_id: submission.id,
      domain_id: template.domain_id,
      template_id: template.id,
      is_adaptive: true,
      status: 'pending',
      duration_minutes: durationMinutes,
      created_by: userId,
    })
    .select()
    .single();
  if (aErr || !aRow) return { assessmentId: null, reason: aErr?.message ?? 'Failed to create assessment' };

  const assessmentId = (aRow as any).id;
  // Mirror into in-memory assessmentStore (no questions yet — engine adds them on the fly)
  useAssessmentStore.setState((s) => ({
    assessments: [
      {
        id: assessmentId,
        tenant_id: tenantId,
        employee_id: employeeId,
        submission_id: submission.id,
        domain_id: template.domain_id!,
        template_id: template.id,
        is_reassessment: false,
        is_adaptive: true,
        parent_assessment_id: null,
        skill_ids: [],
        assessment_questions: [],
        status: 'pending',
        duration_minutes: durationMinutes,
        created_at: (aRow as any).created_at ?? now,
        updated_at: (aRow as any).updated_at ?? now,
      },
      ...s.assessments,
    ],
  }));

  return { assessmentId };
}

export const useAssignmentStore = create<AssignmentStore>((set, get) => ({
  assignments: [],
  loading: false,
  initialized: false,

  fetchAssignments: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('assessment_assignments')
        .select('*')
        .is('deleted_on', null)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      set({
        assignments: (data || []).map(rowToAssignment),
        loading: false,
        initialized: true,
      });
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
      set({ loading: false, initialized: true });
    }
  },

  getActiveAssignmentsForEmployee: (templateId, employeeId) =>
    get().assignments.find(
      (a) => a.template_id === templateId && a.employee_id === employeeId && ACTIVE_STATUSES.includes(a.status),
    ),

  getAssignmentsForTemplate: (templateId) =>
    get().assignments.filter((a) => a.template_id === templateId),

  getAssignmentByAssessmentId: (assessmentId) =>
    get().assignments.find((a) => a.assessment_id === assessmentId),

  createAssignments: async ({ template_id, employee_ids, domain_id, overrideDuplicates }) => {
    const result: CreateAssignmentResult = { created: [], skipped: [], failed: [] };
    const userId = getCurrentUserId();

    // Load template
    let template = useTemplateStore.getState().getTemplate(template_id);
    if (!template) {
      await useTemplateStore.getState().fetchTemplates();
      template = useTemplateStore.getState().getTemplate(template_id);
    }
    if (!template) {
      employee_ids.forEach((eid) => result.failed.push({ employee_id: eid, reason: 'Template not found' }));
      return result;
    }
    if (template.status !== 'active') {
      employee_ids.forEach((eid) => result.failed.push({ employee_id: eid, reason: 'Template is not active' }));
      return result;
    }

    // Make sure assignments cache is fresh for duplicate check
    if (!get().initialized) {
      await get().fetchAssignments();
    }

    const tenantId = template.tenant_id;
    const newRows: AssessmentAssignment[] = [];

    for (const employee_id of employee_ids) {
      // Duplicate check
      const existing = get().getActiveAssignmentsForEmployee(template_id, employee_id);
      if (existing && !overrideDuplicates) {
        result.skipped.push({ employee_id, reason: 'Already has an active assignment' });
        continue;
      }

      // Generate underlying assessment first
      const gen = await generateAssessmentForTemplate(template, employee_id, tenantId);
      if (!gen.assessmentId) {
        result.failed.push({ employee_id, reason: gen.reason ?? 'Generation failed' });
        continue;
      }

      // Insert assignment row
      const { data: aRow, error: aErr } = await supabase
        .from('assessment_assignments')
        .insert({
          tenant_id: tenantId,
          template_id,
          employee_id,
          domain_id: domain_id ?? template.domain_id ?? null,
          status: 'new',
          attempt_count: 0,
          max_attempts: template.max_attempts,
          assessment_id: gen.assessmentId,
          assigned_by: userId,
        })
        .select()
        .single();

      if (aErr || !aRow) {
        result.failed.push({ employee_id, reason: aErr?.message ?? 'Failed to record assignment' });
        continue;
      }

      const assignment = rowToAssignment(aRow);
      newRows.push(assignment);
      result.created.push({ employee_id, assignment_id: assignment.id, assessment_id: gen.assessmentId });

      // Notify employee
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await supabase.from('notifications').insert({
        id: notifId,
        tenant_id: tenantId,
        target_role: 'employee',
        target_user_id: employee_id,
        message: `You have been assigned a new assessment: ${template.name}`,
        type: 'assessment_assigned',
        reference_id: gen.assessmentId,
        action_link: `/assessments/${gen.assessmentId}`,
        read: false,
      });
    }

    if (newRows.length > 0) {
      set((state) => ({ assignments: [...newRows, ...state.assignments] }));
    }

    return result;
  },

  revokeAssignment: async (id) => {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('assessment_assignments')
      .update({ deleted_on: now, deleted_by: userId, modified_at: now, modified_by: userId })
      .eq('id', id);
    if (error) {
      console.error('Failed to revoke assignment:', error);
      throw error;
    }
    set((state) => ({ assignments: state.assignments.filter((a) => a.id !== id) }));
  },

  updateStatusForAssessment: async (assessmentId, status) => {
    const assignment = get().getAssignmentByAssessmentId(assessmentId);
    if (!assignment) return;
    if (assignment.status === status) return;

    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const updates = {
      status,
      modified_at: now,
      modified_by: userId,
      attempt_count:
        status === 'in_progress' && assignment.status === 'new'
          ? assignment.attempt_count + 1
          : assignment.attempt_count,
    };
    const { error } = await supabase
      .from('assessment_assignments')
      .update(updates)
      .eq('id', assignment.id);
    if (error) {
      console.error('Failed to update assignment status:', error);
      return;
    }
    set((state) => ({
      assignments: state.assignments.map((a) =>
        a.id === assignment.id
          ? {
              ...a,
              status,
              attempt_count: updates.attempt_count,
            }
          : a,
      ),
    }));
  },
}));

// --- Hook assignment status updates into existing flows ---
// We wrap attempt + review state changes by listening from the calling sites.
// The functions below are called explicitly from attemptStore / reviewStore.
export async function syncAssignmentForAttempt(
  assessmentId: string,
  newAttemptStatus: 'in_progress' | 'submitted' | 'evaluated',
) {
  const map: Record<string, AssignmentStatus> = {
    in_progress: 'in_progress',
    submitted: 'submitted',
    evaluated: 'evaluated',
  };
  const next = map[newAttemptStatus];
  if (!next) return;
  const store = useAssignmentStore.getState();
  if (!store.initialized) await store.fetchAssignments();
  await store.updateStatusForAssessment(assessmentId, next);
}

export async function syncAssignmentForReview(assessmentId: string) {
  const store = useAssignmentStore.getState();
  if (!store.initialized) await store.fetchAssignments();
  await store.updateStatusForAssessment(assessmentId, 'verified');
}
