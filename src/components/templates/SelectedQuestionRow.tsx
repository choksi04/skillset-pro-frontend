import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Question } from "@/stores/questionStore";
import { formatQuestionForDisplay } from "@/lib/questionFormat";

interface Props {
  index?: number;
  question: Question | undefined;
  fallbackId: string;
  skillName?: string;
  levelLabel?: string;
  onRemove?: () => void;
  onClick?: () => void;
}

export default function SelectedQuestionRow({
  index,
  question,
  fallbackId,
  skillName,
  levelLabel,
  onRemove,
  onClick,
}: Props) {
  const display = question
    ? formatQuestionForDisplay(question).display
    : `Question ${fallbackId.slice(0, 8)}…`;

  const clickable = !!onClick && !!question;

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`flex items-start justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 ${
        clickable ? "cursor-pointer hover:bg-muted/40 hover:border-primary/40 transition-colors" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground line-clamp-2">
          {typeof index === "number" && (
            <span className="text-muted-foreground mr-1">{index + 1}.</span>
          )}
          {display}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {skillName && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {skillName}
            </Badge>
          )}
          {levelLabel && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {levelLabel}
            </Badge>
          )}
          {question && (
            <Badge variant="outline" className="text-[10px] font-normal capitalize">
              {question.question_type}
            </Badge>
          )}
        </div>
      </div>
      {onRemove && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove question"
        >
          <X size={13} />
        </Button>
      )}
    </div>
  );
}
