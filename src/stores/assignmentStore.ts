import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';
import { useAssessmentStore, AssessmentQuestion } from './assessmentStore';
import { useTemplateStore, AssessmentTemplate } from './templateStore';
import { getLatestSelfRatings } from '@/lib/selfRatings';

export type AssignmentStatus =
  | 'new'
  | 'in_progress'
  | 'submitted'
  | 'evaluated'
  | 'verified'
  | 'revoked';

export const assignmentStatusConfig: Record<AssignmentStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', color: 'bg-info/15 text-info border-info/20' },
  submitted: { label: 'Submitted', color: 'bg-primary/15 text-primary border-primary/20' },
  evaluated: { label: 'Evaluated', color: 'bg-success/15 text-success border-success/20' },
  verified: { label: 'Verified', color: 'bg-success/15 text-success border-success/20' },
  revoked: { label: 'Revoked', color: 'bg-destructive/15 text-destructive border-destructive/20' },
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

interface FetchOptions { force?: boolean }

interface AssignmentStore {
  assignments: AssessmentAssignment[];
  loading: boolean;
  initialized: boolean;
  fetchAssignments: (options?: FetchOptions) => Promise<void>;
  getActiveAssignmentsForEmployee: (templateId: string, employeeId: string) => AssessmentAssignment | undefined;
  getAssignmentsForTemplate: (templateId: string) => AssessmentAssignment[];
  getAssignmentByAssessmentId: (assessmentId: string) => AssessmentAssignment | undefined;
  createAssignments: (params: {
    template_id: string;
    employee_ids: string[];
    domain_id?: string | null;
    overrideDuplicates?: boolean;
  }) => Promise<CreateAssignmentResult>;
  revokeAssignment: (id: string, reason?: string) => Promise<void>;
  revokeAssessment: (assessmentId: string, reason: string) => Promise<void>;
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

  // Resolve a real domain_id for the assessment.
  // Prefer the template's bound domain; otherwise fall back to the employee's domain
  // so manager visibility (scoped by employee domain) keeps working.
  let resolvedDomainId: string = template.domain_id ?? '';
  if (!resolvedDomainId) {
    const { data: empRow } = await supabase
      .from('users')
      .select('domain_id')
      .eq('id', employeeId)
      .maybeSingle();
    resolvedDomainId = (empRow as any)?.domain_id ?? '';
  }

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
        domain_id: resolvedDomainId,
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
          domain_id: resolvedDomainId,
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

  // Try to seed skill selection from the employee's latest self-ratings.
  // Registry submission is OPTIONAL — fall back to domain skills below.
  const latestRatings = await getLatestSelfRatings(employeeId, template.domain_id);
  const submissionId = `tmpl-${template.id}`;

  // Pre-flight: make sure we can resolve at least one usable skill with MCQs.
  let candidateSkills: string[] = [];
  if (template.skill_selection_mode === 'custom') {
    const { data: tplSkills } = await supabase
      .from('assessment_template_skills')
      .select('skill_id')
      .eq('template_id', template.id);
    candidateSkills = (tplSkills || []).map((s: any) => s.skill_id);
  } else if (latestRatings.length > 0) {
    candidateSkills = [...latestRatings]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, template.skills_per_assessment)
      .map((r) => r.skill_id);
  }
  // Fallback: pull skills mapped to the domain when no registry / no ratings.
  if (candidateSkills.length === 0) {
    const { data: domainSkills } = await supabase
      .from('domain_skill_mappings')
      .select('skill_id')
      .eq('domain_id', template.domain_id)
      .is('deleted_on', null);
    candidateSkills = (domainSkills || [])
      .map((s: any) => s.skill_id)
      .slice(0, template.skills_per_assessment);
  }
  if (candidateSkills.length === 0) {
    return { assessmentId: null, reason: 'No skills available for this domain' };
  }
  // Per-skill existence check (HEAD counts) — a listing query is capped at
  // 1000 rows and would misreport availability for large question banks.
  const skillsWithMcq = await getSkillsWithPublishedMcqs(candidateSkills);
  const skillsWithoutMcq = candidateSkills.filter((s) => !skillsWithMcq.has(s));
  if (skillsWithoutMcq.length > 0) {
    console.warn(
      'assignment: skills excluded — no published MCQs available:',
      skillsWithoutMcq.join(', '),
    );
  }
  if (skillsWithMcq.size === 0) {
    return { assessmentId: null, reason: 'No published MCQs available for the selected skills' };
  }

  const durationMinutes = template.duration_minutes ?? 45;
  const { data: aRow, error: aErr } = await supabase
    .from('assessments')
    .insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      submission_id: submissionId,
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
        submission_id: submissionId,
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

let fetchAssignmentsInFlight: Promise<void> | null = null;

export const useAssignmentStore = create<AssignmentStore>((set, get) => ({
  assignments: [],
  loading: false,
  initialized: false,

  fetchAssignments: async (options = {}) => {
    const { force = false } = options;
    const state = get();
    if (!force && state.initialized) return;
    if (!force && fetchAssignmentsInFlight) return fetchAssignmentsInFlight;

    fetchAssignmentsInFlight = (async () => {
      set({ loading: true });
      try {
      const { data, error } = await supabase
        .from('assessment_assignments')
        .select('id, tenant_id, template_id, employee_id, domain_id, status, attempt_count, max_attempts, assessment_id, assigned_at, assigned_by, created_at')
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
      } finally {
        fetchAssignmentsInFlight = null;
      }
    })();

    return fetchAssignmentsInFlight;
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
      await useTemplateStore.getState().fetchTemplates({ force: true });
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
      await get().fetchAssignments({ force: true });
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

  revokeAssignment: async (id, reason) => {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const assignment = get().assignments.find((a) => a.id === id);

    // If an assessment has already been generated, soft-delete it and its attempts too.
    if (assignment?.assessment_id) {
      try {
        // Soft-delete attempts for this assessment
        await supabase
          .from('assessment_attempts')
          .update({ deleted_on: now, deleted_by: userId, modified_at: now, modified_by: userId })
          .eq('assessment_id', assignment.assessment_id)
          .is('deleted_on', null);
        // Soft-delete the assessment itself
        await useAssessmentStore.getState().softDeleteAssessment(assignment.assessment_id);
      } catch (e) {
        console.error('Failed to soft-delete linked assessment during revoke:', e);
      }
    }

    const { error } = await supabase
      .from('assessment_assignments')
      .update({
        deleted_on: now,
        deleted_by: userId,
        modified_at: now,
        modified_by: userId,
        revoke_reason: reason ?? null,
      })
      .eq('id', id);
    if (error) {
      console.error('Failed to revoke assignment:', error);
      throw error;
    }
    set((state) => ({ assignments: state.assignments.filter((a) => a.id !== id) }));
  },

  revokeAssessment: async (assessmentId, reason) => {
    const assignment = get().getAssignmentByAssessmentId(assessmentId);
    if (assignment) {
      await get().revokeAssignment(assignment.id, reason);
      return;
    }
    // No assignment link — soft-delete just the assessment + its attempts.
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    await supabase
      .from('assessment_attempts')
      .update({ deleted_on: now, deleted_by: userId, modified_at: now, modified_by: userId })
      .eq('assessment_id', assessmentId)
      .is('deleted_on', null);
    await useAssessmentStore.getState().softDeleteAssessment(assessmentId);
  },

  updateStatusForAssessment: async (assessmentId, status) => {
    const assignment = get().getAssignmentByAssessmentId(assessmentId);
    if (!assignment) return;
    if (assignment.status === status) return;

    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    // Increment attempt_count whenever transitioning *into* in_progress
    // from any non-in_progress state (covers first start AND re-attempts).
    const shouldIncrement = status === 'in_progress' && assignment.status !== 'in_progress';
    const updates = {
      status,
      modified_at: now,
      modified_by: userId,
      attempt_count: shouldIncrement
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

/**
 * Returns true when the employee can start a new attempt for this assessment
 * under its template assignment (attempt_count below max_attempts, or no assignment).
 * Assessments not tied to an assignment are always allowed.
 */
export function canStartNewAttempt(assessmentId: string): { allowed: boolean; reason?: string } {
  const assignment = useAssignmentStore.getState().getAssignmentByAssessmentId(assessmentId);
  if (!assignment) return { allowed: true };
  // If the prior attempt is still active (new/in_progress), this is a resume — allow.
  if (assignment.status === 'new' || assignment.status === 'in_progress') {
    return { allowed: true };
  }
  // Terminal status: only allow if attempts remain.
  if (assignment.attempt_count >= assignment.max_attempts) {
    return {
      allowed: false,
      reason: `You have reached the maximum number of attempts (${assignment.max_attempts}) for this assessment.`,
    };
  }
  return { allowed: true };
}

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
