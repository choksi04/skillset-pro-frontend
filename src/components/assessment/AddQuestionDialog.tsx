import { useState, useMemo } from 'react';
import { useQuestionStore, Question } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { AssessmentQuestion } from '@/stores/assessmentStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';

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
  const { questions } = useQuestionStore();
  const { skills } = useSkillStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const skillMap = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills]);

  const availableQuestions = useMemo(() => {
    const excludeSet = new Set(existingQuestionIds);
    return questions.filter(q =>
      q.status === 'published' &&
      skillIds.includes(q.skill_id) &&
      !excludeSet.has(q.id)
    );
  }, [questions, skillIds, existingQuestionIds]);

  const filteredQuestions = useMemo(() => {
    if (!search.trim()) return availableQuestions;
    const term = search.toLowerCase();
    return availableQuestions.filter(q =>
      q.question_text.toLowerCase().includes(term) ||
      (skillMap.get(q.skill_id)?.skill_name || '').toLowerCase().includes(term) ||
      q.competency_level.toLowerCase().includes(term) ||
      q.question_type.toLowerCase().includes(term)
    );
  }, [availableQuestions, search, skillMap]);

  const toggleQuestion = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const toAdd: AssessmentQuestion[] = [];
    for (const qId of selected) {
      const q = availableQuestions.find(q => q.id === qId);
      if (q) toAdd.push({ question_id: q.id, skill_id: q.skill_id, target_level: q.competency_level });
    }
    onAdd(toAdd);
    setSelected(new Set());
    setSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelected(new Set()); setSearch(''); } onOpenChange(v); }}>
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
          {filteredQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No available questions found.</p>
          ) : (
            filteredQuestions.map(q => (
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
                  <p className="text-sm text-foreground line-clamp-2">{q.question_text}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[10px]">{skillMap.get(q.skill_id)?.skill_name || q.skill_id}</Badge>
                    <Badge variant="outline" className="text-[10px]">{q.competency_level}</Badge>
                    <Badge variant="outline" className="text-[10px]">{q.question_type}</Badge>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

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
