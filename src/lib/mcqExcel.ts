import * as XLSX from 'xlsx';
import type { Skill, SkillTopic } from '@/stores/skillStore';
import type { CompetencyLevel } from '@/stores/competencyLevelStore';

export interface ParsedMcqRow {
  rowNumber: number; // 1-based excel row (header = 1, first data row = 2)
  raw: Record<string, any>;
  skill_name: string;
  topic_name: string;
  competency_level_input: string;
  question_text: string;
  options: string[]; // up to 4 (trimmed, empty kept as '')
  correct_option_input: string;
  evaluation_guidelines: string;
  // Resolved
  skill_id: string | null;
  topic_id: string | null;
  competency_level_id: string | null;
  competency_level_label: string;
  correctIndex: number | null; // 0-based
  // Validation
  errors: string[];
  warnings: string[];
}

export const TEMPLATE_HEADERS = [
  'skill_name',
  'topic_name',
  'competency_level',
  'question_text',
  'option_1',
  'option_2',
  'option_3',
  'option_4',
  'correct_option',
  'evaluation_guidelines',
];

export interface TemplateScope {
  skills: Skill[];
  levels: CompetencyLevel[];
}

export function downloadMcqTemplate(scope: TemplateScope) {
  const wb = XLSX.utils.book_new();

  const skillNames = scope.skills.map((s) => s.skill_name);
  const levelLabels = scope.levels
    .slice()
    .sort((a, b) => a.level - b.level)
    .map((l) => l.label);

  // Sheet 1: Questions — empty rows pre-seeded with the first selected skill/level as a hint
  const firstSkill = skillNames[0] ?? '';
  const firstLevel = levelLabels[0] ?? '';
  const seedRow = {
    skill_name: firstSkill,
    topic_name: '',
    competency_level: firstLevel,
    question_text: '',
    option_1: '',
    option_2: '',
    option_3: '',
    option_4: '',
    correct_option: '',
    evaluation_guidelines: '',
  };
  const seedRows = Array.from({ length: 3 }, () => ({ ...seedRow }));
  const wsQuestions = XLSX.utils.json_to_sheet(seedRows, { header: TEMPLATE_HEADERS });
  (wsQuestions as any)['!cols'] = [
    { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 50 },
    { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 },
    { wch: 14 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Questions');

  // Sheet 2: Selected Scope — the source of truth for valid values in this template
  const scopeAoa: any[][] = [
    ['Selected Scope — use ONLY these values in the Questions sheet'],
    [],
    ['Selected Skills'],
    ['skill_name', 'category'],
    ...scope.skills.map((s) => [s.skill_name, s.skill_category || '']),
    [],
    ['Selected Competency Levels'],
    ['level', 'label', 'description'],
    ...scope.levels
      .slice()
      .sort((a, b) => a.level - b.level)
      .map((l) => [l.level, l.label, l.description || '']),
  ];
  const wsScope = XLSX.utils.aoa_to_sheet(scopeAoa);
  (wsScope as any)['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsScope, 'Selected Scope');

  // Sheet 3: Instructions
  const instructions = [
    ['MCQ Bulk Upload — Template Instructions'],
    [],
    ['This template is pre-scoped to the skills and competency levels you selected.'],
    ['Open the "Selected Scope" sheet to see the allowed values.'],
    ['Rows that reference a skill or level outside that scope will be rejected on import.'],
    [],
    ['Column', 'Required', 'Description'],
    ['skill_name', 'Yes', 'Must match a name in Selected Scope → Selected Skills (case-insensitive).'],
    ['topic_name', 'No', 'Optional. Must belong to the resolved skill if provided.'],
    ['competency_level', 'Yes', 'Must match a label in Selected Scope (e.g. "Beginner") OR the level number (1-5).'],
    ['question_text', 'Yes', 'The MCQ question stem.'],
    ['option_1', 'Yes', 'Answer option 1.'],
    ['option_2', 'Yes', 'Answer option 2.'],
    ['option_3', 'Yes', 'Answer option 3.'],
    ['option_4', 'Yes', 'Answer option 4.'],
    ['correct_option', 'Yes', 'Index of the correct option (1, 2, 3, or 4).'],
    ['evaluation_guidelines', 'No', 'Optional notes. Typically left blank for MCQs.'],
    [],
    ['Notes:'],
    ['• Only MCQ (single correct answer) is supported by this template.'],
    [`• Maximum ${MAX_ROWS} rows per upload.`],
    ['• Replace the seeded rows in the Questions sheet with your own data.'],
    ['• Tip: copy/paste skill_name and competency_level values directly from the Selected Scope sheet to avoid typos.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  (wsInstr as any)['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  XLSX.writeFile(wb, 'mcq_upload_template.xlsx');
}

function norm(s: any): string {
  return String(s ?? '').trim();
}

export const MAX_ROWS = 500;

export interface ParseResult {
  rows: ParsedMcqRow[];
  tooManyRows: boolean;
  fileError?: string;
}

export async function parseMcqWorkbook(
  file: File,
  skills: Skill[],
  topicsBySkill: Record<string, SkillTopic[]>,
  levels: CompetencyLevel[],
  _scope?: TemplateScope, // accepted for compatibility; no longer used to block imports
): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch (e: any) {
    return { rows: [], tooManyRows: false, fileError: 'Could not read this Excel file.' };
  }

  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'questions') ?? wb.SheetNames[0];
  if (!sheetName) return { rows: [], tooManyRows: false, fileError: 'Workbook has no sheets.' };
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

  if (json.length === 0) {
    return { rows: [], tooManyRows: false, fileError: 'No rows found in the Questions sheet.' };
  }

  const tooManyRows = json.length > MAX_ROWS;
  const limited = json.slice(0, MAX_ROWS);

  // Scope is no longer enforced at import time — templates may be days old.
  // A skill/level that resolves against the active lists is always accepted.

  // Lookups
  const skillByName = new Map<string, Skill>();
  for (const s of skills) {
    if (s.status === 'active') skillByName.set(s.skill_name.trim().toLowerCase(), s);
  }
  const levelByKey = new Map<string, CompetencyLevel>();
  for (const l of levels) {
    if (l.status !== 'active') continue;
    levelByKey.set(l.name.trim().toLowerCase(), l);
    levelByKey.set(l.label.trim().toLowerCase(), l);
    levelByKey.set(String(l.level), l);
  }

  // Track duplicates within file
  const seenKeys = new Set<string>();

  const rows: ParsedMcqRow[] = limited.map((raw, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const skill_name = norm(raw.skill_name);
    const topic_name = norm(raw.topic_name);
    const competency_level_input = norm(raw.competency_level);
    const question_text = norm(raw.question_text);
    const options = [
      norm(raw.option_1), norm(raw.option_2), norm(raw.option_3), norm(raw.option_4),
    ];
    const correct_option_input = norm(raw.correct_option);
    const evaluation_guidelines = norm(raw.evaluation_guidelines);

    // Skill
    let skill_id: string | null = null;
    if (!skill_name) errors.push('skill_name is required');
    else {
      const sk = skillByName.get(skill_name.toLowerCase());
      if (!sk) errors.push(`Unknown skill "${skill_name}"`);
      else {
        skill_id = sk.id;
      }
    }

    // (skill scope no longer enforced)

    // Topic
    let topic_id: string | null = null;
    if (topic_name && skill_id) {
      const topics = topicsBySkill[skill_id] || [];
      const t = topics.find((tp) => tp.name.trim().toLowerCase() === topic_name.toLowerCase() && tp.status === 'active');
      if (!t) warnings.push(`Topic "${topic_name}" not found for this skill — will be saved without a topic`);
      else topic_id = t.id;
    }

    // Level
    let competency_level_id: string | null = null;
    let competency_level_label = competency_level_input;
    if (!competency_level_input) errors.push('competency_level is required');
    else {
      const lv = levelByKey.get(competency_level_input.toLowerCase());
      if (!lv) errors.push(`Unknown competency_level "${competency_level_input}"`);
      else {
        competency_level_id = lv.id;
        competency_level_label = lv.label;
        if (scopedLevelIds && !scopedLevelIds.has(lv.id)) {
          errors.push(`Competency level "${competency_level_input}" is not in this template's scope`);
        }
      }
    }

    // Question text
    if (!question_text) errors.push('question_text is required');
    else if (question_text.length < 5) errors.push('question_text is too short');

    // Options
    const filled = options.filter((o) => o.length > 0);
    if (filled.length < 4) errors.push('All 4 options are required');
    const optionSet = new Set(filled.map((o) => o.toLowerCase()));
    if (optionSet.size !== filled.length) errors.push('Options must be unique');

    // Correct
    let correctIndex: number | null = null;
    if (!correct_option_input) errors.push('correct_option is required');
    else {
      const n = Number(correct_option_input);
      if (!Number.isInteger(n) || n < 1 || n > 4) {
        errors.push('correct_option must be 1, 2, 3, or 4');
      } else {
        correctIndex = n - 1;
        if (!options[correctIndex]) errors.push(`correct_option ${n} points to an empty option`);
      }
    }

    // Duplicate within file
    if (skill_id && question_text) {
      const key = `${skill_id}::${question_text.toLowerCase()}`;
      if (seenKeys.has(key)) warnings.push('Duplicate of an earlier row in this file');
      else seenKeys.add(key);
    }

    return {
      rowNumber: idx + 2,
      raw,
      skill_name, topic_name, competency_level_input,
      question_text, options, correct_option_input, evaluation_guidelines,
      skill_id, topic_id, competency_level_id, competency_level_label, correctIndex,
      errors, warnings,
    };
  });

  return { rows, tooManyRows };
}

/** Build the JSON payload stored in questions.question_text for MCQ. */
export function buildMcqQuestionTextJson(row: ParsedMcqRow): string {
  return JSON.stringify({
    questionText: row.question_text,
    options: row.options,
    correctIndex: row.correctIndex,
  });
}
