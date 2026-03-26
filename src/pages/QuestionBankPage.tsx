import { useState, useMemo, useEffect } from 'react';
import { z } from 'zod';
import {
  useQuestionStore, Question, QuestionStatus, competencyLevels, questionTypes,
  competencyLabels, questionTypeLabels, CompetencyLevel, QuestionType,
} from '@/stores/questionStore';
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
  Plus, Search, Pencil, ToggleLeft, ToggleRight, CheckCircle, HelpCircle,
  Sparkles, Trash2, MoreHorizontal, Loader2, ChevronDown, ChevronRight,
  AlertTriangle, Copy, Eye,
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function QuestionBankPage() {
  const {
    questions, settings, fetchQuestions, fetchSettings,
    toggleQuestionStatus, publishQuestion, deleteQuestion, addQuestions,
  } = useQuestionStore();
  const { skills, topics, fetchSkills, fetchTopicsForSkill } = useSkillStore();
  const { currentRole, user } = useAuth();
  const canEdit = currentRole === 'admin' || currentRole === 'manager';

  useEffect(() => { fetchQuestions(); fetchSkills(); fetchSettings(); }, [fetchQuestions, fetchSkills, fetchSettings]);

  // --- List state ---
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null);

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

  // Load topics when AI skill changes
  useEffect(() => {
    if (aiSkillId) fetchTopicsForSkill(aiSkillId);
  }, [aiSkillId, fetchTopicsForSkill]);

  const activeSkills = skills.filter((s) => s.status === 'active');
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const topicMap = useMemo(() => {
    const m = new Map<string, string>();
    Object.values(topics).flat().forEach((t) => m.set(t.id, t.name));
    return m;
  }, [topics]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      const { display } = parseQuestionText(q.question_text, q.question_type);
      const matchesSearch = display.toLowerCase().includes(search.toLowerCase());
      const matchesSkill = skillFilter === 'all' || q.skill_id === skillFilter;
      const matchesLevel = levelFilter === 'all' || q.competency_level === levelFilter;
      const matchesType = typeFilter === 'all' || q.question_type === typeFilter;
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
      return matchesSearch && matchesSkill && matchesLevel && matchesType && matchesStatus;
    });
  }, [questions, search, skillFilter, levelFilter, typeFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: questions.length,
    published: questions.filter((q) => q.status === 'published').length,
    draft: questions.filter((q) => q.status === 'draft').length,
    aiGenerated: questions.filter((q) => q.ai_generated).length,
  }), [questions]);

  // --- Coverage indicator ---
  const coverageData = useMemo(() => {
    const minRequired = settings.length > 0 ? Math.min(...settings.map((s) => s.min_questions)) : 3;
    const skillCoverage: Record<string, Record<string, number>> = {};
    for (const q of questions) {
      if (q.status === 'disabled') continue;
      if (!skillCoverage[q.skill_id]) skillCoverage[q.skill_id] = {};
      skillCoverage[q.skill_id][q.competency_level] = (skillCoverage[q.skill_id][q.competency_level] || 0) + 1;
    }
    const result: { skillId: string; skillName: string; levels: { level: CompetencyLevel; count: number; min: number }[]; hasGaps: boolean }[] = [];
    for (const skill of activeSkills) {
      const counts = skillCoverage[skill.id] || {};
      const levels = competencyLevels.map((l) => {
        const setting = settings.find((s) => s.name.toLowerCase() === l);
        const min = setting?.min_questions ?? minRequired;
        return { level: l, count: counts[l] || 0, min };
      });
      const hasGaps = levels.some((lv) => lv.count < lv.min);
      result.push({ skillId: skill.id, skillName: skill.skill_name, levels, hasGaps });
    }
    return result.filter((r) => r.hasGaps);
  }, [questions, activeSkills, settings]);

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

    const skill = skills.find((s) => s.id === aiSkillId);
    const topic = aiTopicId ? topicMap.get(aiTopicId) : undefined;

    try {
      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: {
          skillName: skill?.skill_name ?? 'Unknown',
          topicName: topic || undefined,
          competencyLevel: aiLevel,
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
    // Pre-fill a new form with the same data
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
                        {competencyLevels.map((l) => <SelectItem key={l} value={l}>{competencyLabels[l]}</SelectItem>)}
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

                {/* Preview */}
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
                        <div key={i} className={`rounded-lg border bg-card p-3 flex items-start gap-3 transition-all ${p.accepted ? 'border-success/30' : 'border-border opacity-50'}`}>
                          <button
                            onClick={() => togglePreview(i)}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                              p.accepted ? 'bg-success border-success text-success-foreground' : 'border-border hover:border-foreground'
                            }`}
                          >
                            {p.accepted && <CheckCircle size={12} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground line-clamp-3">{display}</p>
                            {p.evaluation_guidelines && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.evaluation_guidelines}</p>
                            )}
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

      {/* Coverage Indicator */}
      {canEdit && coverageData.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Question Coverage Gaps</h3>
            <Badge variant="outline" className="text-xs border-warning/30 text-warning">{coverageData.length} skill(s)</Badge>
          </div>
          <div className="space-y-2">
            {coverageData.slice(0, 5).map((skill) => (
              <div key={skill.skillId} className="flex items-center gap-3 text-xs">
                <span className="font-medium text-foreground w-36 truncate">{skill.skillName}</span>
                <div className="flex gap-1.5 flex-1">
                  {skill.levels.map((lv) => (
                    <div
                      key={lv.level}
                      className={`flex items-center gap-1 rounded px-2 py-0.5 border ${
                        lv.count >= lv.min
                          ? 'border-success/20 bg-success/5 text-success'
                          : 'border-destructive/20 bg-destructive/5 text-destructive'
                      }`}
                    >
                      <span className="font-medium">{competencyLabels[lv.level]}</span>
                      <span>{lv.count}/{lv.min}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {coverageData.length > 5 && (
              <p className="text-xs text-muted-foreground">...and {coverageData.length - 5} more skill(s) with gaps.</p>
            )}
          </div>
        </div>
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
            {competencyLevels.map((l) => <SelectItem key={l} value={l}>{competencyLabels[l]}</SelectItem>)}
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
      </div>

      {/* Question Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Skill</TableHead>
              <TableHead className="w-[120px]">Topic</TableHead>
              <TableHead className="w-[110px]">Level</TableHead>
              <TableHead className="w-[80px]">Type</TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              {canEdit && <TableHead className="w-[60px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} className="text-center py-16 text-sm text-muted-foreground">
                  No questions found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((q) => {
                const skill = skillMap.get(q.skill_id);
                const { display } = parseQuestionText(q.question_text, q.question_type);
                return (
                  <TableRow key={q.id} className={q.status === 'disabled' ? 'opacity-50' : ''}>
                    <TableCell className="text-sm font-medium">{skill?.skill_name ?? 'Unknown'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.topic_id ? (topicMap.get(q.topic_id) || '—') : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">{competencyLabels[q.competency_level]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs font-normal gap-1">
                        {questionTypeLabels[q.question_type]}
                        {q.ai_generated && <Sparkles size={10} className="text-primary" />}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        className="text-sm text-foreground line-clamp-1 text-left hover:underline cursor-pointer"
                        onClick={() => setDetailQuestion(q)}
                      >
                        {display}
                      </button>
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
        />
      )}

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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';

function QuestionDetailSheet({
  question, skillName, topicName, onClose,
}: { question: Question; skillName: string; topicName: string | null; onClose: () => void }) {
  const { display, parsed } = parseQuestionText(question.question_text, question.question_type);

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Question Details</SheetTitle>
          <SheetDescription>
            {skillName}{topicName ? ` → ${topicName}` : ''} · {competencyLabels[question.competency_level]} · {questionTypeLabels[question.question_type]}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Badge className={`text-xs border ${statusStyles[question.status]}`}>{question.status}</Badge>
            {question.ai_generated && (
              <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary"><Sparkles size={10} /> AI Generated</Badge>
            )}
          </div>

          {question.question_type === 'scenario' && (
            <>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Question</h4>
                <p className="text-sm text-foreground whitespace-pre-wrap">{display}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Evaluation Guidelines</h4>
                <p className="text-sm text-foreground whitespace-pre-wrap">{question.evaluation_guidelines}</p>
              </div>
            </>
          )}

          {question.question_type === 'mcq' && parsed && (
            <>
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
            </>
          )}

          {question.question_type === 'coding' && parsed && (
            <>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Problem Statement</h4>
                <p className="text-sm text-foreground whitespace-pre-wrap">{parsed.problemStatement}</p>
              </div>
              {parsed.exampleInput && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Example Input</h4>
                    <pre className="text-xs bg-muted rounded-lg p-2 font-mono whitespace-pre-wrap">{parsed.exampleInput}</pre>
                  </div>
                  {parsed.exampleOutput && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Example Output</h4>
                      <pre className="text-xs bg-muted rounded-lg p-2 font-mono whitespace-pre-wrap">{parsed.exampleOutput}</pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Fallback for unparsed */}
          {(question.question_type === 'mcq' || question.question_type === 'coding') && !parsed && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Question</h4>
              <p className="text-sm text-foreground whitespace-pre-wrap">{question.question_text}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
