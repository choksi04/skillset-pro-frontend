import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Sparkles, User } from "lucide-react";
import { Question, questionTypeLabels } from "@/stores/questionStore";

const statusStyles: Record<string, string> = {
  published: "bg-success/15 text-success border-success/20",
  draft: "bg-warning/15 text-warning border-warning/20",
  disabled: "bg-muted text-muted-foreground border-border",
};

function parseQuestionText(text: string, type: string): { display: string; parsed: any | null } {
  try {
    const parsed = JSON.parse(text);
    if (type === "mcq" && parsed?.questionText) return { display: parsed.questionText, parsed };
    if (type === "coding" && parsed?.problemStatement) return { display: parsed.problemStatement, parsed };
  } catch { /* plain text */ }
  return { display: text, parsed: null };
}

function tryParseAiText(text: string, type: string): any | null {
  try {
    return JSON.parse(text);
  } catch { /* not JSON */ }

  if (type === "mcq") {
    const lines = text.split("\n").filter((l) => l.trim());
    const optionPatterns = [
      /^[A-D]\)\s*(.+)/i,
      /^[A-D]\.\s*(.+)/i,
      /^[1-4]\)\s*(.+)/i,
      /^[1-4]\.\s*(.+)/i,
    ];
    const options: string[] = [];
    let questionText = "";
    let correctIndex = 0;

    for (const line of lines) {
      let matched = false;
      for (const pat of optionPatterns) {
        const m = line.trim().match(pat);
        if (m) {
          let optText = m[1].trim();
          if (optText.includes("✓") || optText.includes("(correct)") || optText.includes("*")) {
            correctIndex = options.length;
            optText = optText.replace(/[✓*]|\(correct\)/gi, "").trim();
          }
          options.push(optText);
          matched = true;
          break;
        }
      }
      if (!matched && options.length === 0) {
        questionText += (questionText ? "\n" : "") + line.trim();
      }
    }
    if (options.length >= 2) {
      return { questionText: questionText || text.split("\n")[0], options, correctIndex };
    }
  }

  return null;
}

export function FormattedQuestionContent({
  text, guidelines, type,
}: {
  text: string;
  guidelines?: string;
  type: string;
}) {
  const { display, parsed: jsonParsed } = parseQuestionText(text, type);
  const parsed = jsonParsed || tryParseAiText(text, type);

  if (type === "mcq" && parsed) {
    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Question</h4>
          <p className="text-sm text-foreground">{parsed.questionText || display}</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Options</h4>
          <div className="space-y-1.5">
            {(parsed.options || []).map((opt: string, idx: number) => (
              <div key={idx} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                idx === parsed.correctIndex ? "border-success/40 bg-success/5" : "border-border"
              }`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  idx === parsed.correctIndex ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                }`}>{String.fromCharCode(65 + idx)}</span>
                <span>{opt}</span>
                {idx === parsed.correctIndex && <CheckCircle size={14} className="ml-auto text-success" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "coding" && parsed) {
    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Problem Statement</h4>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{parsed.problemStatement}</p>
          </div>
        </div>
        {(parsed.exampleInput || parsed.exampleOutput) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {parsed.exampleInput && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Example Input</h4>
                <pre className="text-xs rounded-lg p-3 font-mono whitespace-pre-wrap bg-[hsl(var(--foreground)/0.05)] border border-border text-foreground">{parsed.exampleInput}</pre>
              </div>
            )}
            {parsed.exampleOutput && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Example Output</h4>
                <pre className="text-xs rounded-lg p-3 font-mono whitespace-pre-wrap bg-[hsl(var(--foreground)/0.05)] border border-border text-foreground">{parsed.exampleOutput}</pre>
              </div>
            )}
          </div>
        )}
        {guidelines && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Evaluation Guidelines</h4>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm text-foreground whitespace-pre-wrap">{guidelines}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Question</h4>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{display}</p>
        </div>
      </div>
      {guidelines && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Evaluation Guidelines</h4>
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            {guidelines.split("\n").map((line, i) => {
              const trimmed = line.trim();
              if (!trimmed) return <br key={i} />;
              if (/^[-•]\s/.test(trimmed)) {
                return <p key={i} className="text-sm text-foreground pl-3 flex gap-1.5 items-start"><span className="text-muted-foreground mt-0.5">•</span><span>{trimmed.replace(/^[-•]\s*/, "")}</span></p>;
              }
              if (/^\d+[.)]\s/.test(trimmed)) {
                const num = trimmed.match(/^(\d+)[.)]\s*/)?.[1];
                return <p key={i} className="text-sm text-foreground pl-3 flex gap-1.5 items-start"><span className="text-muted-foreground font-medium mt-0.5">{num}.</span><span>{trimmed.replace(/^\d+[.)]\s*/, "")}</span></p>;
              }
              return <p key={i} className="text-sm text-foreground">{trimmed}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuestionDetailSheet({
  question, skillName, topicName, onClose, levelLabels,
}: {
  question: Question;
  skillName: string;
  topicName: string | null;
  onClose: () => void;
  levelLabels: Record<string, string>;
}) {
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Question Details</SheetTitle>
          <SheetDescription>
            {skillName}{topicName ? ` → ${topicName}` : ""} · {levelLabels[question.competency_level] || question.competency_level} · {questionTypeLabels[question.question_type]}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            <Badge className={`text-xs border ${statusStyles[question.status]}`}>{question.status}</Badge>
            {question.ai_generated ? (
              <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary"><Sparkles size={10} /> AI Generated</Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1 border-border text-muted-foreground"><User size={10} /> Manual</Badge>
            )}
            <Badge variant="secondary" className="text-xs">{questionTypeLabels[question.question_type]}</Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            Created {new Date(question.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
          </p>

          <FormattedQuestionContent
            text={question.question_text}
            guidelines={question.evaluation_guidelines}
            type={question.question_type}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
