import { useMemo } from "react";
import { AssessmentAttempt } from "@/stores/attemptStore";
import { useSkillStore } from "@/stores/skillStore";
import { useCompetencyLevelStore, getFormattedLevelLabel } from "@/stores/competencyLevelStore";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Award, MessageSquare } from "lucide-react";

interface Props {
  attempt: AssessmentAttempt;
  review?: any;
}

/**
 * Shows the simplified Result Summary for an assessment attempt.
 * - Achieved Level (max-level-among-correct, averaged across skills)
 * - Verified Level (only when manager review is completed)
 * - Counts: attempted / correct / wrong
 * - Skill-wise breakdown
 */
export default function ResultSummaryCard({ attempt, review }: Props) {
  const { skills } = useSkillStore();
  const { levels: competencyLevels } = useCompetencyLevelStore();

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  // Derive per-skill stats from adaptive_state.history (preferred) or skill_scores fallback.
  const adaptive: any = (attempt as any).adaptive_state ?? {};
  const adaptiveSkills: any[] = Array.isArray(adaptive?.skills) ? adaptive.skills : [];

  const breakdown = useMemo(() => {
    if (adaptiveSkills.length > 0) {
      return adaptiveSkills
        .filter((s) => Array.isArray(s.history) && s.history.length > 0)
        .map((s) => {
          const total = s.history.length;
          const correct = s.history.filter((h: any) => h.correct).length;
          const correctLevels = s.history
            .filter((h: any) => h.correct)
            .map((h: any) => h.level as number);
          const achieved = correctLevels.length ? Math.max(...correctLevels) : null;
          return {
            skill_id: s.skill_id as string,
            total,
            correct,
            wrong: total - correct,
            achieved,
          };
        });
    }
    // Fallback to skill_scores (non-adaptive or missing history)
    return attempt.skill_scores.map((ss) => ({
      skill_id: ss.skill_id,
      total: ss.question_count,
      correct: Math.round((ss.avg_score / 100) * ss.question_count),
      wrong: ss.question_count - Math.round((ss.avg_score / 100) * ss.question_count),
      achieved: ss.calculated_level,
    }));
  }, [adaptiveSkills, attempt.skill_scores]);

  const totalAttempted = breakdown.reduce((a, b) => a + b.total, 0);
  const totalCorrect = breakdown.reduce((a, b) => a + b.correct, 0);
  const totalWrong = totalAttempted - totalCorrect;

  // Overall achieved level = rounded average of per-skill achieved levels (skipping nulls).
  const achievedLevels = breakdown.map((b) => b.achieved).filter((l): l is number => typeof l === "number");
  const overallAchieved = achievedLevels.length
    ? Math.round(achievedLevels.reduce((a, b) => a + b, 0) / achievedLevels.length)
    : null;

  // Verified level (manager review)
  const verifiedLevels = (review?.skill_reviews ?? [])
    .map((s: any) => s.verified_level)
    .filter((v: any) => typeof v === "number");
  const verifiedAvg =
    verifiedLevels.length > 0
      ? Math.round(verifiedLevels.reduce((a: number, b: number) => a + b, 0) / verifiedLevels.length)
      : null;
  const showVerified = verifiedAvg != null && review?.status === "completed";

  // Per-skill manager comments lookup
  const skillReviewMap = useMemo(
    () => new Map((review?.skill_reviews ?? []).map((sr: any) => [sr.skill_id, sr])),
    [review?.skill_reviews]
  );
  const reviewCompleted = review?.status === "completed";
  const overallComment = (review?.overall_comment ?? "").trim();
  const completedAt = review?.completed_at
    ? new Date(review.completed_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Award size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Result Summary</h3>
      </div>

      {/* Achieved + Verified levels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Assessment Score (Achieved Level)
          </p>
          {overallAchieved != null ? (
            <Badge className="text-sm h-7 px-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
              {getFormattedLevelLabel(competencyLevels, overallAchieved)}
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">Not achieved</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Verified Level</p>
          {showVerified ? (
            <Badge className="text-sm h-7 px-3 bg-success/10 text-success border-success/20 hover:bg-success/15">
              {getFormattedLevelLabel(competencyLevels, verifiedAvg!)}
            </Badge>
          ) : (
            <p className="text-xs text-muted-foreground">Pending manager review</p>
          )}
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Attempted</p>
          <p className="text-xl font-semibold text-foreground">{totalAttempted}</p>
        </div>
        <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-success/80 mb-1">Correct</p>
          <p className="text-xl font-semibold text-success flex items-center justify-center gap-1">
            <CheckCircle size={14} /> {totalCorrect}
          </p>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-destructive/80 mb-1">Wrong</p>
          <p className="text-xl font-semibold text-destructive flex items-center justify-center gap-1">
            <XCircle size={14} /> {totalWrong}
          </p>
        </div>
      </div>

      {/* Skill-wise breakdown */}
      {breakdown.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">Skill-wise breakdown</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr className="text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Skill</th>
                  <th className="text-center px-3 py-2 font-medium">Correct / Total</th>
                  <th className="text-right px-3 py-2 font-medium">Achieved Level</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((b) => {
                  const skill = skillMap.get(b.skill_id);
                  return (
                    <tr key={b.skill_id} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{skill?.skill_name ?? b.skill_id}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">
                        {b.correct} / {b.total}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {b.achieved != null ? (
                          <Badge variant="outline" className="text-[10px]">
                            {getFormattedLevelLabel(competencyLevels, b.achieved)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
