import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSkillStore } from '@/stores/skillStore';
import { useCompetencyLevelStore } from '@/stores/competencyLevelStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  ParsedMcqRow, downloadMcqTemplate, parseMcqWorkbook, buildMcqQuestionTextJson, MAX_ROWS,
} from '@/lib/mcqExcel';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'file' | 'review';

export default function BulkUploadSheet({ open, onOpenChange }: Props) {
  const { skills, topics, fetchSkills, fetchTopicsForSkill } = useSkillStore();
  const { levels, fetchLevels } = useCompetencyLevelStore();
  const { addQuestions } = useQuestionStore();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('file');
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

  // When user opens, ensure topics for skills referenced in the file are loaded.
  // We lazy-load topics for all skills mentioned in parsed rows.
  useEffect(() => {
    if (rows.length === 0) return;
    const skillIds = new Set(rows.map((r) => r.skill_id).filter(Boolean) as string[]);
    skillIds.forEach((id) => {
      if (!topics[id]) fetchTopicsForSkill(id);
    });
  }, [rows, topics, fetchTopicsForSkill]);

  const validRows = useMemo(() => rows.filter((r) => r.errors.length === 0), [rows]);
  const errorRows = useMemo(() => rows.filter((r) => r.errors.length > 0), [rows]);
  const warningRows = useMemo(() => rows.filter((r) => r.errors.length === 0 && r.warnings.length > 0), [rows]);

  const reset = () => {
    setStep('file');
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

  const handleFile = async (f: File) => {
    setFile(f);
    setParsing(true);
    try {
      const result = await parseMcqWorkbook(f, skills, topics, levels);
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
            Upload MCQs from an Excel file using the standard template. Only multiple-choice questions
            with a single correct answer are supported.
          </SheetDescription>
        </SheetHeader>

        {step === 'file' && (
          <div className="mt-6 space-y-6">
            <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-4">
              <FileSpreadsheet className="mx-auto text-muted-foreground" size={36} />
              <div>
                <p className="text-sm font-medium">Select an Excel file (.xlsx)</p>
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
                <Button variant="outline" onClick={downloadMcqTemplate} className="gap-1.5">
                  <Download size={14} /> Download Template
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">Template columns</p>
              <p>
                <code className="text-foreground">skill_name</code>, <code className="text-foreground">topic_name</code>,
                <code className="text-foreground"> competency_level</code>, <code className="text-foreground">question_text</code>,
                <code className="text-foreground"> option_1…option_4</code>, <code className="text-foreground">correct_option</code> (1-4),
                <code className="text-foreground"> evaluation_guidelines</code>.
              </p>
              <p>See the <strong>Instructions</strong> sheet inside the template for details.</p>
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
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
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
