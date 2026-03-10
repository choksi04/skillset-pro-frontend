import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useQuestionStore, competencyLevels, questionTypes, competencyLabels, questionTypeLabels, CompetencyLevel, QuestionType, Question } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sparkles, CheckCircle, X, Loader2, AlertTriangle } from 'lucide-react';

const genSchema = z.object({
  skill_id: z.string().min(1, 'Skill is required'),
  competency_level: z.string().min(1, 'Level is required'),
  question_type: z.string().min(1, 'Type is required'),
  organization_context: z.string().trim().min(10, 'Context must be at least 10 characters').max(1000, 'Max 1000 characters'),
  count: z.number().min(1).max(10),
});

// Template-based mock generator (no AI API needed)
function generateMockQuestions(
  skillName: string,
  level: CompetencyLevel,
  type: QuestionType,
  context: string,
  count: number,
): { question_text: string; evaluation_guidelines: string }[] {
  const contextHint = context.length > 50 ? context.slice(0, 50) + '...' : context;

  const scenarioTemplates = [
    `Your team is building an internal portal. A junior developer has implemented a ${skillName} solution that works but has significant performance issues affecting the back-office dashboard. As a ${level}-level practitioner, describe how you would identify the bottlenecks, propose improvements, and ensure the solution scales for the organization's needs. Context: ${contextHint}`,
    `During a sprint review, a stakeholder reports that a critical ${skillName} feature in the internal dashboard is producing incorrect results intermittently. Walk through your systematic approach to diagnosing, reproducing, and resolving this issue at a ${level} level. Context: ${contextHint}`,
    `You're tasked with migrating a legacy internal tool to use modern ${skillName} patterns. The tool is used daily by 200+ back-office staff. Describe your migration strategy, risk mitigation approach, and how you'd ensure zero downtime. Context: ${contextHint}`,
    `A new compliance requirement demands that all ${skillName} implementations in your internal portals must meet specific security and audit standards. How would you assess the current state, plan the remediation, and implement the changes? Context: ${contextHint}`,
    `Your organization needs to integrate ${skillName} with three existing internal systems that have different data formats and APIs. Design an integration strategy that maintains data consistency and handles failures gracefully. Context: ${contextHint}`,
    `A team member proposes replacing the current ${skillName} approach with an alternative technology. Evaluate the trade-offs, create a decision framework, and make a recommendation with justification. Context: ${contextHint}`,
    `The ${skillName} component of your internal dashboard needs to handle a 10x increase in data volume. Describe your approach to scaling the solution while maintaining response times under 2 seconds. Context: ${contextHint}`,
    `During a code review, you find that a ${skillName} implementation follows anti-patterns that could cause issues at scale. How would you address this diplomatically and ensure knowledge sharing across the team? Context: ${contextHint}`,
    `Your team is adopting ${skillName} for a new internal tool. Create an onboarding plan that helps team members of varying experience levels get productive quickly. Context: ${contextHint}`,
    `A production incident was traced to a ${skillName} configuration issue in the back-office system. Describe your incident response, root cause analysis, and preventive measures. Context: ${contextHint}`,
  ];

  const codingTemplates = [
    `Write a ${level}-level ${skillName} implementation that processes and validates form submissions from an internal portal. Include error handling, input sanitization, and proper type definitions. Context: ${contextHint}`,
    `Implement a reusable ${skillName} utility module for an internal dashboard that handles data transformation, caching, and error recovery. Write production-ready code with appropriate tests. Context: ${contextHint}`,
    `Create a ${skillName} solution that implements a search and filter system for an internal records management application. The solution should handle pagination, sorting, and compound filters. Context: ${contextHint}`,
    `Write a ${skillName} component/module that implements role-based access control for an internal admin panel. Include proper authorization checks and audit logging. Context: ${contextHint}`,
    `Implement a ${skillName} solution for batch processing and exporting data from an internal reporting system. Handle large datasets efficiently with progress tracking. Context: ${contextHint}`,
  ];

  const mcqTemplates = [
    `Which of the following best describes the ${level}-level approach to ${skillName} error handling in internal applications?\n\nA) Catch all errors silently to prevent user-facing issues\nB) Implement structured error boundaries with logging, user feedback, and recovery strategies\nC) Let errors propagate to the global handler\nD) Display technical error messages to end users`,
    `When implementing ${skillName} in a back-office portal, which pattern is most appropriate for managing complex state at the ${level} level?\n\nA) Store everything in global state regardless of scope\nB) Use component-local state only\nC) Apply appropriate state management patterns based on data scope, update frequency, and sharing requirements\nD) Avoid state management entirely by reloading data on each interaction`,
    `What is the primary consideration when optimizing ${skillName} performance in an internal dashboard used by 500+ concurrent users?\n\nA) Minimizing code file sizes\nB) Identifying and optimizing critical rendering and data-fetching paths based on usage patterns\nC) Using the latest framework version\nD) Adding more server resources`,
    `In a ${level}-level ${skillName} code review, which issue would you prioritize fixing first?\n\nA) Inconsistent variable naming\nB) Missing input validation on user-facing forms handling sensitive data\nC) Using an older API syntax that still works\nD) Comments that could be more descriptive`,
    `Which testing strategy is most effective for ${skillName} at the ${level} level in internal applications?\n\nA) Only unit tests with 100% coverage\nB) A balanced testing pyramid with unit, integration, and critical path E2E tests\nC) Manual testing before each release\nD) Only E2E tests for user flows`,
  ];

  const templates = type === 'scenario' ? scenarioTemplates : type === 'coding' ? codingTemplates : mcqTemplates;

  const guidelines = type === 'mcq'
    ? 'Correct answer: C (for most MCQs). Evaluate understanding of the concept, not just memorization.'
    : `Evaluate the response at the ${level} level. Look for: depth of analysis, practical applicability to internal/back-office contexts, consideration of trade-offs, and actionable recommendations. ${type === 'coding' ? 'Code should be production-quality with proper error handling and types.' : ''}`;

  const shuffled = [...templates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((q) => ({
    question_text: q,
    evaluation_guidelines: guidelines,
  }));
}

interface GeneratedPreview {
  question_text: string;
  evaluation_guidelines: string;
  accepted: boolean;
}

export default function AIGenerationPage() {
  const { addQuestions, fetchQuestions } = useQuestionStore();
  const { skills, fetchSkills } = useSkillStore();
  const { user } = useAuth();
  useEffect(() => { fetchQuestions(); fetchSkills(); }, [fetchQuestions, fetchSkills]);
  const activeSkills = skills.filter((s) => s.status === 'active');

  const [skillId, setSkillId] = useState('');
  const [level, setLevel] = useState('');
  const [qType, setQType] = useState('');
  const [context, setContext] = useState('This organization primarily builds internal back-office portals and dashboards. Avoid SEO and marketing website scenarios.');
  const [count, setCount] = useState(3);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<GeneratedPreview[]>([]);

  const handleGenerate = async () => {
    const result = genSchema.safeParse({
      skill_id: skillId,
      competency_level: level,
      question_type: qType,
      organization_context: context,
      count,
    });
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
      setErrors(fe);
      return;
    }
    setErrors({});
    setGenerating(true);
    setPreviews([]);

    const skill = skills.find((s) => s.id === skillId);

    // Simulate AI generation delay
    await new Promise((r) => setTimeout(r, 1500));

    const generated = generateMockQuestions(
      skill?.skill_name ?? 'Unknown',
      level as CompetencyLevel,
      qType as QuestionType,
      context,
      count,
    );

    setPreviews(generated.map((g) => ({ ...g, accepted: true })));
    setGenerating(false);
  };

  const togglePreview = (index: number) => {
    setPreviews((prev) => prev.map((p, i) => i === index ? { ...p, accepted: !p.accepted } : p));
  };

  const handlePublishAccepted = () => {
    const accepted = previews.filter((p) => p.accepted);
    if (accepted.length === 0) return;

    addQuestions(accepted.map((p) => ({
      tenant_id: user?.tenant_id ?? 'tenant-001',
      skill_id: skillId,
      competency_level: level as CompetencyLevel,
      question_type: qType as QuestionType,
      question_text: p.question_text,
      evaluation_guidelines: p.evaluation_guidelines,
      status: 'draft' as const,
      ai_generated: true,
    })));

    setPreviews([]);
  };

  const acceptedCount = previews.filter((p) => p.accepted).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">AI Question Generation</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Currently using template-based generation. Connect an AI provider (OpenAI, Gemini, etc.) via Lovable Cloud for true AI-powered generation. All generated questions are saved as "Draft" and require admin review before publishing.
          </p>
        </div>
      </div>

      {/* Generation Form */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-card-foreground">Generation Parameters</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Skill</Label>
            <Select value={skillId} onValueChange={setSkillId}>
              <SelectTrigger><SelectValue placeholder="Select skill" /></SelectTrigger>
              <SelectContent>
                {activeSkills.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.skill_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.skill_id && <p className="text-xs text-destructive">{errors.skill_id}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Competency Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                {competencyLevels.map((l) => <SelectItem key={l} value={l}>{competencyLabels[l]}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.competency_level && <p className="text-xs text-destructive">{errors.competency_level}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Question Type</Label>
            <Select value={qType} onValueChange={setQType}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {questionTypes.map((t) => <SelectItem key={t} value={t}>{questionTypeLabels[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.question_type && <p className="text-xs text-destructive">{errors.question_type}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Organization Context</Label>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Describe the organization context to generate relevant questions..."
          />
          <div className="flex justify-between">
            {errors.organization_context && <p className="text-xs text-destructive">{errors.organization_context}</p>}
            <p className="text-xs text-muted-foreground ml-auto">{context.length}/1000</p>
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <Label>Number of Questions</Label>
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 5, 10].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Generating...' : 'Generate Questions'}
          </Button>
        </div>
      </div>

      {/* Preview / Review */}
      {previews.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Review Generated Questions ({acceptedCount}/{previews.length} accepted)
            </h3>
            <Button size="sm" onClick={handlePublishAccepted} disabled={acceptedCount === 0} className="gap-1.5">
              <CheckCircle size={14} /> Save {acceptedCount} as Draft
            </Button>
          </div>

          {previews.map((p, i) => (
            <div
              key={i}
              className={`rounded-xl border bg-card overflow-hidden transition-all ${
                p.accepted ? 'border-success/30' : 'border-border opacity-50'
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                <button
                  onClick={() => togglePreview(i)}
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    p.accepted
                      ? 'bg-success border-success text-success-foreground'
                      : 'border-border hover:border-foreground'
                  }`}
                >
                  {p.accepted && <CheckCircle size={12} />}
                </button>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{p.question_text}</p>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Evaluation Guidelines</p>
                    <p className="text-xs text-muted-foreground">{p.evaluation_guidelines}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
