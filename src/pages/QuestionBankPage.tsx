import { useState, useMemo, useEffect, useCallback } from 'react';
import { z } from 'zod';
import {
  useQuestionStore, Question, QuestionStatus, questionTypes,
  questionTypeLabels, CompetencyLevel, QuestionType,
} from '@/stores/questionStore';
import { useCompetencyLevelStore, getActiveLevelIds, getLevelLabelsByIdMap, getLevelNameById } from '@/stores/competencyLevelStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import QuestionFormSheet from '@/components/questions/QuestionFormSheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  Plus, Search, Pencil, ToggleLeft, ToggleRight, CheckCircle, HelpCircle,
  Sparkles, Trash2, MoreHorizontal, Loader2, ChevronDown, ChevronRight,
  AlertTriangle, Copy, Eye, Bot, User, CheckSquare, ChevronLeft,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';

const statusStyles: Record<string, string> = {
  published: 'bg-success/15 text-success border-success/20',
  draft: 'bg-warning/15 text-warning border-warning/20',
  disabled: 'bg-muted text-muted-foreground border-border',
};

function parseQuestionText(text: string, type: string): { display: string; parsed: any | null } {
  try {
    const parsed = JSON.parse(text);
    if (type === 'mcq' && parsed?.questionText) return { display: parsed.questionText, parsed };
    if (type === 'coding' && parsed?.problemStatement) return { display: parsed.problemStatement, parsed };
  } catch { /* plain text */ }
  return { display: text, parsed: null };
}

/** Try to extract structured data from AI-generated text even if not JSON */
function tryParseAiText(text: string, type: string): any | null {
  // First try JSON
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch { /* not JSON */ }

  // For MCQ: try to detect options pattern in plain text
  if (type === 'mcq') {
    const lines = text.split('\n').filter(l => l.trim());
    // Look for lines starting with A) B) C) D) or a) b) c) d) or 1. 2. 3. 4.
    const optionPatterns = [
      /^[A-D]\)\s*(.+)/i,
      /^[A-D]\.\s*(.+)/i,
      /^[1-4]\)\s*(.+)/i,
      /^[1-4]\.\s*(.+)/i,
    ];
    const options: string[] = [];
    let questionText = '';
    let correctIndex = 0;

    for (const line of lines) {
      let matched = false;
      for (const pat of optionPatterns) {
        const m = line.trim().match(pat);
        if (m) {
          let optText = m[1].trim();
          // Check for correct answer marker
          if (optText.includes('✓') || optText.includes('(correct)') || optText.includes('*')) {
            correctIndex = options.length;
            optText = optText.replace(/[✓*]|\(correct\)/gi, '').trim();
          }
          options.push(optText);
          matched = true;
          break;
        }
      }
      if (!matched && options.length === 0) {
        questionText += (questionText ? '\n' : '') + line.trim();
      }
    }
    if (options.length >= 2) {
      return { questionText: questionText || text.split('\n')[0], options, correctIndex };
    }
  }

  return null;
}

// AI generation validation
const genSchema = z.object({
  skill_id: z.string().min(1, 'Skill is required'),
  competency_level: z.string().min(1, 'Level is required'),
  question_type: z.string().min(1, 'Type is required'),
  organization_context: z.string().trim().min(10, 'Context must be at least 10 characters').max(1000),
  count: z.number().min(1).max(10),
});

interface GeneratedPreview {
  question_text: string;
  evaluation_guidelines: string;
  accepted: boolean;
}

// ─── Formatted Question Content Component ───
function FormattedQuestionContent({ text, guidelines, type }: {
  text: string;
  guidelines?: string;
  type: string;
}) {
  const { display, parsed: jsonParsed } = parseQuestionText(text, type);
  const parsed = jsonParsed || tryParseAiText(text, type);

  if (type === 'mcq' && parsed) {
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
                idx === parsed.correctIndex ? 'border-success/40 bg-success/5' : 'border-border'
              }`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  idx === parsed.correctIndex ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
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

  if (type === 'coding' && parsed) {
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

  // Scenario or fallback
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
            {guidelines.split('\n').map((line, i) => {
              const trimmed = line.trim();
              if (!trimmed) return <br key={i} />;
              // Detect bullet points
              if (/^[-•]\s/.test(trimmed)) {
                return <p key={i} className="text-sm text-foreground pl-3 flex gap-1.5 items-start"><span className="text-muted-foreground mt-0.5">•</span><span>{trimmed.replace(/^[-•]\s*/, '')}</span></p>;
              }
              // Detect numbered items
              if (/^\d+[.)]\s/.test(trimmed)) {
                const num = trimmed.match(/^(\d+)[.)]\s*/)?.[1];
                return <p key={i} className="text-sm text-foreground pl-3 flex gap-1.5 items-start"><span className="text-muted-foreground font-medium mt-0.5">{num}.</span><span>{trimmed.replace(/^\d+[.)]\s*/, '')}</span></p>;
              }
              return <p key={i} className="text-sm text-foreground">{trimmed}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuestionBankPage() {
  const {
    questions, fetchQuestions,
    toggleQuestionStatus, publishQuestion, bulkPublish, deleteQuestion, addQuestions,
  } = useQuestionStore();
  const { levels: clSettings, fetchLevels } = useCompetencyLevelStore();
  const { skills, topics, fetchSkills, fetchTopicsForSkill } = useSkillStore();
  const { currentRole, user } = useAuth();
  const canEdit = currentRole === 'admin' || currentRole === 'manager';

  useEffect(() => { fetchQuestions(); fetchSkills(); fetchLevels(); }, [fetchQuestions, fetchSkills, fetchLevels]);

  // --- List state ---
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ai' | 'manual'>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [formOpen, setFormOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- AI generation state ---
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSkillId, setAiSkillId] = useState('');
  const [aiTopicId, setAiTopicId] = useState('');
  const [aiLevel, setAiLevel] = useState('');
  const [aiQType, setAiQType] = useState('');
  const [aiContext, setAiContext] = useState('This organization primarily builds internal back-office portals and dashboards. Avoid SEO and marketing website scenarios.');
  const [aiCount, setAiCount] = useState(3);
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<GeneratedPreview[]>([]);
  const [previewDetailIndex, setPreviewDetailIndex] = useState<number | null>(null);

  // Load topics when AI skill changes
  useEffect(() => {
    if (aiSkillId) fetchTopicsForSkill(aiSkillId);
  }, [aiSkillId, fetchTopicsForSkill]);

  const activeSkills = skills.filter((s) => s.status === 'active');
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const dynamicLevels = useMemo(() => getActiveLevelIds(clSettings), [clSettings]);
  const dynamicLabels = useMemo(() => getLevelLabelsByIdMap(clSettings), [clSettings]);
  const topicMap = useMemo(() => {
    const m = new Map<string, string>();
    Object.values(topics).flat().forEach((t) => m.set(t.id, t.name));
    return m;
  }, [topics]);

  const filtered = useMemo(() => {
    const result = questions.filter((q) => {
      const { display } = parseQuestionText(q.question_text, q.question_type);
      const matchesSearch = display.toLowerCase().includes(search.toLowerCase());
      const matchesSkill = skillFilter === 'all' || q.skill_id === skillFilter;
      const matchesLevel = levelFilter === 'all' || q.competency_level === levelFilter;
      const matchesType = typeFilter === 'all' || q.question_type === typeFilter;
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || (sourceFilter === 'ai' ? q.ai_generated : !q.ai_generated);
      return matchesSearch && matchesSkill && matchesLevel && matchesType && matchesStatus && matchesSource;
    });
    result.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortOrder === 'recent' ? db - da : da - db;
    });
    return result;
  }, [questions, search, skillFilter, levelFilter, typeFilter, statusFilter, sourceFilter, sortOrder]);

  const stats = useMemo(() => ({
    total: questions.length,
    published: questions.filter((q) => q.status === 'published').length,
    draft: questions.filter((q) => q.status === 'draft').length,
    aiGenerated: questions.filter((q) => q.ai_generated).length,
  }), [questions]);

  // --- Coverage indicator (respects filters) ---
  const coverageData = useMemo(() => {
    const minRequired = clSettings.length > 0 ? Math.min(...clSettings.map((s) => s.min_questions)) : 3;
    const skillCoverage: Record<string, Record<string, number>> = {};
    for (const q of questions) {
      if (q.status === 'disabled') continue;
      if (!skillCoverage[q.skill_id]) skillCoverage[q.skill_id] = {};
      skillCoverage[q.skill_id][q.competency_level] = (skillCoverage[q.skill_id][q.competency_level] || 0) + 1;
    }
    const filteredSkills = skillFilter === 'all' ? activeSkills : activeSkills.filter((s) => s.id === skillFilter);
    const filteredLevels = levelFilter === 'all' ? dynamicLevels : dynamicLevels.filter((l) => l === levelFilter);
    const result: { skillId: string; skillName: string; levels: { level: string; count: number; min: number }[]; hasGaps: boolean }[] = [];
    for (const skill of filteredSkills) {
      const counts = skillCoverage[skill.id] || {};
      const levels = filteredLevels.map((l) => {
        const setting = clSettings.find((s) => s.id === l);
        const min = setting?.min_questions ?? minRequired;
        return { level: l, count: counts[l] || 0, min };
      });
      const hasGaps = levels.some((lv) => lv.count < lv.min);
      if (hasGaps) result.push({ skillId: skill.id, skillName: skill.skill_name, levels, hasGaps });
    }
    return result;
  }, [questions, activeSkills, clSettings, skillFilter, levelFilter, dynamicLevels]);

  // --- AI Generation handlers ---
  const handleGenerate = async () => {
    const result = genSchema.safeParse({
      skill_id: aiSkillId, competency_level: aiLevel, question_type: aiQType,
      organization_context: aiContext, count: aiCount,
    });
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
      setAiErrors(fe);
      return;
    }
    setAiErrors({});
    setGenerating(true);
    setPreviews([]);
    setPreviewDetailIndex(null);

    const skill = skills.find((s) => s.id === aiSkillId);
    const topic = aiTopicId ? topicMap.get(aiTopicId) : undefined;
    // Get level NAME for AI prompt (AI needs human-readable name, not UUID)
    const aiLevelName = getLevelNameById(clSettings, aiLevel) || aiLevel;

    try {
      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: {
          skillName: skill?.skill_name ?? 'Unknown',
          topicName: topic || undefined,
          competencyLevel: aiLevelName,
          questionType: aiQType,
          organizationContext: aiContext,
          count: aiCount,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); setGenerating(false); return; }
      const qs: { question_text: string; evaluation_guidelines: string }[] = data?.questions ?? [];
      if (qs.length === 0) { toast.warning('No questions generated. Try again.'); setGenerating(false); return; }
      setPreviews(qs.map((g) => ({ ...g, accepted: true })));
    } catch (err: any) {
      console.error('AI generation failed:', err);
      toast.error(err?.message || 'Failed to generate questions.');
    } finally {
      setGenerating(false);
    }
  };

  const togglePreview = (i: number) => setPreviews((prev) => prev.map((p, idx) => idx === i ? { ...p, accepted: !p.accepted } : p));

  const handleSaveAccepted = () => {
    const accepted = previews.filter((p) => p.accepted);
    if (accepted.length === 0) return;
    addQuestions(accepted.map((p) => ({
      tenant_id: user?.tenant_id ?? 'tenant-001',
      skill_id: aiSkillId,
      topic_id: aiTopicId || null,
      competency_level: aiLevel as CompetencyLevel,
      question_type: aiQType as QuestionType,
      question_text: p.question_text,
      evaluation_guidelines: p.evaluation_guidelines,
      status: 'draft' as const,
      ai_generated: true,
    })));
    toast.success(`${accepted.length} question(s) saved as draft.`);
    setPreviews([]);
  };

  const acceptedCount = previews.filter((p) => p.accepted).length;

  const handleDuplicate = (q: Question) => {
    setEditQuestion(null);
    const dup = { ...q, id: '', status: 'draft' as QuestionStatus, ai_generated: false };
    setEditQuestion(dup);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Question Bank</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create, manage, and generate assessment questions linked to skills and competency levels.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditQuestion(null); setFormOpen(true); }} className="gap-1.5">
            <Plus size={14} /> Add Question
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Questions', value: stats.total, icon: <HelpCircle size={18} /> },
          { label: 'Published', value: stats.published, color: 'text-success' },
          { label: 'Draft', value: stats.draft, color: 'text-warning' },
          { label: 'AI Generated', value: stats.aiGenerated, icon: <Sparkles size={18} /> },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${(s as any).color ?? 'text-card-foreground'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* AI Generation Section */}
      {canEdit && (
        <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
          <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 p-4 hover:bg-primary/10 transition-colors text-left">
                <Sparkles size={18} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Generate Questions with AI</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Auto-generate high-quality questions tailored to skills, topics, and competency levels.</p>
                </div>
                {aiOpen ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-primary/10 p-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Skill <span className="text-destructive">*</span></Label>
                    <Select value={aiSkillId} onValueChange={(v) => { setAiSkillId(v); setAiTopicId(''); }}>
                      <SelectTrigger><SelectValue placeholder="Select skill" /></SelectTrigger>
                      <SelectContent>
                        {activeSkills.map((s) => <SelectItem key={s.id} value={s.id}>{s.skill_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {aiErrors.skill_id && <p className="text-xs text-destructive">{aiErrors.skill_id}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Topic <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Select value={aiTopicId} onValueChange={setAiTopicId} disabled={!aiSkillId}>
                      <SelectTrigger><SelectValue placeholder="Any topic" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Any topic</SelectItem>
                        {(topics[aiSkillId] || []).filter((t) => t.status === 'active').map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Competency Level <span className="text-destructive">*</span></Label>
                    <Select value={aiLevel} onValueChange={setAiLevel}>
                      <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                      <SelectContent>
                        {dynamicLevels.map((l) => <SelectItem key={l} value={l}>{dynamicLabels[l] || l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {aiErrors.competency_level && <p className="text-xs text-destructive">{aiErrors.competency_level}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Question Type <span className="text-destructive">*</span></Label>
                    <Select value={aiQType} onValueChange={setAiQType}>
                      <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        {questionTypes.map((t) => <SelectItem key={t} value={t}>{questionTypeLabels[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {aiErrors.question_type && <p className="text-xs text-destructive">{aiErrors.question_type}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Count</Label>
                    <Select value={String(aiCount)} onValueChange={(v) => setAiCount(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 5, 10].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Organization Context <span className="text-destructive">*</span></Label>
                  <Textarea value={aiContext} onChange={(e) => setAiContext(e.target.value)} maxLength={1000} rows={2} placeholder="Describe the context..." />
                  <div className="flex justify-between">
                    {aiErrors.organization_context && <p className="text-xs text-destructive">{aiErrors.organization_context}</p>}
                    <p className="text-xs text-muted-foreground ml-auto">{aiContext.length}/1000</p>
                  </div>
                </div>
                <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {generating ? 'Generating...' : 'Generate Questions'}
                </Button>

                {/* Preview — title-only with expandable details */}
                {previews.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-primary/10">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Review ({acceptedCount}/{previews.length} accepted)</h4>
                      <Button size="sm" onClick={handleSaveAccepted} disabled={acceptedCount === 0} className="gap-1.5">
                        <CheckCircle size={14} /> Save {acceptedCount} as Draft
                      </Button>
                    </div>
                    {previews.map((p, i) => {
                      const { display } = parseQuestionText(p.question_text, aiQType);
                      return (
                        <div key={i} className={`rounded-lg border bg-card overflow-hidden transition-all ${p.accepted ? 'border-success/30' : 'border-border opacity-50'}`}>
                          <div className="flex items-center gap-3 p-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); togglePreview(i); }}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                p.accepted ? 'bg-success border-success text-success-foreground' : 'border-border hover:border-foreground'
                              }`}
                            >
                              {p.accepted && <CheckCircle size={12} />}
                            </button>
                            <button
                              className="flex-1 min-w-0 text-left flex items-center gap-2 hover:underline"
                              onClick={() => setPreviewDetailIndex(i)}
                            >
                              <Badge variant="secondary" className="text-[10px] shrink-0">{questionTypeLabels[aiQType as QuestionType] || aiQType}</Badge>
                              <span className="text-sm text-foreground truncate">{display}</span>
                              <Eye size={14} className="text-muted-foreground shrink-0 ml-auto" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" maxLength={100} />
        </div>
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Skill" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Skills</SelectItem>
            {activeSkills.map((s) => <SelectItem key={s.id} value={s.id}>{s.skill_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {dynamicLevels.map((l) => <SelectItem key={l} value={l}>{dynamicLabels[l] || l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {questionTypes.map((t) => <SelectItem key={t} value={t}>{questionTypeLabels[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as 'all' | 'ai' | 'manual')}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="ai">
              <span className="flex items-center gap-1.5"><Bot size={12} /> AI Generated</span>
            </SelectItem>
            <SelectItem value="manual">
              <span className="flex items-center gap-1.5"><User size={12} /> Manual</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'recent' | 'oldest')}>
          <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Coverage Gaps (below filters, respects active filters) */}
      {canEdit && coverageData.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Question Coverage Gaps</h3>
            <Badge variant="outline" className="text-xs border-warning/30 text-warning">{coverageData.length} skill(s)</Badge>
          </div>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {coverageData.map((skill) => (
              <div key={skill.skillId} className="flex items-center gap-3 text-xs">
                <span className="font-medium text-foreground w-36 truncate" title={skill.skillName}>{skill.skillName}</span>
                <div className="flex gap-1.5 flex-1 flex-wrap">
                  {skill.levels.map((lv) => (
                    <div
                      key={lv.level}
                      className={`flex items-center gap-1 rounded px-2 py-0.5 border ${
                        lv.count >= lv.min
                          ? 'border-success/20 bg-success/5 text-success'
                          : 'border-destructive/20 bg-destructive/5 text-destructive'
                      }`}
                    >
                      <span className="font-medium">{dynamicLabels[lv.level] || lv.level}</span>
                      <span>{lv.count}/{lv.min}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Bulk actions */}
      {canEdit && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="default"
            onClick={async () => {
              const draftIds = Array.from(selectedIds).filter(id => {
                const q = questions.find(qq => qq.id === id);
                return q && q.status === 'draft';
              });
              if (draftIds.length === 0) {
                toast.error('No draft questions selected to publish.');
                return;
              }
              const count = await bulkPublish(draftIds);
              toast.success(`Published ${count} question(s).`);
              setSelectedIds(new Set());
            }}
          >
            <CheckCircle size={14} className="mr-1.5" /> Publish Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {canEdit && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every(q => selectedIds.has(q.id))
                      ? true
                      : filtered.some(q => selectedIds.has(q.id))
                        ? 'indeterminate'
                        : false}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set(filtered.map(q => q.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </TableHead>
              )}
              <TableHead className="w-[200px]">Skill</TableHead>
              <TableHead className="w-[120px]">Topic</TableHead>
              <TableHead className="w-[110px]">Level</TableHead>
              <TableHead className="w-[80px]">Type</TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="w-[80px]">Source</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              {canEdit && <TableHead className="w-[60px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 10 : 7} className="text-center py-16 text-sm text-muted-foreground">
                  No questions found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((q) => {
                const skill = skillMap.get(q.skill_id);
                const { display } = parseQuestionText(q.question_text, q.question_type);
                return (
                  <TableRow key={q.id} className={q.status === 'disabled' ? 'opacity-50' : ''}>
                    {canEdit && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(q.id)}
                          onCheckedChange={(checked) => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (checked) next.add(q.id); else next.delete(q.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-sm font-medium">{skill?.skill_name ?? 'Unknown'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.topic_id ? (topicMap.get(q.topic_id) || '—') : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">{dynamicLabels[q.competency_level] || q.competency_level}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {questionTypeLabels[q.question_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        className="text-sm text-foreground line-clamp-1 text-left hover:underline cursor-pointer"
                        onClick={() => setDetailQuestion(q)}
                      >
                        {display}
                      </button>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(q.updated_at || q.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </TableCell>
                    <TableCell>
                      {q.ai_generated ? (
                        <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary"><Sparkles size={10} /> AI</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 border-border text-muted-foreground"><User size={10} /> Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs border ${statusStyles[q.status]}`}>{q.status}</Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailQuestion(q)}>
                              <Eye size={14} className="mr-2" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditQuestion(q); setFormOpen(true); }}>
                              <Pencil size={14} className="mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(q)}>
                              <Copy size={14} className="mr-2" /> Duplicate
                            </DropdownMenuItem>
                            {q.status === 'draft' && (
                              <DropdownMenuItem onClick={() => publishQuestion(q.id)}>
                                <CheckCircle size={14} className="mr-2" /> Publish
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => toggleQuestionStatus(q.id)}>
                              {q.status === 'disabled' ? <><ToggleLeft size={14} className="mr-2" /> Enable</> : <><ToggleRight size={14} className="mr-2" /> Disable</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(q)}>
                              <Trash2 size={14} className="mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail View Sheet */}
      {detailQuestion && (
        <QuestionDetailSheet
          question={detailQuestion}
          skillName={skillMap.get(detailQuestion.skill_id)?.skill_name ?? 'Unknown'}
          topicName={detailQuestion.topic_id ? (topicMap.get(detailQuestion.topic_id) || null) : null}
          onClose={() => setDetailQuestion(null)}
          levelLabels={dynamicLabels}
        />
      )}

      {/* AI Preview Detail Sheet */}
      {previewDetailIndex !== null && previews[previewDetailIndex] && (() => {
        const pIdx = previewDetailIndex;
        const pItem = previews[pIdx];
        return (
        <Sheet open onOpenChange={(open) => { if (!open) setPreviewDetailIndex(null); }}>
          <SheetContent className="sm:max-w-lg overflow-y-auto flex flex-col">
            <SheetHeader>
              <SheetTitle>AI Generated Question</SheetTitle>
              <SheetDescription>
                {skillMap.get(aiSkillId)?.skill_name ?? 'Unknown'}{aiTopicId && topicMap.get(aiTopicId) ? ` → ${topicMap.get(aiTopicId)}` : ''} · {dynamicLabels[aiLevel] || aiLevel} · {questionTypeLabels[aiQType as QuestionType] || aiQType}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 mt-4 flex-1">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary"><Sparkles size={10} /> AI Generated</Badge>
                <Badge variant="secondary" className="text-xs">{questionTypeLabels[aiQType as QuestionType] || aiQType}</Badge>
                <Badge variant="outline" className="text-xs">{dynamicLabels[aiLevel] || aiLevel}</Badge>
                {pItem.accepted ? (
                  <Badge className="text-xs border border-success/20 bg-success/15 text-success">Accepted</Badge>
                ) : (
                  <Badge className="text-xs border border-destructive/20 bg-destructive/15 text-destructive">Rejected</Badge>
                )}
              </div>

              {/* Editable question text */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Question Text</Label>
                <Textarea
                  value={(() => {
                    try {
                      const p = JSON.parse(pItem.question_text);
                      if (aiQType === 'mcq' && p?.questionText) return p.questionText;
                      if (aiQType === 'coding' && p?.problemStatement) return p.problemStatement;
                    } catch {}
                    return pItem.question_text;
                  })()}
                  onChange={(e) => {
                    setPreviews(prev => prev.map((item, idx) => {
                      if (idx !== pIdx) return item;
                      const val = e.target.value;
                      try {
                        const p = JSON.parse(item.question_text);
                        if (aiQType === 'mcq' && p?.questionText) return { ...item, question_text: JSON.stringify({ ...p, questionText: val }) };
                        if (aiQType === 'coding' && p?.problemStatement) return { ...item, question_text: JSON.stringify({ ...p, problemStatement: val }) };
                      } catch {}
                      return { ...item, question_text: val };
                    }));
                  }}
                  rows={4}
                  className="text-sm"
                />
              </div>

              {/* Editable evaluation guidelines (not for MCQ) */}
              {aiQType !== 'mcq' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evaluation Guidelines</Label>
                  <Textarea
                    value={pItem.evaluation_guidelines}
                    onChange={(e) => {
                      setPreviews(prev => prev.map((item, idx) => idx === pIdx ? { ...item, evaluation_guidelines: e.target.value } : item));
                    }}
                    rows={3}
                    className="text-sm"
                  />
                </div>
              )}

              {/* Read-only formatted preview */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</Label>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <FormattedQuestionContent
                    text={pItem.question_text}
                    guidelines={pItem.evaluation_guidelines}
                    type={aiQType}
                  />
                </div>
              </div>
            </div>

            <SheetFooter className="mt-6 flex-row gap-2 sm:justify-between">
              <Button
                variant={pItem.accepted ? 'destructive' : 'default'}
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  togglePreview(pIdx);
                }}
              >
                {pItem.accepted ? (
                  <><Trash2 size={14} /> Reject</>
                ) : (
                  <><CheckCircle size={14} /> Accept</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreviewDetailIndex(null)}>
                Done
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        );
      })()}

      {/* Form Sheet */}
      <QuestionFormSheet open={formOpen} onOpenChange={setFormOpen} editQuestion={editQuestion} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this question. Only unused questions (not linked to any assessment) can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                setDeleteLoading(true);
                const result = await deleteQuestion(deleteTarget.id);
                setDeleteLoading(false);
                if (result.success) {
                  toast.success('Question deleted successfully.');
                  setDeleteTarget(null);
                } else {
                  toast.error(result.error || 'Failed to delete question.');
                }
              }}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Question Detail Sheet ───
function QuestionDetailSheet({
  question, skillName, topicName, onClose, levelLabels,
}: { question: Question; skillName: string; topicName: string | null; onClose: () => void; levelLabels: Record<string, string> }) {
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Question Details</SheetTitle>
          <SheetDescription>
            {skillName}{topicName ? ` → ${topicName}` : ''} · {levelLabels[question.competency_level] || question.competency_level} · {questionTypeLabels[question.question_type]}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={`text-xs border ${statusStyles[question.status]}`}>{question.status}</Badge>
            {question.ai_generated ? (
              <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary"><Sparkles size={10} /> AI Generated</Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1 border-border text-muted-foreground"><User size={10} /> Manual</Badge>
            )}
            <Badge variant="secondary" className="text-xs">{questionTypeLabels[question.question_type]}</Badge>
          </div>

          {/* Created date */}
          <p className="text-xs text-muted-foreground">
            Created {new Date(question.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>

          {/* Formatted content using shared component */}
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
