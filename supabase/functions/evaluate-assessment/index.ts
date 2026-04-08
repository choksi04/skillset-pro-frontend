import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnswerPayload {
  question_id: string;
  answer_text: string;
  question_text: string;
  question_type: string;
  evaluation_guidelines: string;
  skill_id: string;
}

interface DimensionScore {
  dimension: string;
  score: number;
  comment: string;
}

interface EvaluationResult {
  question_id: string;
  score: number;
  feedback: string;
  dimensions: DimensionScore[];
  confidence: number;
}

/**
 * Evaluate MCQ by parsing correctIndex from question_text JSON.
 * User answer is a letter (A/B/C/D) converted to index 0-3.
 */
function evaluateMCQ(answer: AnswerPayload): EvaluationResult {
  let correctIndex: number | null = null;

  // Primary: parse question_text JSON for correctIndex
  try {
    const parsed = JSON.parse(answer.question_text);
    if (typeof parsed.correctIndex === 'number') {
      correctIndex = parsed.correctIndex;
    }
  } catch { /* not JSON, fall through */ }

  // Fallback: try evaluation_guidelines for "correctIndex: N" or "Correct answer: X"
  if (correctIndex === null && answer.evaluation_guidelines) {
    const idxMatch = answer.evaluation_guidelines.match(/correctIndex[:\s]*(\d)/i);
    if (idxMatch) {
      correctIndex = parseInt(idxMatch[1], 10);
    } else {
      const letterMatch = answer.evaluation_guidelines.match(/correct\s*(?:answer)?[:\s]*([A-D])/i);
      if (letterMatch) {
        correctIndex = letterMatch[1].toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
      }
    }
  }

  // Convert user answer letter to index
  const userText = answer.answer_text.trim().toUpperCase();
  let userIndex: number | null = null;
  if (/^[A-D]$/.test(userText)) {
    userIndex = userText.charCodeAt(0) - 65;
  } else {
    // Try parsing as number (0-3)
    const num = parseInt(userText, 10);
    if (!isNaN(num) && num >= 0 && num <= 3) {
      userIndex = num;
    }
  }

  if (correctIndex === null) {
    // Cannot determine correct answer — return 0 with explanation
    return {
      question_id: answer.question_id,
      score: 0,
      feedback: 'Could not determine the correct answer from question data. Please review manually.',
      dimensions: [
        { dimension: 'Correctness', score: 0, comment: 'Correct answer index not found in question data.' },
        { dimension: 'Knowledge', score: 0, comment: 'Unable to evaluate.' },
      ],
      confidence: 0.1,
    };
  }

  const isCorrect = userIndex === correctIndex;
  const score = isCorrect ? 100 : 0;
  const correctLetter = String.fromCharCode(65 + correctIndex);

  return {
    question_id: answer.question_id,
    score,
    feedback: isCorrect
      ? 'Correct answer selected.'
      : `Incorrect. The correct answer was ${correctLetter}.`,
    dimensions: [
      { dimension: 'Correctness', score: isCorrect ? 100 : 0, comment: isCorrect ? 'Answer matches the correct option.' : `Selected answer does not match correct option (${correctLetter}).` },
      { dimension: 'Knowledge', score: isCorrect ? 90 : 10, comment: isCorrect ? 'Demonstrates knowledge of the concept.' : 'Incorrect selection suggests gaps in understanding.' },
    ],
    confidence: 0.99,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { attempt_id, answers } = await req.json() as { attempt_id: string; answers: AnswerPayload[] };

    if (!answers || !Array.isArray(answers)) {
      return new Response(JSON.stringify({ error: "Invalid answers payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const evaluations: EvaluationResult[] = [];

    // Split into MCQ (auto-eval) and non-MCQ (AI eval)
    const mcqAnswers = answers.filter((a) => a.question_type === 'mcq');
    const aiAnswers = answers.filter((a) => a.question_type !== 'mcq');

    // Auto-evaluate MCQs
    for (const mcq of mcqAnswers) {
      evaluations.push(evaluateMCQ(mcq));
    }

    // AI evaluate scenario/coding questions in batch
    if (aiAnswers.length > 0) {
      const systemPrompt = `You are an expert technical assessment evaluator. Evaluate each answer with rigorous accuracy and provide step-by-step reasoning.

For each answer, you MUST return a JSON object with:
- "question_id": the question ID (string)
- "score": integer 0-100
- "reasoning": step-by-step explanation of how you arrived at the score (string)
- "feedback": 1-3 sentence actionable feedback for the employee (string)
- "dimensions": array of exactly 4 objects, each with "dimension" (string), "score" (integer 0-100), "comment" (string)
  Dimensions: "Concept Understanding", "Technical Correctness", "Solution Practicality", "Clarity"
- "confidence": float 0.0-1.0

Scoring guide (be precise and consistent):
- 0-10: Empty, irrelevant, or no meaningful attempt
- 11-39: Insufficient — shows minimal understanding, major errors or omissions
- 40-59: Basic understanding — partially correct but significant gaps
- 60-74: Competent — mostly correct with minor issues
- 75-89: Strong — comprehensive with only minor imperfections
- 90-100: Excellent — thorough, accurate, well-structured, demonstrates deep expertise

CRITICAL RULES:
- Empty or very short answers (< 10 chars) MUST score 0-10
- Evaluate against the provided evaluation guidelines when available
- Be consistent: similar quality answers must receive similar scores
- Each dimension score should be justified independently

Return ONLY a JSON array of evaluation objects. No other text.`;

      const questionsText = aiAnswers.map((a, i) => {
        let questionDisplay = a.question_text;
        try {
          const parsed = JSON.parse(a.question_text);
          if (parsed.problemStatement) questionDisplay = parsed.problemStatement;
          else if (parsed.question_text) questionDisplay = parsed.question_text;
          else if (parsed.questionText) questionDisplay = parsed.questionText;
        } catch { /* use as-is */ }

        return `--- Question ${i + 1} ---
ID: ${a.question_id}
Type: ${a.question_type}
Question: ${questionDisplay}
${a.evaluation_guidelines ? `Evaluation Guidelines: ${a.evaluation_guidelines}` : ''}
Employee Answer: ${a.answer_text || '(no answer provided)'}`;
      }).join('\n\n');

      const userPrompt = `Evaluate the following ${aiAnswers.length} answer(s):\n\n${questionsText}\n\nReturn a JSON array with one evaluation object per question. Include step-by-step reasoning for each score.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        return new Response(JSON.stringify({ error: "AI evaluation failed. Please retry." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiResult = await response.json();
      const rawContent = aiResult.choices?.[0]?.message?.content ?? "[]";

      let jsonStr = rawContent.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();

      try {
        let aiEvals = JSON.parse(jsonStr);
        if (!Array.isArray(aiEvals)) aiEvals = [aiEvals];

        for (const ev of aiEvals) {
          const dims: DimensionScore[] = Array.isArray(ev.dimensions) ? ev.dimensions.slice(0, 4).map((d: any) => ({
            dimension: d.dimension || 'General',
            score: Math.max(0, Math.min(100, Number(d.score) || 0)),
            comment: d.comment || '',
          })) : [];

          evaluations.push({
            question_id: ev.question_id || '',
            score: Math.max(0, Math.min(100, Number(ev.score) || 0)),
            feedback: ev.feedback || 'Evaluation completed.',
            dimensions: dims,
            confidence: Math.max(0, Math.min(1, Number(ev.confidence) || 0.7)),
          });
        }
      } catch (parseError) {
        console.error("Failed to parse AI evaluation:", parseError, jsonStr);
        for (const a of aiAnswers) {
          evaluations.push({
            question_id: a.question_id,
            score: 0,
            feedback: 'AI evaluation could not parse response. Please retry.',
            dimensions: [],
            confidence: 0,
          });
        }
      }
    }

    return new Response(JSON.stringify({ evaluations, attempt_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-assessment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
