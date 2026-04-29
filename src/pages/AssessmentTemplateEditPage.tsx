import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTemplateStore, TemplateType, SkillSelectionMode } from "@/stores/templateStore";
import { useDomainStore } from "@/stores/domainStore";
import { useSkillStore } from "@/stores/skillStore";
import { useQuestionStore } from "@/stores/questionStore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Layers, ListChecks, Loader2, Save, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCompetencyLevelStore, getLevelLabelsByIdMap } from "@/stores/competencyLevelStore";
import { usePageTitleStore } from "@/stores/pageTitleStore";
import QuestionPickerSheet from "@/components/templates/QuestionPickerSheet";
import SelectedQuestionsSheet from "@/components/templates/SelectedQuestionsSheet";
import SelectedQuestionRow from "@/components/templates/SelectedQuestionRow";

const ALL_QUESTION_TYPES = [
  { value: "mcq", label: "MCQ" },
  { value: "scenario", label: "Scenario" },
  { value: "coding", label: "Coding" },
];

// Adaptive engine grades correctness deterministically — only MCQ is supported.
const ADAPTIVE_QUESTION_TYPES = new Set(["mcq"]);
const ADAPTIVE_QPS_MIN = 4;
const ADAPTIVE_QPS_MAX = 5;

export default function AssessmentTemplateEditPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const isNew = !templateId || templateId === "new";
  const navigate = useNavigate();
  const { user } = useAuth();

  const { templates, fetchTemplates, fetchTemplateRelations, saveTemplate } = useTemplateStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { questions, fetchQuestions } = useQuestionStore();

  const tenantId = user?.tenant_id ?? "tenant-001";

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TemplateType>("adaptive");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [duration, setDuration] = useState(45);
  const [maxAttempts, setMaxAttempts] = useState(1);

  // Adaptive
  const [domainId, setDomainId] = useState<string>("");
  const [skillMode, setSkillMode] = useState<SkillSelectionMode>("custom");
  const [skillsPerAssessment, setSkillsPerAssessment] = useState(5);
  const [questionsPerSkill, setQuestionsPerSkill] = useState(4);
  const [questionTypes, setQuestionTypes] = useState<string[]>(["mcq"]);
  const [pickedSkills, setPickedSkills] = useState<string[]>([]);

  // Fixed
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [pickedQuestions, setPickedQuestions] = useState<string[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(isNew);

  const { levels: competencyLevels, fetchLevels } = useCompetencyLevelStore();
  const setPageTitle = usePageTitleStore((s) => s.setPageTitle);

  useEffect(() => {
    fetchDomains();
    fetchSkills();
    fetchQuestions();
    fetchLevels();
    if (isNew) {
      fetchTemplates();
      return;
    }
    (async () => {
      await fetchTemplates();
      const t = useTemplateStore.getState().getTemplate(templateId!);
      if (t) {
        setName(t.name);
        setDescription(t.description);
        setType(t.type);
        setStatus(t.status);
        setDuration(t.duration_minutes);
        setMaxAttempts(t.max_attempts);
        setDomainId(t.domain_id ?? "");
        setSkillMode(t.skill_selection_mode === "custom" ? "custom" : "custom");
        setSkillsPerAssessment(t.skills_per_assessment);
        setQuestionsPerSkill(t.questions_per_skill);
        setQuestionTypes(t.question_types?.length ? t.question_types : ["mcq"]);
        setShuffleQuestions(t.shuffle_questions);
        setShuffleOptions(t.shuffle_options);
        const rel = await fetchTemplateRelations(t.id);
        setPickedSkills(rel.skill_ids);
        setPickedQuestions(rel.question_ids);
      }
      setLoaded(true);
    })();
  }, [templateId, isNew]);

  // Live page title (breadcrumb)
  useEffect(() => {
    const trimmed = name.trim();
    if (isNew) {
      setPageTitle(trimmed || "New Assessment Template");
    } else {
      setPageTitle(trimmed || "Edit Template");
    }
    return () => setPageTitle(null);
  }, [name, isNew, setPageTitle]);

  const skillsForDomain = useMemo(() => {
    if (!domainId) return [];
    const skillIds = new Set(mappings.filter((m) => m.domain_id === domainId).map((m) => m.skill_id));
    return skills.filter((s) => skillIds.has(s.id) && s.status === "active");
  }, [domainId, mappings, skills]);

  const skillNameMap = useMemo(() => new Map(skills.map((s) => [s.id, s.skill_name])), [skills]);
  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const levelLabels = useMemo(() => getLevelLabelsByIdMap(competencyLevels), [competencyLevels]);

  // Validation
  const errors: string[] = [];
  if (!name.trim()) errors.push("Name is required");
  if (duration < 5 || duration > 240) errors.push("Duration must be between 5 and 240 minutes");
  if (maxAttempts < 1) errors.push("Max attempts must be at least 1");
  if (type === "adaptive") {
    if (!domainId) errors.push("Domain is required for adaptive templates");
    if (questionTypes.length === 0) errors.push("Select at least one question type");
    if (questionTypes.some((qt) => !ADAPTIVE_QUESTION_TYPES.has(qt)))
      errors.push("Adaptive templates currently support MCQ questions only");
    if (skillMode === "custom" && pickedSkills.length === 0) errors.push("Pick at least one skill (custom mode)");
    if (skillsPerAssessment < 1) errors.push("Skills per assessment must be ≥ 1");
    if (questionsPerSkill < ADAPTIVE_QPS_MIN || questionsPerSkill > ADAPTIVE_QPS_MAX)
      errors.push(`Questions per skill must be between ${ADAPTIVE_QPS_MIN} and ${ADAPTIVE_QPS_MAX}`);
  } else {
    if (pickedQuestions.length === 0) errors.push("Add at least one question");
  }
  const canActivate = errors.length === 0;

  const expectedQuestionCount = type === "adaptive" ? skillsPerAssessment * questionsPerSkill : pickedQuestions.length;

  const handleSave = async (saveAs: "draft" | "active") => {
    if (saveAs === "active" && !canActivate) {
      toast.error(errors[0]);
      return;
    }
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const id = await saveTemplate({
      id: isNew ? undefined : templateId,
      tenant_id: tenantId,
      name,
      description,
      type,
      status: saveAs,
      duration_minutes: duration,
      max_attempts: maxAttempts,
      reattempt_enabled: maxAttempts > 1,
      domain_id: type === "adaptive" ? domainId || null : null,
      skill_selection_mode: type === "adaptive" ? skillMode : null,
      skills_per_assessment: skillsPerAssessment,
      questions_per_skill: questionsPerSkill,
      question_types: questionTypes,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      skill_ids: type === "adaptive" && skillMode === "custom" ? pickedSkills : [],
      question_ids: type === "fixed" ? pickedQuestions : [],
    });
    setSaving(false);
    if (id) {
      toast.success(`Template ${saveAs === "active" ? "activated" : "saved as draft"}`);
      navigate("/assessment-templates");
    } else {
      toast.error("Failed to save template");
    }
  };

  const toggleQuestionType = (qt: string) => {
    setQuestionTypes((prev) => (prev.includes(qt) ? prev.filter((x) => x !== qt) : [...prev, qt]));
  };

  const togglePickedSkill = (sid: string) => {
    setPickedSkills((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]));
  };

  const togglePickedQuestion = (qid: string) => {
    setPickedQuestions((prev) => (prev.includes(qid) ? prev.filter((x) => x !== qid) : [...prev, qid]));
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin mr-2" /> Loading template…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/assessment-templates")}
        className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to Templates
      </Button>

      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          {isNew ? "New Assessment Template" : "Edit Template"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Configure how this assessment is generated and delivered.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic details */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Basics</h3>
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Frontend Mid-Year Adaptive"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={300}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={240}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Attempts</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value) || 1)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Set to 1 for a single attempt, or higher to allow re-attempts.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Type toggle */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Type</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setType("adaptive");
                    setQuestionTypes(["mcq"]);
                    setQuestionsPerSkill((prev) =>
                      Math.min(ADAPTIVE_QPS_MAX, Math.max(ADAPTIVE_QPS_MIN, prev || ADAPTIVE_QPS_MIN)),
                    );
                  }}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    type === "adaptive" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Layers size={14} className="text-primary" />
                    <span className="text-sm font-medium text-foreground">Adaptive</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Picks MCQs on the fly: starts at the self-rated level and walks up/down based on a 2-correct /
                    2-wrong streak.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setType("fixed")}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    type === "fixed" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ListChecks size={14} className="text-info" />
                    <span className="text-sm font-medium text-foreground">Fixed</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hand-pick a specific question list. Every employee gets the same questions.
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Type-specific config */}
          {type === "adaptive" ? (
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Adaptive Configuration</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs">Domain *</Label>
                  <Select value={domainId} onValueChange={setDomainId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Skill Selection Mode</Label>
                  <Select value={skillMode} onValueChange={(v) => setSkillMode(v as SkillSelectionMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Manual (pick specific skills)</SelectItem>
                      <SelectItem value="top_n" disabled>
                        <span className="flex items-center gap-2">
                          Top N skills (auto-pick by self-rating)
                          <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            Coming Soon
                          </span>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {skillMode === "custom" && domainId && (
                  <div className="space-y-2">
                    <Label className="text-xs">Pick Skills ({pickedSkills.length} selected)</Label>
                    <div className="rounded-lg border border-border max-h-60 overflow-y-auto">
                      {skillsForDomain.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3">No skills mapped to this domain.</p>
                      ) : (
                        skillsForDomain.map((s) => (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                          >
                            <Checkbox
                              checked={pickedSkills.includes(s.id)}
                              onCheckedChange={() => togglePickedSkill(s.id)}
                            />
                            <span className="text-xs text-foreground">{s.skill_name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Skills per Assessment</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={skillsPerAssessment}
                      onChange={(e) => setSkillsPerAssessment(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Questions per Skill</Label>
                    <Input
                      type="number"
                      min={ADAPTIVE_QPS_MIN}
                      max={ADAPTIVE_QPS_MAX}
                      value={questionsPerSkill}
                      onChange={(e) =>
                        setQuestionsPerSkill(
                          Math.min(
                            ADAPTIVE_QPS_MAX,
                            Math.max(ADAPTIVE_QPS_MIN, Number(e.target.value) || ADAPTIVE_QPS_MIN),
                          ),
                        )
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Adaptive engine asks {ADAPTIVE_QPS_MIN}–{ADAPTIVE_QPS_MAX} questions per skill.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Question Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_QUESTION_TYPES.map((qt) => {
                      const isAllowed = ADAPTIVE_QUESTION_TYPES.has(qt.value);
                      return (
                        <label
                          key={qt.value}
                          title={isAllowed ? "" : "Adaptive currently supports MCQ only"}
                          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 ${
                            isAllowed
                              ? "border-border cursor-pointer hover:border-primary/30"
                              : "border-border opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <Checkbox
                            checked={questionTypes.includes(qt.value)}
                            onCheckedChange={() => isAllowed && toggleQuestionType(qt.value)}
                            disabled={!isAllowed}
                          />
                          <span className="text-xs text-foreground">{qt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Adaptive grading needs a deterministic correct answer, so only MCQ is supported.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Fixed Configuration</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-xs text-foreground">Shuffle questions</span>
                    <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-xs text-foreground">Shuffle options (MCQ)</span>
                    <Switch checked={shuffleOptions} onCheckedChange={setShuffleOptions} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      Selected Questions ({pickedQuestions.length})
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setPickerOpen(true)}
                    >
                      <Plus size={13} /> Add Questions
                    </Button>
                  </div>

                  {pickedQuestions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        No questions added yet.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click <span className="font-medium text-foreground">Add Questions</span> to pick from your question bank.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        {pickedQuestions.slice(0, 15).map((qid, idx) => {
                          const q = questionMap.get(qid);
                          return (
                            <SelectedQuestionRow
                              key={qid}
                              index={idx}
                              question={q}
                              fallbackId={qid}
                              skillName={q ? skillNameMap.get(q.skill_id) : undefined}
                              levelLabel={q ? levelLabels[q.competency_level] : undefined}
                              onRemove={() => togglePickedQuestion(qid)}
                            />
                          );
                        })}
                      </div>
                      {pickedQuestions.length > 15 && (
                        <button
                          type="button"
                          onClick={() => setViewAllOpen(true)}
                          className="text-xs text-primary hover:underline mt-1"
                        >
                          View all {pickedQuestions.length} selected questions →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary rail */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Summary</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-foreground font-medium capitalize">{type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="text-foreground font-medium">{duration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max attempts</span>
                  <span className="text-foreground font-medium">{maxAttempts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected questions</span>
                  <span className="text-foreground font-medium">≈ {expectedQuestionCount}</span>
                </div>
                {type === "adaptive" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Domain</span>
                      <span className="text-foreground font-medium truncate ml-2">
                        {domainId ? (domains.find((d) => d.id === domainId)?.name ?? "—") : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Question types</span>
                      <span className="text-foreground font-medium">{questionTypes.length || 0}</span>
                    </div>
                  </>
                )}
              </div>

              {errors.length > 0 && (
                <div className="rounded-md bg-warning/10 border border-warning/20 p-2.5 space-y-1">
                  <p className="text-[11px] font-medium text-warning">Required to activate:</p>
                  <ul className="text-[11px] text-warning/90 list-disc pl-4 space-y-0.5">
                    {errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 w-full"
                  disabled={saving}
                  onClick={() => handleSave("draft")}
                >
                  <Save size={13} /> Save Draft
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 w-full"
                  disabled={saving || !canActivate}
                  onClick={() => handleSave("active")}
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save & Activate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <QuestionPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialSelectedIds={pickedQuestions}
        onSave={(ids) => setPickedQuestions(ids)}
      />
      <SelectedQuestionsSheet
        open={viewAllOpen}
        onOpenChange={setViewAllOpen}
        selectedIds={pickedQuestions}
        onRemove={(id) => togglePickedQuestion(id)}
      />
    </div>
  );
}
