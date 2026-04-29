import { parseQuestionContent, getQuestionDisplayText } from "@/lib/questionContent";

export interface FormattedOption {
  text: string;
  correct: boolean;
}

export interface FormattedQuestion {
  display: string;
  options?: FormattedOption[];
  problemStatement?: string;
  scenario?: string;
  evaluationGuidelines?: string;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function extractOptions(parsed: any, type: string): FormattedOption[] | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const rawOptions = parsed.options ?? parsed.choices ?? parsed.answers;
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) return undefined;

  // Determine correct answer(s)
  const correctIdx = parsed.correctIndex ?? parsed.correct_index ?? parsed.answerIndex;
  const correctIdxArr: number[] = Array.isArray(parsed.correctIndexes ?? parsed.correctIndices)
    ? (parsed.correctIndexes ?? parsed.correctIndices)
    : typeof correctIdx === "number"
    ? [correctIdx]
    : [];

  const correctValue = parsed.correctAnswer ?? parsed.answer;

  return rawOptions.map((opt: any, i: number) => {
    if (typeof opt === "string") {
      const isCorrect =
        correctIdxArr.includes(i) ||
        (typeof correctValue === "string" && correctValue.trim() === opt.trim());
      return { text: opt, correct: isCorrect };
    }
    if (opt && typeof opt === "object") {
      const text = asString(opt.text) ?? asString(opt.label) ?? asString(opt.value) ?? "";
      const correct = !!(opt.correct ?? opt.isCorrect) || correctIdxArr.includes(i);
      return { text, correct };
    }
    return { text: String(opt), correct: correctIdxArr.includes(i) };
  });
}

export function formatQuestionForDisplay(question: {
  question_text: string;
  question_type: string;
  evaluation_guidelines?: string;
}): FormattedQuestion {
  const parsed = parseQuestionContent(question.question_text);
  const display = getQuestionDisplayText(question.question_text, question.question_type);

  const result: FormattedQuestion = {
    display,
    evaluationGuidelines: question.evaluation_guidelines || undefined,
  };

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const p = parsed as any;
    if (question.question_type === "mcq") {
      result.options = extractOptions(p, "mcq");
    }
    if (question.question_type === "coding") {
      result.problemStatement = asString(p.problemStatement) ?? display;
    }
    if (question.question_type === "scenario") {
      result.scenario = asString(p.scenario) ?? asString(p.body) ?? display;
    }
  }

  return result;
}
