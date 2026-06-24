import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, X, Settings2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useSkillStore } from '@/stores/skillStore';
import { useCompetencyLevelStore } from '@/stores/competencyLevelStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  ParsedMcqRow, TemplateScope, downloadMcqTemplate, parseMcqWorkbook, buildMcqQuestionTextJson, MAX_ROWS,
} from '@/lib/mcqExcel';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'mode' | 'configure' | 'file' | 'review';
type Mode = 'direct' | 'template';

export default function BulkUploadSheet({ open, onOpenChange }: Props) {
  const { skills, topics, fetchSkills, fetchTopicsForSkill } = useSkillStore();
  const { levels, fetchLevels } = useCompetencyLevelStore();
  const { addQuestions } = useQuestionStore();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<Mode | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [selectedLevelIds, setSelectedLevelIds] = useState<Set<string>>(new Set());
  const [skillFilter, setSkillFilter] = useState('');
  const [scope, setScope] = useState<TemplateScope | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedMcqRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<'draft' | 'published'>('draft');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (skills.length === 0) fetchSkills();
      if (levels.length === 0) fetchLevels();
    }
  }, [open, skills.length, levels.length, fetchSkills, fetchLevels]);

  useEffect(() => {
    if (rows.length === 0) return;
    const skillIds = new Set(rows.map((r) => r.skill_id).filter(Boolean) as string[]);
    skillIds.forEach((id) => {
      if (!topics[id]) fetchTopicsForSkill(id);
    });
  }, [rows, topics, fetchTopicsForSkill]);

  const activeSkills = useMemo(() => skills.filter((s) => s.status === 'active'), [skills]);
  const activeLevels = useMemo(
    () => levels.filter((l) => l.status === 'active').slice().sort((a, b) => a.level - b.level),
    [levels],
  );

  const skillsByCategory = useMemo(() => {
    const q = skillFilter.trim().toLowerCase();
    const filtered = q
      ? activeSkills.filter(
          (s) =>
            s.skill_name.toLowerCase().includes(q) ||
            (s.skill_category || '').toLowerCase().includes(q),
        )
      : activeSkills;
    const map = new Map<string, typeof filtered>();
    for (const s of filtered) {
      const cat = s.skill_category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, [] as any);
      (map.get(cat) as any).push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeSkills, skillFilter]);

  const validRows = useMemo(() => rows.filter((r) => r.errors.length === 0), [rows]);
  const errorRows = useMemo(() => rows.filter((r) => r.errors.length > 0), [rows]);
  const warningRows = useMemo(() => rows.filter((r) => r.errors.length === 0 && r.warnings.length > 0), [rows]);

  const reset = () => {
    setStep('mode');
    setMode(null);
    setSelectedSkillIds(new Set());
    setSelectedLevelIds(new Set());
    setSkillFilter('');
    setScope(null);
    setFile(null);
    setRows([]);
    setImporting(false);
    setParsing(false);
    setDefaultStatus('draft');
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const toggleSkill = (id: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleLevel = (id: string) => {
    setSelectedLevelIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAllVisibleSkills = () => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      skillsByCategory.forEach(([, list]) => list.forEach((s: any) => next.add(s.id)));
      return next;
    });
  };
  const clearSkills = () => setSelectedSkillIds(new Set());

  const buildScope = (): TemplateScope | null => {
    const chosenSkills = activeSkills.filter((s) => selectedSkillIds.has(s.id));
    const chosenLevels = activeLevels.filter((l) => selectedLevelIds.has(l.id));
    if (chosenSkills.length === 0) {
      toast.error('Select at least one skill.');
      return null;
    }
    if (chosenLevels.length === 0) {
      toast.error('Select at least one competency level.');
      return null;
    }
    return { skills: chosenSkills, levels: chosenLevels };
  };

  const handleDownloadTemplate = () => {
    const s = buildScope();
    if (!s) return;
    setScope(s);
    downloadMcqTemplate(s);
    toast.success('Template downloaded. Fill it in, then upload below.');
    setStep('file');
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setParsing(true);
    try {
      const result = await parseMcqWorkbook(f, skills, topics, levels, scope ?? undefined);
      if (result.fileError) {
        toast.error(result.fileError);
        setFile(null);
        setParsing(false);
        return;
      }
      if (result.tooManyRows) {
        toast.warning(`Only the first ${MAX_ROWS} rows were loaded.`);
      }
      if (result.rows.length === 0) {
        toast.error('No rows found in this file.');
        setFile(null);
        setParsing(false);
        return;
      }
      setRows(result.rows);
      setStep('review');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to parse the Excel file.');
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error('No valid rows to import.');
      return;
    }
    setImporting(true);
    try {
      await addQuestions(validRows.map((r) => ({
        tenant_id: user?.tenant_id ?? 'tenant-001',
        skill_id: r.skill_id as string,
        topic_id: r.topic_id,
        competency_level: r.competency_level_id as string,
        question_type: 'mcq' as const,
        question_text: buildMcqQuestionTextJson(r),
        evaluation_guidelines: r.evaluation_guidelines,
        status: defaultStatus,
        ai_generated: false,
      })));
      toast.success(`Imported ${validRows.length} question${validRows.length === 1 ? '' : 's'}.`);
      handleClose(false);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to import questions.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} /> Bulk Upload MCQ Questions
          </SheetTitle>
          <SheetDescription>
            Upload an existing file or download a fresh template scoped to selected skills and levels.
            Only multiple-choice questions with a single correct answer are supported.
          </SheetDescription>
        </SheetHeader>

        {/* Step indicator */}
        <div className="mt-4 flex items-center gap-2 text-xs flex-wrap">
          {(() => {
            const steps: { key: Step; label: string }[] =
              mode === 'template'
                ? [
                    { key: 'configure', label: '1. Configure Template' },
                    { key: 'file', label: '2. Upload' },
                    { key: 'review', label: '3. Review & Import' },
                  ]
                : [
                    { key: 'file', label: '1. Upload' },
                    { key: 'review', label: '2. Review & Import' },
                  ];
            const order: Step[] = steps.map((s) => s.key);
            const currentIdx = order.indexOf(step);
            return steps.map((s, i) => {
              const isActive = step === s.key;
              const isDone = currentIdx > i;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <span
                    className={
                      'px-2 py-0.5 rounded-md border ' +
                      (isActive
                        ? 'border-primary text-primary bg-primary/5'
                        : isDone
                        ? 'border-success/40 text-success'
                        : 'border-border text-muted-foreground')
                    }
                  >
                    {s.label}
                  </span>
                  {i < steps.length - 1 && <ArrowRight size={12} className="text-muted-foreground" />}
                </div>
              );
            });
          })()}
          {mode && step !== 'mode' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 ml-auto text-[11px]"
              onClick={() => {
                setMode(null);
                setScope(null);
                setFile(null);
                setRows([]);
                setStep('mode');
              }}
            >
              Change mode
            </Button>
          )}
        </div>

        {step === 'mode' && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { setMode('direct'); setScope(null); setStep('file'); }}
              className="text-left rounded-lg border border-border p-4 hover:border-primary hover:bg-primary/5 transition"
            >
              <div className="flex items-center gap-2 font-medium text-sm">
                <Upload size={16} /> Upload a file I already have
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Best if you've already prepared an .xlsx file. We'll validate it against the current
                active skills and competency levels.
              </p>
            </button>
            <button
              type="button"
              onClick={() => { setMode('template'); setStep('configure'); }}
              className="text-left rounded-lg border border-border p-4 hover:border-primary hover:bg-primary/5 transition"
            >
              <div className="flex items-center gap-2 font-medium text-sm">
                <Download size={16} /> Download a fresh template
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Pick the skills and competency levels you'll author for. We'll generate a template
                with those values listed for reference.
              </p>
            </button>
          </div>
        )}


        {step === 'configure' && (
          <div className="mt-6 space-y-6">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 size={14} /> Select skills
                  <Badge variant="outline" className="text-[10px]">
                    {selectedSkillIds.size} selected
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAllVisibleSkills}>
                    Select visible
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearSkills}>
                    Clear
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Search skills or categories…"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="h-8"
              />
              <ScrollArea className="h-64 rounded-md border border-border">
                <div className="p-2 space-y-3">
                  {skillsByCategory.length === 0 && (
                    <p className="text-xs text-muted-foreground p-3">No skills match your search.</p>
                  )}
                  {skillsByCategory.map(([cat, list]) => (
                    <div key={cat}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1">
                        {cat}
                      </p>
                      <div className="space-y-1">
                        {list.map((s: any) => (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedSkillIds.has(s.id)}
                              onCheckedChange={() => toggleSkill(s.id)}
                            />
                            <span className="text-xs">{s.skill_name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings2 size={14} /> Select competency levels
                <Badge variant="outline" className="text-[10px]">
                  {selectedLevelIds.size} selected
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeLevels.map((l) => {
                  const checked = selectedLevelIds.has(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLevel(l.id)}
                      className={
                        'text-xs px-3 py-1.5 rounded-md border transition ' +
                        (checked
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-accent')
                      }
                    >
                      L{l.level} · {l.label}
                    </button>
                  );
                })}
                {activeLevels.length === 0 && (
                  <p className="text-xs text-muted-foreground">No competency levels configured.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">How it works</p>
              <p>
                The downloaded template includes a <strong>Selected Scope</strong> sheet listing the
                skill names and level labels you picked, as a reference while you author. On import
                we validate against the current active skills and levels — so you can come back days
                later and still upload.
              </p>
            </div>
          </div>
        )}

        {step === 'file' && (
          <div className="mt-6 space-y-6">
            {scope && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Template scoped to:</span>
                <Badge variant="outline">{scope.skills.length} skill{scope.skills.length === 1 ? '' : 's'}</Badge>
                <Badge variant="outline">{scope.levels.length} level{scope.levels.length === 1 ? '' : 's'}</Badge>
                <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1" onClick={() => setStep('configure')}>
                  <Settings2 size={12} /> Change
                </Button>
              </div>
            )}

            <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-4">
              <FileSpreadsheet className="mx-auto text-muted-foreground" size={36} />
              <div>
                <p className="text-sm font-medium">Upload your completed template (.xlsx)</p>
                <p className="text-xs text-muted-foreground mt-1">Max {MAX_ROWS} rows per upload</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              <div className="flex justify-center gap-2">
                <Button onClick={() => inputRef.current?.click()} disabled={parsing} className="gap-1.5">
                  {parsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {parsing ? 'Parsing…' : 'Choose File'}
                </Button>
                {scope && (
                  <Button variant="outline" onClick={() => downloadMcqTemplate(scope)} className="gap-1.5">
                    <Download size={14} /> Re-download Template
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1 border-success/30 text-success">
                  <CheckCircle2 size={12} /> {validRows.length} valid
                </Badge>
                {errorRows.length > 0 && (
                  <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive">
                    <AlertTriangle size={12} /> {errorRows.length} error{errorRows.length === 1 ? '' : 's'}
                  </Badge>
                )}
                {warningRows.length > 0 && (
                  <Badge variant="outline" className="gap-1 border-warning/30 text-warning">
                    <AlertTriangle size={12} /> {warningRows.length} warning{warningRows.length === 1 ? '' : 's'}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {file?.name}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setRows([]); setStep('file'); }} className="gap-1">
                <X size={14} /> Choose different file
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="max-h-[55vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Skill</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead className="w-16 text-center">Correct</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const hasError = r.errors.length > 0;
                      const hasWarning = !hasError && r.warnings.length > 0;
                      return (
                        <TableRow key={r.rowNumber} className={hasError ? 'bg-destructive/5' : hasWarning ? 'bg-warning/5' : undefined}>
                          <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                          <TableCell>
                            {hasError ? (
                              <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">Error</Badge>
                            ) : hasWarning ? (
                              <Badge variant="outline" className="border-warning/30 text-warning text-[10px]">Warning</Badge>
                            ) : (
                              <Badge variant="outline" className="border-success/30 text-success text-[10px]">Valid</Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[280px]">
                            <div className="text-xs truncate" title={r.question_text}>
                              {r.question_text || <span className="text-muted-foreground italic">(empty)</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{r.skill_name || '—'}</TableCell>
                          <TableCell className="text-xs">{r.competency_level_label || r.competency_level_input || '—'}</TableCell>
                          <TableCell className="text-xs text-center">
                            {r.correctIndex != null ? r.correctIndex + 1 : '—'}
                          </TableCell>
                          <TableCell className="text-[11px]">
                            {hasError && (
                              <ul className="list-disc pl-4 text-destructive space-y-0.5">
                                {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                              </ul>
                            )}
                            {!hasError && r.warnings.length > 0 && (
                              <ul className="list-disc pl-4 text-warning space-y-0.5">
                                {r.warnings.map((e, i) => <li key={i}>{e}</li>)}
                              </ul>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground">Import as:</label>
              <Select value={defaultStatus} onValueChange={(v) => setDefaultStatus(v as 'draft' | 'published')}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (recommended)</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          {step === 'configure' && (
            <Button
              onClick={handleDownloadTemplate}
              disabled={selectedSkillIds.size === 0 || selectedLevelIds.size === 0}
              className="gap-1.5"
            >
              <Download size={14} /> Download Template
            </Button>
          )}
          {step === 'review' && (
            <Button onClick={handleImport} disabled={importing || validRows.length === 0} className="gap-1.5">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {importing ? 'Importing…' : `Approve & Import ${validRows.length}`}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
