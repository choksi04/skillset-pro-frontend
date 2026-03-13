import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useQuestionStore, competencyLevels, questionTypes, competencyLabels, questionTypeLabels, CompetencyLevel, QuestionType } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sparkles, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const genSchema = z.object({
  skill_id: z.string().min(1, 'Skill is required'),
  competency_level: z.string().min(1, 'Level is required'),
  question_type: z.string().min(1, 'Type is required'),
  organization_context: z.string().trim().min(10, 'Context must be at least 10 characters').max(1000, 'Max 1000 characters'),
  count: z.number().min(1).max(10),
});

interface GeneratedPreview {
  question_text: string;
  evaluation_guidelines: string;
  accepted: boolean;
}

function McqPreview({ questionText }: { questionText: string }) {
  try {
    const parsed = JSON.parse(questionText);
    const options: string[] = parsed.options || [];
    const correctIndex: number | null = parsed.correctIndex ?? null;
    return (
      <div className="space-y-2">
        <p className="text-sm text-foreground">{parsed.questionText || ''}</p>
        <div className="grid gap-1.5 pl-1">
          {options.map((opt: string, i: number) => (
            <div
              key={i}
              className={`text-xs px-3 py-1.5 rounded-md border ${
                i === correctIndex
                  ? 'border-success/40 bg-success/10 text-success font-medium'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <span className="font-semibold mr-1.5">{String.fromCharCode(65 + i)}.</span>
              {opt}
              {i === correctIndex && <Badge variant="outline" className="ml-2 text-[10px] border-success/40 text-success">Correct</Badge>}
            </div>
          ))}
        </div>
      </div>
    );
  } catch {
    return <p className="text-sm text-foreground whitespace-pre-wrap">{questionText}</p>;
  }
}

function CodingPreview({ questionText }: { questionText: string }) {
  try {
    const parsed = JSON.parse(questionText);
    return (
      <div className="space-y-2">
        <p className="text-sm text-foreground">{parsed.problemStatement || ''}</p>
        {parsed.exampleInput && (
          <div className="text-xs">
            <span className="font-semibold text-muted-foreground">Input: </span>
            <code className="bg-muted px-1.5 py-0.5 rounded">{parsed.exampleInput}</code>
          </div>
        )}
        {parsed.exampleOutput && (
          <div className="text-xs">
            <span className="font-semibold text-muted-foreground">Output: </span>
            <code className="bg-muted px-1.5 py-0.5 rounded">{parsed.exampleOutput}</code>
          </div>
        )}
      </div>
    );
  } catch {
    return <p className="text-sm text-foreground whitespace-pre-wrap">{questionText}</p>;
  }
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

    try {
      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: {
          skillName: skill?.skill_name ?? 'Unknown',
          competencyLevel: level,
          questionType: qType,
          organizationContext: context,
          count,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        setGenerating(false);
        return;
      }

      const questions: { question_text: string; evaluation_guidelines: string }[] = data?.questions ?? [];
      if (questions.length === 0) {
        toast.warning('No questions were generated. Please try again.');
        setGenerating(false);
        return;
      }

      setPreviews(questions.map((g) => ({ ...g, accepted: true })));
    } catch (err: any) {
      console.error('AI generation failed:', err);
      toast.error(err?.message || 'Failed to generate questions. Please try again.');
    } finally {
      setGenerating(false);
    }
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

    toast.success(`${accepted.length} question(s) saved as draft.`);
    setPreviews([]);
  };

  const acceptedCount = previews.filter((p) => p.accepted).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Sparkles size={18} className="text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">AI-Powered Question Generation</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Uses AI to generate high-quality assessment questions tailored to your skill, level, and organizational context. All generated questions are saved as "Draft" and require admin review before publishing.
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
            {generating ? 'Generating with AI...' : 'Generate Questions'}
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
                  {qType === 'mcq' ? (
                    <McqPreview questionText={p.question_text} />
                  ) : qType === 'coding' ? (
                    <CodingPreview questionText={p.question_text} />
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{p.question_text}</p>
                  )}
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
