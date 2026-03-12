import { useState, useMemo, useEffect } from 'react';
import { useQuestionStore, Question, competencyLevels, questionTypes, competencyLabels, questionTypeLabels } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import QuestionFormDialog from '@/components/questions/QuestionFormDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, CheckCircle, HelpCircle, Sparkles, CheckSquare, Code, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<string, string> = {
  published: 'bg-success/15 text-success border-success/20',
  draft: 'bg-warning/15 text-warning border-warning/20',
  disabled: 'bg-muted text-muted-foreground border-border',
};

const typeIcons: Record<string, string> = {
  scenario: '🎯',
  coding: '💻',
  mcq: '📝',
};

// Parse structured question_text (MCQ or Coding stored as JSON)
function parseQuestionText(text: string, type: string): { display: string; parsed: any | null } {
  try {
    const parsed = JSON.parse(text);
    if (type === 'mcq' && parsed?.questionText) {
      return { display: parsed.questionText, parsed };
    }
    if (type === 'coding' && parsed?.problemStatement) {
      return { display: parsed.problemStatement, parsed };
    }
  } catch { /* not JSON, plain text */ }
  return { display: text, parsed: null };
}

export default function QuestionBankPage() {
  const { questions, toggleQuestionStatus, publishQuestion, fetchQuestions } = useQuestionStore();
  const { skills, fetchSkills } = useSkillStore();
  const { currentRole } = useAuth();
  const isAdmin = currentRole === 'admin' || currentRole === 'hr';
  useEffect(() => { fetchQuestions(); fetchSkills(); }, [fetchQuestions, fetchSkills]);

  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeSkills = skills.filter((s) => s.status === 'active');
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

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

  return (
    <div className="space-y-6">
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

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
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
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditQuestion(null); setFormOpen(true); }} className="gap-1.5 shrink-0">
            <Plus size={14} /> Add Question
          </Button>
        )}
      </div>

      {/* Question cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">No questions found matching your filters.</div>
        ) : (
          filtered.map((q) => {
            const skill = skillMap.get(q.skill_id);
            const isExpanded = expandedId === q.id;
            return (
              <div
                key={q.id}
                className={`rounded-xl border bg-card overflow-hidden transition-colors ${q.status === 'disabled' ? 'opacity-60 border-border' : 'border-border'}`}
              >
              {(() => {
                const { display, parsed } = parseQuestionText(q.question_text, q.question_type);
                return (
                  <>
                    {/* Header */}
                    <button
                      className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    >
                      <span className="text-lg mt-0.5">{typeIcons[q.question_type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground line-clamp-2">{display}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs font-normal">{skill?.skill_name ?? 'Unknown'}</Badge>
                          <Badge variant="outline" className="text-xs font-normal">{competencyLabels[q.competency_level]}</Badge>
                          <Badge variant="outline" className="text-xs font-normal">{questionTypeLabels[q.question_type]}</Badge>
                          <Badge className={`text-xs border ${statusStyles[q.status]}`}>{q.status}</Badge>
                          {q.ai_generated && (
                            <Badge variant="outline" className="text-xs font-normal gap-1 border-primary/30 text-primary">
                              <Sparkles size={10} /> AI
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 py-4 space-y-3 bg-muted/10">
                        {/* Scenario: plain text */}
                        {q.question_type === 'scenario' && (
                          <>
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Full Question</h4>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{display}</p>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Evaluation Guidelines</h4>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{q.evaluation_guidelines}</p>
                            </div>
                          </>
                        )}

                        {/* MCQ: show question + options with correct highlighted */}
                        {q.question_type === 'mcq' && parsed && (
                          <>
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Question</h4>
                              <p className="text-sm text-foreground">{parsed.questionText || display}</p>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Options</h4>
                              <div className="space-y-1.5">
                                {(parsed.options || []).map((opt: string, idx: number) => (
                                  <div
                                    key={idx}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                      idx === parsed.correctIndex
                                        ? 'border-success/40 bg-success/5 text-foreground'
                                        : 'border-border text-foreground'
                                    }`}
                                  >
                                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                                      idx === parsed.correctIndex ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                                    }`}>
                                      {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span>{opt}</span>
                                    {idx === parsed.correctIndex && (
                                      <CheckSquare size={14} className="ml-auto text-success shrink-0" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* MCQ fallback when not parsed */}
                        {q.question_type === 'mcq' && !parsed && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Question</h4>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{q.question_text}</p>
                          </div>
                        )}

                        {/* Coding: problem + examples */}
                        {q.question_type === 'coding' && parsed && (
                          <>
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Problem Statement</h4>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{parsed.problemStatement}</p>
                            </div>
                            {parsed.exampleInput && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Example Input</h4>
                                  <pre className="text-xs text-foreground bg-muted rounded-lg p-2 font-mono whitespace-pre-wrap">{parsed.exampleInput}</pre>
                                </div>
                                {parsed.exampleOutput && (
                                  <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Example Output</h4>
                                    <pre className="text-xs text-foreground bg-muted rounded-lg p-2 font-mono whitespace-pre-wrap">{parsed.exampleOutput}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Coding fallback */}
                        {q.question_type === 'coding' && !parsed && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Problem</h4>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{q.question_text}</p>
                          </div>
                        )}

                        {isAdmin && (
                          <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditQuestion(q); setFormOpen(true); }}>
                              <Pencil size={12} /> Edit
                            </Button>
                            {q.status === 'draft' && (
                              <Button size="sm" variant="outline" className="gap-1 text-success hover:text-success" onClick={() => publishQuestion(q.id)}>
                                <CheckCircle size={12} /> Publish
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => toggleQuestionStatus(q.id)}>
                              {q.status === 'disabled' ? <><ToggleLeft size={12} /> Enable</> : <><ToggleRight size={12} /> Disable</>}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
              </div>
            );
          })
        )}
      </div>

      <QuestionFormDialog open={formOpen} onOpenChange={setFormOpen} editQuestion={editQuestion} />
    </div>
  );
}
