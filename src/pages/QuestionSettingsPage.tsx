import { useState, useEffect } from 'react';
import { useQuestionStore, QuestionSetting } from '@/stores/questionStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const questionTypes = [
  { type: 'scenario', label: 'Scenario', description: 'Open-ended questions that test practical application of knowledge. Evaluated by AI across multiple dimensions.' },
  { type: 'mcq', label: 'Multiple Choice', description: 'Single-answer questions with 4 options. Auto-scored based on correct answer selection.' },
  { type: 'coding', label: 'Coding', description: 'Problem-solving questions requiring code implementation. AI evaluates correctness, approach, and code quality.' },
];

export default function QuestionSettingsPage() {
  const { settings, fetchSettings, updateSetting } = useQuestionStore();
  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const [editSetting, setEditSetting] = useState<QuestionSetting | null>(null);
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [minQuestions, setMinQuestions] = useState(3);
  const [saving, setSaving] = useState(false);

  const openEdit = (s: QuestionSetting) => {
    setEditSetting(s);
    setName(s.name);
    setLabel(s.label);
    setDescription(s.description);
    setScoreMin(s.score_range_min);
    setScoreMax(s.score_range_max);
    setMinQuestions(s.min_questions);
  };

  const handleSave = async () => {
    if (!editSetting) return;
    if (!name.trim() || !label.trim()) { toast.error('Name and label are required.'); return; }
    if (scoreMin >= scoreMax) { toast.error('Min score must be less than max.'); return; }
    if (minQuestions < 1) { toast.error('Min questions must be at least 1.'); return; }
    setSaving(true);
    await updateSetting(editSetting.id, { name: name.trim(), label: label.trim(), description: description.trim(), score_range_min: scoreMin, score_range_max: scoreMax, min_questions: minQuestions });
    setSaving(false);
    toast.success('Setting updated.');
    setEditSetting(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Question Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure competency levels, score ranges, and minimum question requirements.
        </p>
      </div>

      {/* Competency Levels */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Competency Levels</h3>
        <p className="text-xs text-muted-foreground">
          These levels determine question difficulty, scoring thresholds, and minimum question coverage.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {settings.map((s) => (
            <Card key={s.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">Level {s.level}</Badge>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-mono">{s.score_range_min}–{s.score_range_max}</span>
                    <Button
                      size="icon" variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil size={12} />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-sm mt-1">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Min questions: <span className="font-semibold text-foreground">{s.min_questions}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Question Types (static) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Question Types</h3>
        <p className="text-xs text-muted-foreground">Supported question formats for skill assessments.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {questionTypes.map((qt) => (
            <Card key={qt.type}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{qt.label}</CardTitle></CardHeader>
              <CardContent><p className="text-xs text-muted-foreground leading-relaxed">{qt.description}</p></CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Scoring Rules */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Scoring Rules</h3>
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Skill Score</strong> = Average of all question scores for that skill (0–100 scale).
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Level Mapping:</strong>{' '}
              {settings.map((s) => `${s.score_range_min}–${s.score_range_max} → L${s.level}`).join(', ') || '0–39 → L1, 40–59 → L2, 60–74 → L3, 75–89 → L4, 90–100 → L5'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Final Level:</strong> Manager always has final authority. System score is advisory.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Edit Sheet */}
      <Sheet open={!!editSetting} onOpenChange={(open) => { if (!open) setEditSetting(null); }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Level {editSetting?.level}</SheetTitle>
            <SheetDescription>Update the competency level configuration.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Score Min</Label>
                <Input type="number" value={scoreMin} onChange={(e) => setScoreMin(Number(e.target.value))} min={0} max={100} />
              </div>
              <div className="space-y-1.5">
                <Label>Score Max</Label>
                <Input type="number" value={scoreMax} onChange={(e) => setScoreMax(Number(e.target.value))} min={0} max={100} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Min Questions per Skill+Level</Label>
              <Input type="number" value={minQuestions} onChange={(e) => setMinQuestions(Number(e.target.value))} min={1} max={20} />
              <p className="text-xs text-muted-foreground">Minimum number of questions required per skill at this level for assessment generation.</p>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditSetting(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
