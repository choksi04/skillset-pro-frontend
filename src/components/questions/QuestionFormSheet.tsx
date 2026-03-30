import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useQuestionStore, Question, competencyLevels, questionTypes, competencyLabels, questionTypeLabels } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// MCQ helpers
function parseMcqFromText(text: string) {
  try {
    const p = JSON.parse(text);
    if (p?.options?.length === 4) return { questionText: p.questionText || '', options: p.options as [string, string, string, string], correctIndex: p.correctIndex ?? null };
  } catch {}
  return { questionText: '', options: ['', '', '', ''] as [string, string, string, string], correctIndex: null };
}

// Coding helpers
function parseCodingFromText(text: string) {
  try {
    const p = JSON.parse(text);
    if (p?.problemStatement !== undefined) return p as { problemStatement: string; exampleInput: string; exampleOutput: string };
  } catch {}
  return { problemStatement: text || '', exampleInput: '', exampleOutput: '' };
}

// Schemas
const baseSchema = z.object({
  skill_id: z.string().min(1, 'Skill is required'),
  competency_level: z.string().min(1, 'Competency level is required'),
  question_type: z.string().min(1, 'Question type is required'),
});

const scenarioSchema = baseSchema.extend({
  question_text: z.string().trim().min(10, 'Question must be at least 10 characters').max(2000),
  evaluation_guidelines: z.string().trim().min(5, 'Guidelines must be at least 5 characters').max(1000),
});

const mcqSchema = baseSchema.extend({
  question_text: z.string().trim().min(10, 'Question must be at least 10 characters').max(2000),
  options: z.tuple([
    z.string().trim().min(1, 'Option 1 is required'),
    z.string().trim().min(1, 'Option 2 is required'),
    z.string().trim().min(1, 'Option 3 is required'),
    z.string().trim().min(1, 'Option 4 is required'),
  ]),
  correctIndex: z.number({ required_error: 'Select the correct answer' }).min(0).max(3),
});

const codingSchema = baseSchema.extend({
  problemStatement: z.string().trim().min(10, 'Problem statement must be at least 10 characters').max(3000),
  exampleInput: z.string().max(500).optional(),
  exampleOutput: z.string().max(500).optional(),
});

interface QuestionFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuestion?: Question | null;
}

export default function QuestionFormSheet({ open, onOpenChange, editQuestion }: QuestionFormSheetProps) {
  const { addQuestion, updateQuestion } = useQuestionStore();
  const { skills, topics, fetchTopicsForSkill } = useSkillStore();
  const { user } = useAuth();
  const activeSkills = skills.filter((s) => s.status === 'active');

  const [skillId, setSkillId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [level, setLevel] = useState('');
  const [qType, setQType] = useState('');
  const [text, setText] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [mcqOptions, setMcqOptions] = useState<[string, string, string, string]>(['', '', '', '']);
  const [mcqCorrect, setMcqCorrect] = useState<number | null>(null);
  const [problemStatement, setProblemStatement] = useState('');
  const [exampleInput, setExampleInput] = useState('');
  const [exampleOutput, setExampleOutput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Load topics when skill changes
  useEffect(() => { if (skillId) fetchTopicsForSkill(skillId); }, [skillId, fetchTopicsForSkill]);

  useEffect(() => {
    if (!open) return;
    const q = editQuestion;
    setErrors({});

    if (q) {
      // Editing existing question — populate all fields
      setSkillId(q.skill_id ?? '');
      setTopicId(q.topic_id ?? '');
      setLevel(q.competency_level ?? '');
      setQType(q.question_type ?? '');
      setGuidelines(q.evaluation_guidelines ?? '');

      if (q.question_type === 'mcq') {
        const mcq = parseMcqFromText(q.question_text);
        setText(mcq.questionText);
        setMcqOptions(mcq.options);
        setMcqCorrect(mcq.correctIndex);
      } else if (q.question_type === 'coding') {
        const cd = parseCodingFromText(q.question_text ?? '');
        setProblemStatement(cd.problemStatement);
        setExampleInput(cd.exampleInput);
        setExampleOutput(cd.exampleOutput);
        setText('');
      } else {
        setText(q.question_text ?? '');
        setMcqOptions(['', '', '', '']);
        setMcqCorrect(null);
        setProblemStatement('');
        setExampleInput('');
        setExampleOutput('');
      }
    } else {
      // New question — preserve skillId, topicId, level, qType; reset only content
      setGuidelines('');
      setText('');
      setMcqOptions(['', '', '', '']);
      setMcqCorrect(null);
      setProblemStatement('');
      setExampleInput('');
      setExampleOutput('');
    }
  }, [open, editQuestion]);

  const updateOption = (idx: number, val: string) => {
    const next = [...mcqOptions] as [string, string, string, string];
    next[idx] = val;
    setMcqOptions(next);
  };

  const handleSubmit = async () => {
    setErrors({});
    const base = { skill_id: skillId, competency_level: level, question_type: qType };
    let questionText = '';
    let evalGuidelines = '';

    if (qType === 'mcq') {
      const result = mcqSchema.safeParse({ ...base, question_text: text, options: mcqOptions, correctIndex: mcqCorrect });
      if (!result.success) {
        const fe: Record<string, string> = {};
        result.error.errors.forEach((e) => { fe[e.path.join('_') || (e.path[0] as string)] = e.message; });
        setErrors(fe);
        return;
      }
      questionText = JSON.stringify({ questionText: result.data.question_text, options: result.data.options, correctIndex: result.data.correctIndex });
      evalGuidelines = `Correct answer: Option ${result.data.correctIndex + 1}`;
    } else if (qType === 'coding') {
      const result = codingSchema.safeParse({ ...base, problemStatement, exampleInput, exampleOutput });
      if (!result.success) {
        const fe: Record<string, string> = {};
        result.error.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
        setErrors(fe);
        return;
      }
      questionText = JSON.stringify({ problemStatement: result.data.problemStatement!, exampleInput: result.data.exampleInput || '', exampleOutput: result.data.exampleOutput || '' });
      evalGuidelines = '';
    } else {
      const result = scenarioSchema.safeParse({ ...base, question_text: text, evaluation_guidelines: guidelines });
      if (!result.success) {
        const fe: Record<string, string> = {};
        result.error.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
        setErrors(fe);
        return;
      }
      questionText = result.data.question_text;
      evalGuidelines = result.data.evaluation_guidelines;
    }

    const payload = {
      skill_id: skillId,
      topic_id: topicId || null,
      competency_level: level as any,
      question_type: qType as any,
      question_text: questionText,
      evaluation_guidelines: evalGuidelines,
    };

    setSaving(true);
    try {
      if (editQuestion?.id) {
        await updateQuestion(editQuestion.id, payload);
        toast.success('Question updated.');
      } else {
        await addQuestion({
          tenant_id: user?.tenant_id ?? 'tenant-001',
          ...payload,
          status: 'draft',
          ai_generated: false,
        });
        toast.success('Question created as draft.');
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!editQuestion?.id;
  const skillTopics = (topics[skillId] || []).filter((t) => t.status === 'active');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Question' : 'Create Question'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Update question details below.' : 'Fill in the fields to create a new question.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Skill */}
          <div className="space-y-1.5">
            <Label>Skill <span className="text-destructive">*</span></Label>
            <Select value={skillId} onValueChange={(v) => { setSkillId(v); setTopicId(''); }}>
              <SelectTrigger><SelectValue placeholder="Select skill" /></SelectTrigger>
              <SelectContent>
                {activeSkills.map((s) => <SelectItem key={s.id} value={s.id}>{s.skill_name} — {s.skill_category}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.skill_id && <p className="text-xs text-destructive">{errors.skill_id}</p>}
          </div>

          {/* Topic */}
          <div className="space-y-1.5">
            <Label>Topic <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={topicId} onValueChange={setTopicId} disabled={!skillId}>
              <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {skillTopics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Level + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Competency Level <span className="text-destructive">*</span></Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>
                  {competencyLevels.map((l) => <SelectItem key={l} value={l}>{competencyLabels[l]}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.competency_level && <p className="text-xs text-destructive">{errors.competency_level}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Question Type <span className="text-destructive">*</span></Label>
              <Select value={qType} onValueChange={setQType}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {questionTypes.map((t) => <SelectItem key={t} value={t}>{questionTypeLabels[t]}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.question_type && <p className="text-xs text-destructive">{errors.question_type}</p>}
            </div>
          </div>

          {/* Scenario */}
          {qType === 'scenario' && (
            <>
              <div className="space-y-1.5">
                <Label>Question Text <span className="text-destructive">*</span></Label>
                <Textarea placeholder="Write the scenario question..." value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={5} className="font-mono text-sm" />
                <div className="flex justify-between">
                  {errors.question_text && <p className="text-xs text-destructive">{errors.question_text}</p>}
                  <p className="text-xs text-muted-foreground ml-auto">{text.length}/2000</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Evaluation Guidelines <span className="text-destructive">*</span></Label>
                <Textarea placeholder="Criteria for evaluating answers..." value={guidelines} onChange={(e) => setGuidelines(e.target.value)} maxLength={1000} rows={3} />
                <div className="flex justify-between">
                  {errors.evaluation_guidelines && <p className="text-xs text-destructive">{errors.evaluation_guidelines}</p>}
                  <p className="text-xs text-muted-foreground ml-auto">{guidelines.length}/1000</p>
                </div>
              </div>
            </>
          )}

          {/* MCQ */}
          {qType === 'mcq' && (
            <>
              <div className="space-y-1.5">
                <Label>Question Text <span className="text-destructive">*</span></Label>
                <Textarea placeholder="Write the MCQ question..." value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3} />
                <div className="flex justify-between">
                  {errors.question_text && <p className="text-xs text-destructive">{errors.question_text}</p>}
                  <p className="text-xs text-muted-foreground ml-auto">{text.length}/2000</p>
                </div>
              </div>
              <div className="space-y-3">
                <Label>Options & Correct Answer <span className="text-destructive">*</span></Label>
                <RadioGroup value={mcqCorrect !== null ? String(mcqCorrect) : ''} onValueChange={(v) => setMcqCorrect(Number(v))} className="space-y-2">
                  {mcqOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <RadioGroupItem value={String(idx)} id={`opt-${idx}`} />
                      <Input placeholder={`Option ${idx + 1}`} value={opt} onChange={(e) => updateOption(idx, e.target.value)} maxLength={300} className="flex-1 h-9 text-sm" />
                    </div>
                  ))}
                </RadioGroup>
                {errors.correctIndex && <p className="text-xs text-destructive">{errors.correctIndex}</p>}
                <p className="text-xs text-muted-foreground">Select the radio button next to the correct answer.</p>
              </div>
            </>
          )}

          {/* Coding */}
          {qType === 'coding' && (
            <>
              <div className="space-y-1.5">
                <Label>Problem Statement <span className="text-destructive">*</span></Label>
                <Textarea placeholder="Describe the coding problem..." value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)} maxLength={3000} rows={5} className="font-mono text-sm" />
                <div className="flex justify-between">
                  {errors.problemStatement && <p className="text-xs text-destructive">{errors.problemStatement}</p>}
                  <p className="text-xs text-muted-foreground ml-auto">{problemStatement.length}/3000</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Example Input <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea placeholder="e.g. [1, 2, 3]" value={exampleInput} onChange={(e) => setExampleInput(e.target.value)} maxLength={500} rows={2} className="font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label>Example Output <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea placeholder="e.g. 6" value={exampleOutput} onChange={(e) => setExampleOutput(e.target.value)} maxLength={500} rows={2} className="font-mono text-sm" />
                </div>
              </div>
            </>
          )}

          {!qType && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Select a question type above to see the relevant fields.
            </div>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!qType || saving}>
            {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Question'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
