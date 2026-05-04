import { useEffect, useMemo, useState } from "react";
import { ManagerReview } from "@/stores/reviewStore";
import { useSkillStore } from "@/stores/skillStore";
import { useCompetencyLevelStore, getFormattedLevelLabel } from "@/stores/competencyLevelStore";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, ChevronDown, MessageSquare } from "lucide-react";

interface Props {
  review: ManagerReview;
}

/**
 * Read-only manager feedback shown to the assessment owner (employee)
 * once the manager has completed the review. Displays per-skill verified
 * level + comment, and the overall comment.
 */
export default function ManagerFeedbackPanel({ review }: Props) {
  const { skills } = useSkillStore();
  const { levels } = useCompetencyLevelStore();
  const [reviewerName, setReviewerName] = useState<string>("");

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  useEffect(() => {
    if (!review.reviewer_id) return;
    supabase
      .from("users")
      .select("full_name")
      .eq("id", review.reviewer_id)
      .single()
      .then(({ data }) => {
        if (data) setReviewerName(data.full_name);
      });
  }, [review.reviewer_id]);

  const completedDate = review.completed_at
    ? new Date(review.completed_at).toLocaleDateString()
    : null;

  const hasOverall = !!review.overall_comment?.trim();

  return (
    <Collapsible defaultOpen>
      <div className="rounded-xl border border-border bg-card">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors group">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Manager Feedback</h3>
            <Badge className="text-[10px] bg-success/15 text-success border-success/20 gap-1">
              <CheckCircle size={10} /> Approved
            </Badge>
            <span className="text-xs text-muted-foreground">
              {reviewerName ? `Reviewed by ${reviewerName}` : "Reviewed"}
              {completedDate ? ` · ${completedDate}` : ""}
            </span>
          </div>
          <ChevronDown
            size={14}
            className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border p-5 space-y-4">
            {/* Per-skill comments */}
            <div className="space-y-3">
              {review.skill_reviews.map((sr) => {
                const skillName = skillMap.get(sr.skill_id)?.skill_name ?? sr.skill_id;
                const comment = sr.manager_comment?.trim();
                return (
                  <div
                    key={sr.skill_id}
                    className="rounded-lg border border-border bg-background/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{skillName}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          Self: L{sr.self_rating}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          AI: {getFormattedLevelLabel(levels, sr.ai_calculated_level)}
                        </Badge>
                        <Badge className="text-[10px] bg-primary/15 text-primary border-primary/20">
                          Verified: {getFormattedLevelLabel(levels, sr.verified_level)}
                        </Badge>
                      </div>
                    </div>
                    {comment ? (
                      <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{comment}</p>
                    ) : (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        No comment from manager for this skill.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall comment */}
            {hasOverall && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Overall Comment
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {review.overall_comment}
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
