import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the subset of `skillIds` that have at least one eligible MCQ
 * (question_type = 'mcq', status = 'published', not soft-deleted).
 *
 * Uses a per-skill HEAD count instead of listing rows: a listing query
 * (`select('skill_id').in(...)`) is capped at 1000 rows by PostgREST, which
 * silently hides skills whose rows fall past the cutoff and causes whole
 * skills to be dropped from generated assessments.
 */
export async function getSkillsWithPublishedMcqs(skillIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(skillIds.filter(Boolean))];
  const available = new Set<string>();
  const BATCH = 8;

  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (skillId) => {
        const { count, error } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('skill_id', skillId)
          .eq('question_type', 'mcq')
          .eq('status', 'published')
          .is('deleted_on', null);
        if (error) {
          console.error('questionAvailability: count failed for skill', skillId, error);
          return { skillId, count: 0 };
        }
        return { skillId, count: count ?? 0 };
      }),
    );
    results.forEach((r) => {
      if (r.count > 0) available.add(r.skillId);
    });
  }

  return available;
}
