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

function evaluateMCQ(answer: AnswerPayload): EvaluationResult {
  const guidelines = answer.evaluation_guidelines.toLowerCase();
  const correctMatch = guidelines.match(/correct\s*(?:answer)?[:\s]*([A-D])/i);
  const correctAnswer = correctMatch?.[1]?.toUpperCase();
  const userAnswer = answer.answer_text.trim().toUpperCase();
  const isCorrect = correctAnswer === userAnswer;
  const score = isCorrect ? 100 : 0;

  return {
    question_id: answer.question_id,
    score,
    feedback: isCorrect
      ? 'Correct answer selected.'
      : `Incorrect. The correct answer was ${correctAnswer ?? 'not determined'}.`,
    dimensions: [
      { dimension: 'Correctness', score: isCorrect ? 100 : 0, comment: isCorrect ? 'Answer matches the correct option.' : 'Answer does not match the correct option.' },
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
      const systemPrompt = `You are an expert technical assessment evaluator. Evaluate each answer objectively.

For each answer, you MUST return a JSON object with:
- "question_id": the question ID (string)
- "score": integer 0-100
- "feedback": 1-3 sentence feedback (string)
- "dimensions": array of exactly 4 objects, each with "dimension" (string), "score" (integer 0-100), "comment" (string)
  Dimensions: "Concept Understanding", "Technical Correctness", "Solution Practicality", "Clarity"
- "confidence": float 0.0-1.0

Scoring guide:
- 0-39: Insufficient/incorrect
- 40-59: Basic understanding, gaps present
- 60-74: Competent, mostly correct
- 75-89: Strong, with minor issues
- 90-100: Excellent, comprehensive

Empty or very short answers should score 0-10.

Return ONLY a JSON array of evaluation objects. No other text.`;

      const questionsText = aiAnswers.map((a, i) => {
        let questionDisplay = a.question_text;
        // Try to parse JSON question text for better display
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

      const userPrompt = `Evaluate the following ${aiAnswers.length} answer(s):\n\n${questionsText}\n\nReturn a JSON array with one evaluation object per question.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
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
        // Fallback: return zero scores for AI questions
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
