import { useState } from 'react';
import { z } from 'zod';
import { useQuestionStore, Question, competencyLevels, questionTypes, competencyLabels, questionTypeLabels } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const questionSchema = z.object({
  skill_id: z.string().min(1, 'Skill is required'),
  competency_level: z.string().min(1, 'Competency level is required'),
  question_type: z.string().min(1, 'Question type is required'),
  question_text: z.string().trim().min(10, 'Question must be at least 10 characters').max(2000, 'Max 2000 characters'),
  evaluation_guidelines: z.string().trim().min(5, 'Guidelines must be at least 5 characters').max(1000, 'Max 1000 characters'),
});

interface QuestionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuestion?: Question | null;
}

export default function QuestionFormDialog({ open, onOpenChange, editQuestion }: QuestionFormDialogProps) {
  const { addQuestion, updateQuestion } = useQuestionStore();
  const { skills } = useSkillStore();
  const { user } = useAuth();
  const activeSkills = skills.filter((s) => s.status === 'active');

  const [skillId, setSkillId] = useState(editQuestion?.skill_id ?? '');
  const [level, setLevel] = useState(editQuestion?.competency_level ?? '');
  const [qType, setQType] = useState(editQuestion?.question_type ?? '');
  const [text, setText] = useState(editQuestion?.question_text ?? '');
  const [guidelines, setGuidelines] = useState(editQuestion?.evaluation_guidelines ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setSkillId(editQuestion?.skill_id ?? '');
    setLevel(editQuestion?.competency_level ?? '');
    setQType(editQuestion?.question_type ?? '');
    setText(editQuestion?.question_text ?? '');
    setGuidelines(editQuestion?.evaluation_guidelines ?? '');
    setErrors({});
  };

  const handleSubmit = () => {
    const result = questionSchema.safeParse({
      skill_id: skillId,
      competency_level: level,
      question_type: qType,
      question_text: text,
      evaluation_guidelines: guidelines,
    });
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
      setErrors(fe);
      return;
    }
    if (editQuestion) {
      updateQuestion(editQuestion.id, {
        skill_id: result.data.skill_id,
        competency_level: result.data.competency_level as any,
        question_type: result.data.question_type as any,
        question_text: result.data.question_text,
        evaluation_guidelines: result.data.evaluation_guidelines,
      });
    } else {
      addQuestion({
        tenant_id: user?.tenant_id ?? 'tenant-001',
        skill_id: result.data.skill_id,
        competency_level: result.data.competency_level as any,
        question_type: result.data.question_type as any,
        question_text: result.data.question_text,
        evaluation_guidelines: result.data.evaluation_guidelines,
        status: 'draft',
        ai_generated: false,
      });
    }
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editQuestion ? 'Edit Question' : 'Create New Question'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Skill */}
          <div className="space-y-1.5">
            <Label>Skill</Label>
            <Select value={skillId} onValueChange={setSkillId}>
              <SelectTrigger><SelectValue placeholder="Select skill" /></SelectTrigger>
              <SelectContent>
                {activeSkills.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.skill_name} — {s.skill_category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.skill_id && <p className="text-xs text-destructive">{errors.skill_id}</p>}
          </div>

          {/* Level + Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Competency Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>
                  {competencyLevels.map((l) => (
                    <SelectItem key={l} value={l}>{competencyLabels[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.competency_level && <p className="text-xs text-destructive">{errors.competency_level}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Question Type</Label>
              <Select value={qType} onValueChange={setQType}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {questionTypes.map((t) => (
                    <SelectItem key={t} value={t}>{questionTypeLabels[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.question_type && <p className="text-xs text-destructive">{errors.question_type}</p>}
            </div>
          </div>

          {/* Question Text */}
          <div className="space-y-1.5">
            <Label>Question Text</Label>
            <Textarea
              placeholder="Write the question..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              rows={5}
              className="font-mono text-sm"
            />
            <div className="flex justify-between">
              {errors.question_text && <p className="text-xs text-destructive">{errors.question_text}</p>}
              <p className="text-xs text-muted-foreground ml-auto">{text.length}/2000</p>
            </div>
          </div>

          {/* Evaluation Guidelines */}
          <div className="space-y-1.5">
            <Label>Evaluation Guidelines</Label>
            <Textarea
              placeholder="Criteria for evaluating answers..."
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              maxLength={1000}
              rows={3}
            />
            <div className="flex justify-between">
              {errors.evaluation_guidelines && <p className="text-xs text-destructive">{errors.evaluation_guidelines}</p>}
              <p className="text-xs text-muted-foreground ml-auto">{guidelines.length}/1000</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit}>{editQuestion ? 'Save Changes' : 'Create Question'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
