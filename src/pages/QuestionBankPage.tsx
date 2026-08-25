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
import QuestionDetailSheet, { FormattedQuestionContent } from '@/components/questions/QuestionDetailSheet';
import BulkUploadSheet from '@/components/questions/BulkUploadSheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import SearchableSelect from '@/components/ui/searchable-select';



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
  AlertTriangle, Copy, Eye, Bot, User, CheckSquare, ChevronLeft, FileSpreadsheet,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
  additional_context: z.string().trim().max(1000).optional().or(z.literal('')),
  count: z.number().min(1).max(10),
});


interface GeneratedPreview {
  question_text: string;
  evaluation_guidelines: string;
  accepted: boolean;
}

// FormattedQuestionContent moved to @/components/questions/QuestionDetailSheet

export default function QuestionBankPage() {
  const {
    questions, counts, fetchQuestionPage, fetchQuestionCounts,
    toggleQuestionStatus, publishQuestion, bulkPublish, deleteQuestion, addQuestions,
  } = useQuestionStore();
  const { levels: clSettings, fetchLevels } = useCompetencyLevelStore();
  const { skills, topics, fetchSkills, fetchTopicsForSkill } = useSkillStore();
  const { currentRole, user } = useAuth();
  const canEdit = currentRole === 'admin' || currentRole === 'manager';

  useEffect(() => { fetchQuestionCounts(); fetchSkills(); fetchLevels(); }, [fetchQuestionCounts, fetchSkills, fetchLevels]);

  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  // --- List state ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ai' | 'manual'>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [pageQuestions, setPageQuestions] = useState<Question[]>([]);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [questionPageLoading, setQuestionPageLoading] = useState(false);

  // --- AI generation state ---
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSkillId, setAiSkillId] = useState('');
  const [aiTopicId, setAiTopicId] = useState('');
  const [aiLevel, setAiLevel] = useState('');
  const [aiQType, setAiQType] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [aiCount, setAiCount] = useState(3);
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<GeneratedPreview[]>([]);
  const [previewDetailIndex, setPreviewDetailIndex] = useState<number | null>(null);

  // Load topics when AI skill changes
  useEffect(() => {
    if (aiSkillId) fetchTopicsForSkill(aiSkillId);
  }, [aiSkillId, fetchTopicsForSkill]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const activeSkills = skills.filter((s) => s.status === 'active');
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const dynamicLevels = useMemo(() => getActiveLevelIds(clSettings), [clSettings]);
  const dynamicLabels = useMemo(() => getLevelLabelsByIdMap(clSettings), [clSettings]);
  const topicMap = useMemo(() => {
    const m = new Map<string, string>();
    Object.values(topics).flat().forEach((t) => m.set(t.id, t.name));
    return m;
  }, [topics]);
  const topicDescMap = useMemo(() => {
    const m = new Map<string, string>();
    Object.values(topics).flat().forEach((t: any) => { if (t.description) m.set(t.id, t.description); });
    return m;
  }, [topics]);


  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, skillFilter, levelFilter, typeFilter, statusFilter, sourceFilter, sortOrder]);

  const loadQuestionPage = useCallback(async () => {
    setQuestionPageLoading(true);
    const result = await fetchQuestionPage({
      page: currentPage,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      skillId: skillFilter,
      levelId: levelFilter,
      questionType: typeFilter as QuestionType | 'all',
      status: statusFilter as QuestionStatus | 'all',
      source: sourceFilter,
      sortOrder,
    });
    setPageQuestions(result.questions);
    setQuestionTotal(result.total);
    setQuestionPageLoading(false);
  }, [fetchQuestionPage, currentPage, debouncedSearch, skillFilter, levelFilter, typeFilter, statusFilter, sourceFilter, sortOrder]);

  useEffect(() => {
    loadQuestionPage();
  }, [loadQuestionPage]);

  const totalPages = Math.max(1, Math.ceil(questionTotal / PAGE_SIZE));
  const paginatedQuestions = pageQuestions;

  // Format large numbers: 10k, 100k etc.
  function formatCount(n: number): string {
    if (n >= 100000) return `${Math.round(n / 1000)}k`;
    if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return n.toLocaleString();
  }

  function rawFormatCount(n: number): string {
    return n.toLocaleString();
  }

  // --- Coverage indicator (respects filters) ---
  const coverageData: { skillId: string; skillName: string; levels: { level: string; count: number; min: number }[]; hasGaps: boolean }[] = [];

  // --- AI Generation handlers ---
  const handleGenerate = async () => {
    const result = genSchema.safeParse({
      skill_id: aiSkillId, competency_level: aiLevel, question_type: aiQType,
      additional_context: aiContext, count: aiCount,
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
    const topicDesc = aiTopicId ? topicDescMap.get(aiTopicId) : undefined;
    // Get level NAME for AI prompt (AI needs human-readable name, not UUID)
    const aiLevelName = getLevelNameById(clSettings, aiLevel) || aiLevel;
    const trimmedContext = aiContext.trim();

    try {
      const callerId = typeof window !== 'undefined' ? localStorage.getItem('siap_user_id') : null;
      const { data, error } = await supabase.functions.invoke('generate-questions', {
        headers: callerId ? { 'x-siap-user-id': callerId } : undefined,
        body: {
          skillName: skill?.skill_name ?? 'Unknown',
          topicName: topic || undefined,
          topicDescription: topicDesc || undefined,
          competencyLevel: aiLevelName,
          questionType: aiQType,
          additionalContext: trimmedContext || undefined,
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

  const handleSaveAccepted = async () => {
    const accepted = previews.filter((p) => p.accepted);
    if (accepted.length === 0) return;
    await addQuestions(accepted.map((p) => ({
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
    loadQuestionPage();
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
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Question Bank</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create, manage, and generate assessment questions linked to skills and competency levels.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-1.5">
              <FileSpreadsheet size={14} /> Upload from Excel
            </Button>
            <Button onClick={() => { setEditQuestion(null); setFormOpen(true); }} className="gap-1.5">
              <Plus size={14} /> Add Question
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <TooltipProvider>
          {[
            { label: 'Total Questions', value: counts.total, icon: <HelpCircle size={18} /> },
            { label: 'Published', value: counts.published, color: 'text-success' },
            { label: 'Draft', value: counts.draft, color: 'text-warning' },
            { label: 'AI Generated', value: counts.aiGenerated, icon: <Sparkles size={18} /> },
          ].map((s) => (
            <Tooltip key={s.label}>
              <TooltipTrigger asChild>
                <div className="rounded-xl border border-border bg-card p-4 cursor-default">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-semibold mt-1 ${(s as any).color ?? 'text-card-foreground'}`}>
                    {s.value >= 10000 ? formatCount(s.value) : s.value}
                  </p>
                </div>
              </TooltipTrigger>
              {s.value >= 10000 && (
                <TooltipContent>
                  <p>{rawFormatCount(s.value)}</p>
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

      {/* AI Generation Section — temporarily disabled (AI credits). Flip `false` to re-enable. */}
      {false && canEdit && (
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
                    <SearchableSelect
                      value={aiSkillId}
                      onValueChange={(v) => { setAiSkillId(v); setAiTopicId(''); }}
                      options={activeSkills.map((s) => ({ value: s.id, label: s.skill_name }))}
                      placeholder="Select skill"
                      className="w-full h-9 text-sm"
                    />
                    {aiErrors.skill_id && <p className="text-xs text-destructive">{aiErrors.skill_id}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Topic <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <SearchableSelect
                      value={aiTopicId}
                      onValueChange={setAiTopicId}
                      options={[{ value: 'none', label: 'Any topic' }, ...((topics[aiSkillId] || []).filter((t) => t.status === 'active').map((t) => ({ value: t.id, label: t.name })))]}
                      placeholder="Any topic"
                      className="w-full h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Competency Level <span className="text-destructive">*</span></Label>
                    <SearchableSelect
                      value={aiLevel}
                      onValueChange={setAiLevel}
                      options={dynamicLevels.map((l) => ({ value: l, label: dynamicLabels[l] || l }))}
                      placeholder="Level"
                      className="w-full h-9 text-sm"
                    />
                    {aiErrors.competency_level && <p className="text-xs text-destructive">{aiErrors.competency_level}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Question Type <span className="text-destructive">*</span></Label>
                    <SearchableSelect
                      value={aiQType}
                      onValueChange={setAiQType}
                      options={questionTypes.map((t) => ({ value: t, label: questionTypeLabels[t] }))}
                      placeholder="Type"
                      className="w-full h-9 text-sm"
                    />
                    {aiErrors.question_type && <p className="text-xs text-destructive">{aiErrors.question_type}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Count</Label>
                    <SearchableSelect
                      value={String(aiCount)}
                      onValueChange={(v) => setAiCount(Number(v))}
                      options={[1, 2, 3, 5, 10].map((n) => ({ value: String(n), label: String(n) }))}
                      placeholder="Count"
                      className="w-full h-9 text-sm"
                    />
                  </div>

                </div>
                <div className="space-y-1.5">
                  <Label>Additional Context <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea value={aiContext} onChange={(e) => setAiContext(e.target.value)} maxLength={1000} rows={2} placeholder="Optional: add any extra guidance for the AI (audience, tech stack, tone, focus areas, etc.)" />
                  <div className="flex justify-between">
                    {aiErrors.additional_context && <p className="text-xs text-destructive">{aiErrors.additional_context}</p>}
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
        <SearchableSelect
          value={skillFilter}
          onValueChange={setSkillFilter}
          options={[{ value: 'all', label: 'All Skills' }, ...activeSkills.map((s) => ({ value: s.id, label: s.skill_name }))]}
          placeholder="Skill"
          className="w-[170px] h-9 text-sm"
        />
        <SearchableSelect
          value={levelFilter}
          onValueChange={setLevelFilter}
          options={[{ value: 'all', label: 'All Levels' }, ...dynamicLevels.map((l) => ({ value: l, label: dynamicLabels[l] || l }))]}
          placeholder="Level"
          className="w-[150px] h-9 text-sm"
        />
        <SearchableSelect
          value={typeFilter}
          onValueChange={setTypeFilter}
          options={[{ value: 'all', label: 'All Types' }, ...questionTypes.map((t) => ({ value: t, label: questionTypeLabels[t] }))]}
          placeholder="Type"
          className="w-[140px] h-9 text-sm"
        />
        <SearchableSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'published', label: 'Published' },
            { value: 'draft', label: 'Draft' },
            { value: 'disabled', label: 'Disabled' },
          ]}
          placeholder="Status"
          className="w-[140px] h-9 text-sm"
        />
        <SearchableSelect
          value={sourceFilter}
          onValueChange={(v) => setSourceFilter(v as 'all' | 'ai' | 'manual')}
          options={[
            { value: 'all', label: 'All Sources' },
            { value: 'ai', label: 'AI Generated' },
            { value: 'manual', label: 'Manual' },
          ]}
          placeholder="Source"
          className="w-[150px] h-9 text-sm"
        />
        <SearchableSelect
          value={sortOrder}
          onValueChange={(v) => setSortOrder(v as 'recent' | 'oldest')}
          options={[
            { value: 'recent', label: 'Recent First' },
            { value: 'oldest', label: 'Oldest First' },
          ]}
          placeholder="Sort"
          className="w-[140px] h-9 text-sm"
        />

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
                const q = pageQuestions.find(qq => qq.id === id) || questions.find(qq => qq.id === id);
                return q && q.status === 'draft';
              });
              if (draftIds.length === 0) {
                toast.error('No draft questions selected to publish.');
                return;
              }
              const count = await bulkPublish(draftIds);
              toast.success(`Published ${count} question(s).`);
              setSelectedIds(new Set());
              loadQuestionPage();
            }}
          >
            <CheckCircle size={14} className="mr-1.5" /> Publish Selected
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 size={14} className="mr-1.5" /> Delete Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {canEdit && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={paginatedQuestions.length > 0 && paginatedQuestions.every(q => selectedIds.has(q.id))
                      ? true
                      : paginatedQuestions.some(q => selectedIds.has(q.id))
                        ? 'indeterminate'
                        : false}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set(paginatedQuestions.map(q => q.id)));
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
            {questionPageLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <TableRow key={`skel-${i}`}>
                  {canEdit && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 rounded-full" /></TableCell>
                  {canEdit && <TableCell><Skeleton className="h-6 w-6" /></TableCell>}
                </TableRow>
              ))
            ) : paginatedQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 10 : 7} className="text-center py-16 text-sm text-muted-foreground">
                  No questions found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedQuestions.map((q) => {
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
                              <DropdownMenuItem onClick={async () => { await publishQuestion(q.id); await loadQuestionPage(); }}>
                                <CheckCircle size={14} className="mr-2" /> Publish
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={async () => { await toggleQuestionStatus(q.id); await loadQuestionPage(); }}>
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

      {/* Pagination — fixed bottom */}
      {questionTotal > 0 && (
        <div className="sticky -bottom-6 border-t border-border bg-background py-3 flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, questionTotal)} of{' '}
            {questionTotal >= 10000 ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default underline decoration-dotted">{formatCount(questionTotal)}</span>
                  </TooltipTrigger>
                  <TooltipContent><p>{rawFormatCount(questionTotal)}</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              questionTotal
            )} questions
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </Button>
              {(() => {
                const pages: (number | 'ellipsis')[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (currentPage > 3) pages.push('ellipsis');
                  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                    pages.push(i);
                  }
                  if (currentPage < totalPages - 2) pages.push('ellipsis');
                  pages.push(totalPages);
                }
                return pages.map((p, idx) =>
                  p === 'ellipsis' ? (
                    <span key={`e-${idx}`} className="px-2 text-muted-foreground text-sm">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={currentPage === p ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </Button>
                  )
                );
              })()}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>
      )}

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
      <QuestionFormSheet open={formOpen} onOpenChange={setFormOpen} editQuestion={editQuestion} onSaved={loadQuestionPage} />

      {/* Bulk Upload */}
      <BulkUploadSheet open={bulkOpen} onOpenChange={setBulkOpen} onUploaded={loadQuestionPage} />

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
                  loadQuestionPage();
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

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open && !bulkDeleteLoading) setBulkDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} question{selectedIds.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected questions. Questions linked to existing assessments will be skipped and reported.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkDeleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                setBulkDeleteLoading(true);
                const ids = Array.from(selectedIds);
                let success = 0;
                const skipped: string[] = [];
                for (const id of ids) {
                  const result = await deleteQuestion(id);
                  if (result.success) success++;
                  else skipped.push(id);
                }
                setBulkDeleteLoading(false);
                setBulkDeleteOpen(false);
                setSelectedIds(new Set());
                loadQuestionPage();
                if (success > 0) toast.success(`Deleted ${success} question(s).`);
                if (skipped.length > 0) toast.error(`${skipped.length} question(s) could not be deleted (in use by assessments).`);
              }}
            >
              {bulkDeleteLoading ? 'Deleting...' : `Delete ${selectedIds.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// QuestionDetailSheet moved to @/components/questions/QuestionDetailSheet
