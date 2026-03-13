import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { skillName, competencyLevel, questionType, organizationContext, count } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const mcqFormat = `Return each question as a JSON object with:
- "questionText": the question stem (string)
- "options": array of exactly 4 option strings (no A/B/C/D prefixes)
- "correctIndex": zero-based index (0-3) of the correct option
- "evaluation_guidelines": brief explanation of why the correct answer is right`;

    const scenarioFormat = `Return each question as a JSON object with:
- "question_text": the full scenario question (string)
- "evaluation_guidelines": detailed rubric for evaluating the answer`;

    const codingFormat = `Return each question as a JSON object with:
- "problemStatement": the coding problem description (string)
- "exampleInput": example input (string)
- "exampleOutput": expected output (string)
- "evaluation_guidelines": rubric for evaluating code quality, correctness, and approach`;

    const formatInstructions =
      questionType === "mcq" ? mcqFormat :
      questionType === "coding" ? codingFormat : scenarioFormat;

    const systemPrompt = `You are an expert assessment question generator for technical skills evaluation in enterprise organizations. Generate high-quality, practical questions that test real-world competency.

Rules:
- Questions must be at the "${competencyLevel}" competency level
- Questions must test "${skillName}" skill
- Questions must be relevant to this organizational context: "${organizationContext}"
- Each question must be unique and test different aspects of the skill
- For MCQs: exactly 4 options, 1 correct answer, options should be plausible
- For coding: include clear problem statements with example input/output
- For scenarios: create realistic workplace situations requiring analysis`;

    const userPrompt = `Generate exactly ${count} ${questionType} question(s) for the skill "${skillName}" at the "${competencyLevel}" level.

${formatInstructions}

Return a JSON array of ${count} question object(s). Only return the JSON array, no other text.`;

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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content ?? "[]";

    // Extract JSON array from response (handle markdown code blocks)
    let jsonStr = rawContent.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    let questions: any[];
    try {
      questions = JSON.parse(jsonStr);
      if (!Array.isArray(questions)) questions = [questions];
    } catch {
      console.error("Failed to parse AI response:", jsonStr);
      return new Response(JSON.stringify({ error: "AI returned invalid format. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize output format based on question type
    const normalized = questions.map((q: any) => {
      if (questionType === "mcq") {
        const options = Array.isArray(q.options) ? q.options.slice(0, 4) : ["", "", "", ""];
        while (options.length < 4) options.push("");
        const correctIndex = typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex <= 3
          ? q.correctIndex : 0;
        return {
          question_text: JSON.stringify({ questionText: q.questionText || q.question_text || "", options, correctIndex }),
          evaluation_guidelines: q.evaluation_guidelines || `Correct answer: ${String.fromCharCode(65 + correctIndex)}. ${q.explanation || ""}`,
        };
      }
      if (questionType === "coding") {
        return {
          question_text: JSON.stringify({
            problemStatement: q.problemStatement || q.question_text || "",
            exampleInput: q.exampleInput || "",
            exampleOutput: q.exampleOutput || "",
          }),
          evaluation_guidelines: q.evaluation_guidelines || "",
        };
      }
      // scenario
      return {
        question_text: q.question_text || q.questionText || "",
        evaluation_guidelines: q.evaluation_guidelines || "",
      };
    });

    return new Response(JSON.stringify({ questions: normalized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
