import { useCallback, useState, useMemo, useEffect } from 'react';
import { Question, useQuestionStore } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useCompetencyLevelStore, getLevelLabelsByIdMap } from '@/stores/competencyLevelStore';
import { AssessmentQuestion } from '@/stores/assessmentStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Search, Plus } from 'lucide-react';
import { getQuestionPreviewText } from '@/lib/questionContent';

interface AddQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillIds: string[];
  existingQuestionIds: string[];
  onAdd: (questions: AssessmentQuestion[]) => void;
}

export default function AddQuestionDialog({
  open, onOpenChange, skillIds, existingQuestionIds, onAdd,
}: AddQuestionDialogProps) {
  const { fetchQuestionPage } = useQuestionStore();
  const { skills } = useSkillStore();
  const { levels: competencyLevels } = useCompetencyLevelStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Map<string, Question>>(new Map());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageQuestions, setPageQuestions] = useState<Question[]>([]);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 20;
  const skillKey = useMemo(() => skillIds.join('|'), [skillIds]);
  const existingKey = useMemo(() => existingQuestionIds.join('|'), [existingQuestionIds]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSelectedRows(new Map());
    setSearch('');
    setPage(1);
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, skillKey, existingKey]);


  const skillMap = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills]);
  const levelLabels = useMemo(() => getLevelLabelsByIdMap(competencyLevels), [competencyLevels]);

  const loadPage = useCallback(async () => {
    if (!open) return;
    const scopedSkillIds = skillKey ? skillKey.split('|').filter(Boolean) : [];
    const excludedIds = existingKey ? existingKey.split('|').filter(Boolean) : [];
    if (scopedSkillIds.length === 0) {
      setPageQuestions([]);
      setQuestionTotal(0);
      return;
    }
    setLoading(true);
    const result = await fetchQuestionPage({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      skillIds: scopedSkillIds,
      status: 'published',
      excludeIds: excludedIds,
      sortOrder: 'recent',
    });
    setPageQuestions(result.questions);
    setQuestionTotal(result.total);
    setLoading(false);
  }, [open, fetchQuestionPage, page, debouncedSearch, skillKey, existingKey]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const totalPages = Math.max(1, Math.ceil(questionTotal / PAGE_SIZE));

  const toggleQuestion = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      const row = pageQuestions.find((q) => q.id === id);
      if (row) {
        setSelectedRows((prevRows) => {
          const rows = new Map(prevRows);
          if (next.has(id)) rows.set(id, row);
          else rows.delete(id);
          return rows;
        });
      }
      return next;
    });
  };

  const handleAdd = () => {
    const toAdd: AssessmentQuestion[] = [];
    for (const qId of selected) {
      const q = selectedRows.get(qId) || pageQuestions.find(q => q.id === qId);
      if (q) toAdd.push({ question_id: q.id, skill_id: q.skill_id, target_level: q.competency_level });
    }
    onAdd(toAdd);
    setSelected(new Set());
    setSelectedRows(new Map());
    setSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelected(new Set()); setSelectedRows(new Map()); setSearch(''); } onOpenChange(v); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Questions to Assessment</DialogTitle>
          <DialogDescription>Select published questions to add. Filtered by assessment skills.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by text, skill, level, or type..."
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading questions…</p>
          ) : pageQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No available questions found.</p>
          ) : (
            pageQuestions.map(q => (
              <label
                key={q.id}
                className="flex items-start gap-2 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer border border-transparent has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5"
              >
                <Checkbox
                  checked={selected.has(q.id)}
                  onCheckedChange={() => toggleQuestion(q.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground line-clamp-2">
                    {getQuestionPreviewText(q.question_text, q.question_type)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[10px]">{skillMap.get(q.skill_id)?.skill_name || q.skill_id}</Badge>
                    <Badge variant="outline" className="text-[10px]">{levelLabels[q.competency_level] || q.competency_level}</Badge>
                    <Badge variant="outline" className="text-[10px]">{q.question_type}</Badge>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        {questionTotal > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, questionTotal)} of {questionTotal}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={13} />
              </Button>
              <span className="tabular-nums">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={selected.size === 0} className="gap-1.5">
            <Plus size={14} /> Add {selected.size > 0 ? `${selected.size} Question${selected.size > 1 ? 's' : ''}` : 'Questions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
