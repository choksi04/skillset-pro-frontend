import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';
import { CompetencyLevel as CompetencyLevelConfig, getLevelToIdMap } from './competencyLevelStore';
import { Question } from './questionStore';
import { useAttemptStore, AssessmentAttempt, AnswerEntry, SkillScore } from './attemptStore';
import { useAssessmentStore, AssessmentQuestion } from './assessmentStore';
import { syncAssignmentForAttempt } from './assignmentStore';

/**
 * Per-skill state tracked in assessment_attempts.adaptive_state.
 *
 * - currentLevel: 1..5, where the next question for this skill should come from
 * - correctStreak / wrongStreak: consecutive answers at the *current* level
 * - attemptedCount: total questions asked for this skill in this attempt
 * - history: ordered log of every answered question
 * - done: true once the per-skill stop condition is satisfied
 */
export interface SkillAdaptiveState {
  skill_id: string;
  currentLevel: number;
  startLevel: number;
  correctStreak: number;
  wrongStreak: number;
  attemptedCount: number;
  done: boolean;
  history: { question_id: string; level: number; correct: boolean; fallback?: boolean }[];
}

export interface AdaptiveAttemptState {
  initialized: boolean;
  rrIndex: number; // round-robin pointer across the skill list
  questionsPerSkill: number;
  domain_id: string | null;
  template_id: string | null;
  skills: SkillAdaptiveState[];
  excludedQuestionIds: string[]; // global pool: never reuse a question across skills
}

interface AdaptiveEngineStore {
  /** Initialize per-skill state for an adaptive attempt. Idempotent. */
  initAdaptiveAttempt: (assessmentId: string) => Promise<{
    state: AdaptiveAttemptState | null;
    reason?: string;
  }>;
  /**
   * Fetch the next question to ask. Persists assignment + assessment_questions.
   * Returns null when the attempt is complete (no more skills to ask).
   */
  getNextQuestion: (
    attemptId: string,
    assessmentId: string,
  ) => Promise<{ question: Question | null; aq: AssessmentQuestion | null; skillState: SkillAdaptiveState | null }>;
  /**
   * Record the employee's answer correctness, advance per-skill state.
   */
  recordAnswer: (
    attemptId: string,
    assessmentId: string,
    question_id: string,
    skill_id: string,
    correct: boolean,
    answer_text: string,
    time_spent_seconds: number,
  ) => Promise<void>;
  /** Compute final per-skill levels and write attempt_skill_scores. Returns the scores. */
  finalizeAdaptiveAttempt: (attemptId: string, assessmentId: string) => Promise<SkillScore[]>;
  /**
   * Backfill `ai_evaluations` + `attempt_skill_scores` + `total_ai_score` for an
   * adaptive attempt that was finalized before per-question evaluation rows were
   * being written. Idempotent: no-op when ai_evaluations already exist for the
   * attempt or when the adaptive history is empty.
   */
  reconstructEvaluationsFromHistory: (attemptId: string) => Promise<boolean>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_LEVEL = 5;
const MIN_LEVEL = 1;

function clampLevel(level: number): number {
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
}

/** Pick the next ordered list of fallback levels around target: [target, target-1, target+1, ...] */
function fallbackLevelOrder(target: number): number[] {
  const order: number[] = [target];
  let down = target - 1;
  let up = target + 1;
  while (down >= MIN_LEVEL || up <= MAX_LEVEL) {
    if (down >= MIN_LEVEL) order.push(down--);
    if (up <= MAX_LEVEL) order.push(up++);
  }
  return order;
}

/** Parse MCQ JSON answer key. Returns true when the option letter matches the JSON correctIndex. */
function gradeMCQ(question: Question, answerLetter: string): boolean {
  if (!answerLetter) return false;
  try {
    const parsed = JSON.parse(question.question_text);
    if (typeof parsed?.correctIndex === 'number') {
      const idx = answerLetter.charCodeAt(0) - 'A'.charCodeAt(0);
      return idx === parsed.correctIndex;
    }
  } catch {
    /* not JSON */
  }
  return false;
}

export { gradeMCQ };

async function loadCompetencyLevelMap(): Promise<{
  levelToId: Record<number, string>;
  idToLevel: Record<string, number>;
}> {
  const { data } = await supabase.from('competency_levels').select('*').eq('status', 'active').order('level');
  const levels: CompetencyLevelConfig[] = (data || []).map((s: any) => ({
    id: s.id,
    tenant_id: s.tenant_id,
    level: s.level,
    name: s.name,
    label: s.label,
    description: s.description || '',
    score_range_min: s.score_range_min,
    score_range_max: s.score_range_max,
    min_questions: s.min_questions,
    status: s.status,
  }));
  const levelToId = getLevelToIdMap(levels);
  const idToLevel: Record<string, number> = {};
  for (const l of levels.filter((x) => x.status === 'active')) idToLevel[l.id] = l.level;
  return { levelToId, idToLevel };
}

async function persistState(attemptId: string, state: AdaptiveAttemptState) {
  await supabase
    .from('assessment_attempts')
    .update({ adaptive_state: state as any, modified_at: new Date().toISOString() })
    .eq('id', attemptId);
}

async function loadState(attemptId: string): Promise<AdaptiveAttemptState | null> {
  const { data } = await supabase
    .from('assessment_attempts')
    .select('adaptive_state')
    .eq('id', attemptId)
    .maybeSingle();
  const raw = (data?.adaptive_state ?? {}) as Partial<AdaptiveAttemptState>;
  if (!raw?.initialized) return null;
  return raw as AdaptiveAttemptState;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAdaptiveEngineStore = create<AdaptiveEngineStore>(() => ({
  initAdaptiveAttempt: async (assessmentId) => {
    const { data: attemptRow } = await supabase
      .from('assessment_attempts')
      .select('id, employee_id, adaptive_state, assessment_id')
      .eq('assessment_id', assessmentId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!attemptRow) return { state: null, reason: 'No attempt found' };

    const existing = (attemptRow.adaptive_state ?? {}) as Partial<AdaptiveAttemptState>;
    if (existing?.initialized) return { state: existing as AdaptiveAttemptState };

    const { data: assessmentRow } = await supabase
      .from('assessments')
      .select('domain_id, template_id, employee_id')
      .eq('id', assessmentId)
      .maybeSingle();
    if (!assessmentRow) return { state: null, reason: 'Assessment not found' };

    const templateId = assessmentRow.template_id as string | null;
    if (!templateId) return { state: null, reason: 'Adaptive assessment is missing a template link' };

    const { data: templateRow } = await supabase
      .from('assessment_templates')
      .select('skill_selection_mode, skills_per_assessment, questions_per_skill, domain_id')
      .eq('id', templateId)
      .maybeSingle();
    if (!templateRow) return { state: null, reason: 'Template not found' };

    let candidateSkills: string[] = [];
    if (templateRow.skill_selection_mode === 'custom') {
      const { data: tplSkills } = await supabase
        .from('assessment_template_skills')
        .select('skill_id')
        .eq('template_id', templateId);
      candidateSkills = (tplSkills || []).map((s: any) => s.skill_id);
    } else {
      const { data: subs } = await supabase
        .from('skill_registry_submissions')
        .select('id')
        .eq('employee_id', assessmentRow.employee_id)
        .eq('domain_id', assessmentRow.domain_id)
        .eq('status', 'submitted')
        .is('deleted_on', null)
        .order('submitted_at', { ascending: false })
        .limit(1);
      const submission = subs?.[0];
      if (submission) {
        const { data: ratings } = await supabase
          .from('skill_self_ratings')
          .select('skill_id, rating')
          .eq('submission_id', submission.id);
        candidateSkills = [...(ratings || [])]
          .sort((a: any, b: any) => b.rating - a.rating)
          .slice(0, templateRow.skills_per_assessment ?? 5)
          .map((r: any) => r.skill_id);
      }
    }

    // Fallback: when no registry submission / no ratings exist, fall back to the
    // skills mapped to the assessment's domain. Mirrors assignmentStore so that a
    // submitted registry remains optional (per project rules).
    if (candidateSkills.length === 0 && assessmentRow.domain_id) {
      const { data: domainSkills } = await supabase
        .from('domain_skill_mappings')
        .select('skill_id')
        .eq('domain_id', assessmentRow.domain_id)
        .is('deleted_on', null);
      candidateSkills = (domainSkills || [])
        .map((s: any) => s.skill_id)
        .slice(0, templateRow.skills_per_assessment ?? 5);
    }

    if (candidateSkills.length === 0) {
      return { state: null, reason: 'No skills resolved for this adaptive assessment' };
    }

    let selfRatingMap: Record<string, number> = {};
    {
      const { data: subs } = await supabase
        .from('skill_registry_submissions')
        .select('id')
        .eq('employee_id', assessmentRow.employee_id)
        .eq('domain_id', assessmentRow.domain_id)
        .eq('status', 'submitted')
        .is('deleted_on', null)
        .order('submitted_at', { ascending: false })
        .limit(1);
      const submission = subs?.[0];
      if (submission) {
        const { data: ratings } = await supabase
          .from('skill_self_ratings')
          .select('skill_id, rating')
          .eq('submission_id', submission.id);
        for (const r of ratings || []) selfRatingMap[(r as any).skill_id] = (r as any).rating;
      }
    }

    const { data: mcqAvailability } = await supabase
      .from('questions')
      .select('skill_id')
      .in('skill_id', candidateSkills)
      .eq('question_type', 'mcq')
      .eq('status', 'published')
      .is('deleted_on', null);
    const skillsWithMcq = new Set((mcqAvailability || []).map((q: any) => q.skill_id));
    const usableSkills = candidateSkills.filter((s) => skillsWithMcq.has(s));

    if (usableSkills.length === 0) {
      return { state: null, reason: 'No published MCQs available for any selected skill' };
    }

    const skills: SkillAdaptiveState[] = usableSkills.map((skill_id) => {
      const start = clampLevel(selfRatingMap[skill_id] ?? 3);
      return {
        skill_id,
        currentLevel: start,
        startLevel: start,
        correctStreak: 0,
        wrongStreak: 0,
        attemptedCount: 0,
        done: false,
        history: [],
      };
    });

    const state: AdaptiveAttemptState = {
      initialized: true,
      rrIndex: 0,
      questionsPerSkill: clampLevel(templateRow.questions_per_skill ?? 4) === 0 ? 4 : (templateRow.questions_per_skill ?? 4),
      domain_id: assessmentRow.domain_id ?? null,
      template_id: templateId,
      skills,
      excludedQuestionIds: [],
    };

    await persistState(attemptRow.id, state);
    return { state };
  },

  getNextQuestion: async (attemptId, assessmentId) => {
    const state = await loadState(attemptId);
    if (!state) return { question: null, aq: null, skillState: null };

    const skillsLeft = state.skills.filter((s) => !s.done);
    if (skillsLeft.length === 0) return { question: null, aq: null, skillState: null };

    const ordered: SkillAdaptiveState[] = [];
    const total = state.skills.length;
    for (let i = 0; i < total; i++) {
      const s = state.skills[(state.rrIndex + i) % total];
      if (!s.done) ordered.push(s);
    }
    const skill = ordered[0];

    const { levelToId } = await loadCompetencyLevelMap();
    const order = fallbackLevelOrder(skill.currentLevel);

    let chosen: { row: any; level: number; fallback: boolean } | null = null;
    for (const lvl of order) {
      const levelId = levelToId[lvl];
      if (!levelId) continue;
      const { data: rows } = await supabase
        .from('questions')
        .select('*')
        .eq('skill_id', skill.skill_id)
        .eq('question_type', 'mcq')
        .eq('status', 'published')
        .eq('competency_level', levelId)
        .is('deleted_on', null);

      const filtered = (rows || []).filter(
        (r: any) => !state.excludedQuestionIds.includes(r.id),
      );
      if (filtered.length > 0) {
        filtered.sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        chosen = { row: filtered[0], level: lvl, fallback: lvl !== skill.currentLevel };
        break;
      }
    }

    if (!chosen) {
      skill.done = true;
      await persistState(attemptId, state);
      return useAdaptiveEngineStore.getState().getNextQuestion(attemptId, assessmentId);
    }

    const userId = getCurrentUserId();
    const targetLevelId = levelToId[chosen.level] ?? levelToId[skill.currentLevel] ?? null;

    if (targetLevelId) {
      await supabase.from('assessment_questions').insert({
        assessment_id: assessmentId,
        question_id: chosen.row.id,
        skill_id: skill.skill_id,
        target_level: targetLevelId,
        created_by: userId,
      });

      useAssessmentStore.setState((s) => ({
        assessments: s.assessments.map((a) => {
          if (a.id !== assessmentId) return a;
          const aq: AssessmentQuestion = {
            question_id: chosen!.row.id,
            skill_id: skill.skill_id,
            target_level: targetLevelId,
          };
          return {
            ...a,
            assessment_questions: [...a.assessment_questions, aq],
            skill_ids: [...new Set([...a.skill_ids, skill.skill_id])],
          };
        }),
      }));
    }

    state.excludedQuestionIds.push(chosen.row.id);
    await persistState(attemptId, state);

    const question: Question = {
      id: chosen.row.id,
      tenant_id: chosen.row.tenant_id,
      skill_id: chosen.row.skill_id,
      topic_id: chosen.row.topic_id,
      competency_level: chosen.row.competency_level,
      question_type: chosen.row.question_type,
      question_text: chosen.row.question_text,
      evaluation_guidelines: chosen.row.evaluation_guidelines ?? '',
      status: chosen.row.status,
      ai_generated: chosen.row.ai_generated ?? false,
      created_at: chosen.row.created_at,
      updated_at: chosen.row.updated_at,
    };

    const aq: AssessmentQuestion = {
      question_id: question.id,
      skill_id: skill.skill_id,
      target_level: targetLevelId ?? '',
    };

    return { question, aq, skillState: skill };
  },

  recordAnswer: async (attemptId, assessmentId, question_id, skill_id, correct, answer_text, time_spent_seconds) => {
    const state = await loadState(attemptId);
    if (!state) return;

    const skill = state.skills.find((s) => s.skill_id === skill_id);
    if (!skill || skill.done) return;

    if (correct) {
      skill.correctStreak += 1;
      skill.wrongStreak = 0;
    } else {
      skill.wrongStreak += 1;
      skill.correctStreak = 0;
    }

    const lastHistoryLevel = skill.history[skill.history.length - 1]?.level ?? skill.currentLevel;
    const askedLevel = lastHistoryLevel;
    skill.history.push({ question_id, level: skill.currentLevel, correct });
    skill.attemptedCount += 1;

    let levelChanged = false;
    if (skill.correctStreak >= 2 && skill.currentLevel < MAX_LEVEL) {
      skill.currentLevel = clampLevel(skill.currentLevel + 1);
      skill.correctStreak = 0;
      skill.wrongStreak = 0;
      levelChanged = true;
    } else if (skill.wrongStreak >= 2 && skill.currentLevel > MIN_LEVEL) {
      skill.currentLevel = clampLevel(skill.currentLevel - 1);
      skill.correctStreak = 0;
      skill.wrongStreak = 0;
      levelChanged = true;
    }

    if (skill.attemptedCount >= state.questionsPerSkill) {
      skill.done = true;
    }

    const currentSkillIdx = state.skills.findIndex((s) => s.skill_id === skill_id);
    state.rrIndex = (currentSkillIdx + 1) % state.skills.length;

    await persistState(attemptId, state);
    await useAttemptStore.getState().saveAnswer(attemptId, {
      question_id,
      answer_text,
      time_spent_seconds,
    } as AnswerEntry);

    syncAssignmentForAttempt(assessmentId, 'in_progress').catch(() => {});

    void askedLevel;
    void levelChanged;
  },

  finalizeAdaptiveAttempt: async (attemptId, assessmentId) => {
    const state = await loadState(attemptId);
    if (!state) return [];

    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const skillScores: SkillScore[] = [];

    for (const skill of state.skills) {
      const correctByLevel: Record<number, number> = {};
      for (const h of skill.history) {
        if (h.correct) correctByLevel[h.level] = (correctByLevel[h.level] ?? 0) + 1;
      }

      let finalLevel: number | null = null;
      for (let lvl = MAX_LEVEL; lvl >= MIN_LEVEL; lvl--) {
        if ((correctByLevel[lvl] ?? 0) >= 2) {
          finalLevel = lvl;
          break;
        }
      }
      if (finalLevel == null) {
        const lastLevel =
          skill.history[skill.history.length - 1]?.level ?? skill.startLevel;
        finalLevel = Math.max(MIN_LEVEL, lastLevel - 1);
      }

      const total = skill.history.length || 1;
      const correctCount = skill.history.filter((h) => h.correct).length;
      const avg_score = Math.round((correctCount / total) * 100);

      skillScores.push({
        skill_id: skill.skill_id,
        avg_score,
        calculated_level: finalLevel,
        target_level: skill.startLevel,
        question_count: skill.history.length,
      });
    }

    // Build per-question evaluation rows from the adaptive history (binary MCQ grading).
    const evalRows = state.skills.flatMap((skill) =>
      skill.history.map((h) => ({
        attempt_id: attemptId,
        question_id: h.question_id,
        score: h.correct ? 100 : 0,
        confidence: 1,
        feedback: h.correct
          ? 'Correct answer.'
          : 'Incorrect — selected option did not match the correct answer.',
        dimensions: [] as any,
        created_by: userId,
      })),
    );

    await Promise.all([
      supabase.from('attempt_skill_scores').delete().eq('attempt_id', attemptId),
      supabase.from('ai_evaluations').delete().eq('attempt_id', attemptId),
      supabase
        .from('assessment_attempts')
        .update({
          status: 'evaluated',
          submitted_at: now,
          evaluated_at: now,
          total_ai_score:
            skillScores.length > 0
              ? Math.round(
                  skillScores.reduce((a, s) => a + s.avg_score, 0) / skillScores.length,
                )
              : 0,
          modified_by: userId,
          modified_at: now,
        })
        .eq('id', attemptId),
    ]);

    if (skillScores.length > 0) {
      await supabase.from('attempt_skill_scores').insert(
        skillScores.map((ss) => ({
          attempt_id: attemptId,
          skill_id: ss.skill_id,
          avg_score: ss.avg_score,
          calculated_level: ss.calculated_level,
          target_level: ss.target_level,
          question_count: ss.question_count,
          created_by: userId,
        })),
      );
    }

    if (evalRows.length > 0) {
      await supabase.from('ai_evaluations').insert(evalRows);
    }

    const totalAi =
      skillScores.length > 0
        ? Math.round(skillScores.reduce((a, s) => a + s.avg_score, 0) / skillScores.length)
        : 0;

    // Refresh attempts so EvalResults sees the new ai_evaluations rows.
    await useAttemptStore.getState().fetchAttempts();
    useAttemptStore.setState((s) => ({
      attempts: s.attempts.map((a) =>
        a.id === attemptId
          ? {
              ...a,
              status: 'evaluated' as AssessmentAttempt['status'],
              skill_scores: skillScores,
              total_ai_score: totalAi,
              submitted_at: now,
              evaluated_at: now,
            }
          : a,
      ),
    }));

    syncAssignmentForAttempt(assessmentId, 'evaluated').catch(() => {});
    return skillScores;
  },

  reconstructEvaluationsFromHistory: async (attemptId: string) => {
    // 1) Skip if evaluations already exist
    const { count: existingCount } = await supabase
      .from('ai_evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attemptId);
    if ((existingCount ?? 0) > 0) return false;

    // 2) Load the attempt + adaptive_state
    const { data: att, error: attErr } = await supabase
      .from('assessment_attempts')
      .select('id, assessment_id, adaptive_state')
      .eq('id', attemptId)
      .maybeSingle();
    if (attErr || !att) return false;

    const state = (att.adaptive_state ?? {}) as Partial<AdaptiveAttemptState>;
    const skills = Array.isArray(state.skills) ? state.skills : [];
    if (skills.length === 0) return false;

    const userId = await getCurrentUserId();
    const now = new Date().toISOString();

    // 3) Build evaluation rows from per-skill history
    const evalRows = skills.flatMap((skill) =>
      (skill.history ?? []).map((h) => ({
        attempt_id: attemptId,
        question_id: h.question_id,
        score: h.correct ? 100 : 0,
        confidence: 1,
        feedback: h.correct
          ? 'Correct answer.'
          : 'Incorrect — selected option did not match the correct answer.',
        dimensions: [] as any,
        created_by: userId,
      })),
    );
    if (evalRows.length === 0) return false;

    // 4) Recompute per-skill scores
    const skillScores = skills
      .filter((s) => (s.history ?? []).length > 0)
      .map((skill) => {
        const total = skill.history.length;
        const correctCount = skill.history.filter((h) => h.correct).length;
        const avg_score = Math.round((correctCount / total) * 100);
        // Final level approx: highest level the user got correct, else startLevel-1, clamped
        const correctLevels = skill.history.filter((h) => h.correct).map((h) => h.level);
        const finalLevel = correctLevels.length
          ? Math.max(...correctLevels)
          : Math.max(MIN_LEVEL, (skill.startLevel ?? 1) - 1);
        return {
          skill_id: skill.skill_id,
          avg_score,
          calculated_level: clampLevel(finalLevel),
          target_level: skill.startLevel ?? 1,
          question_count: total,
        };
      });

    const totalAi =
      skillScores.length > 0
        ? Math.round(skillScores.reduce((a, s) => a + s.avg_score, 0) / skillScores.length)
        : 0;

    // 5) Persist (clear scores first to keep idempotent on retry)
    await supabase.from('attempt_skill_scores').delete().eq('attempt_id', attemptId);
    await supabase.from('ai_evaluations').insert(evalRows);
    if (skillScores.length > 0) {
      await supabase.from('attempt_skill_scores').insert(
        skillScores.map((ss) => ({
          attempt_id: attemptId,
          skill_id: ss.skill_id,
          avg_score: ss.avg_score,
          calculated_level: ss.calculated_level,
          target_level: ss.target_level,
          question_count: ss.question_count,
          created_by: userId,
        })),
      );
    }
    await supabase
      .from('assessment_attempts')
      .update({
        total_ai_score: totalAi,
        evaluated_at: now,
        modified_by: userId,
        modified_at: now,
      })
      .eq('id', attemptId);

    await useAttemptStore.getState().fetchAttempts();
    return true;
  },
}));
