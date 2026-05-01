import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';

export interface CompetencyLevel {
  id: string;
  tenant_id: string;
  level: number;
  name: string;
  label: string;
  description: string;
  score_range_min: number;
  score_range_max: number;
  min_questions: number;
  status: string;
}

interface CompetencyLevelStore {
  levels: CompetencyLevel[];
  loading: boolean;
  initialized: boolean;
  fetchLevels: () => Promise<void>;
  updateLevel: (id: string, updates: Partial<CompetencyLevel>) => Promise<void>;
}

export const useCompetencyLevelStore = create<CompetencyLevelStore>((set, get) => ({
  levels: [],
  loading: false,
  initialized: false,

  fetchLevels: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('competency_levels')
        .select('*')
        .order('level');
      if (error) throw error;
      const levels: CompetencyLevel[] = (data || []).map((s: any) => ({
        id: s.id, tenant_id: s.tenant_id, level: s.level,
        name: s.name, label: s.label, description: s.description || '',
        score_range_min: s.score_range_min, score_range_max: s.score_range_max,
        min_questions: s.min_questions, status: s.status,
      }));
      set({ levels, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch competency levels:', err);
      set({ loading: false, initialized: true });
    }
  },

  updateLevel: async (id, updates) => {
    const userId = getCurrentUserId();
    const { error } = await supabase.from('competency_levels').update({
      ...updates, modified_at: new Date().toISOString(), modified_by: userId,
    }).eq('id', id);
    if (error) { console.error('Failed to update competency level:', error); return; }
    set((state) => ({
      levels: state.levels.map((l) => l.id === id ? { ...l, ...updates } : l),
    }));
  },
}));

// ─── Helper functions ───

/** Get active level names sorted by level number */
export function getActiveLevelNames(levels: CompetencyLevel[]): string[] {
  return levels
    .filter(l => l.status === 'active')
    .sort((a, b) => a.level - b.level)
    .map(l => l.name);
}

/** Get active level UUIDs sorted by level number (for dropdowns/forms) */
export function getActiveLevelIds(levels: CompetencyLevel[]): string[] {
  return levels
    .filter(l => l.status === 'active')
    .sort((a, b) => a.level - b.level)
    .map(l => l.id);
}

/** Get a map of name -> label for active levels */
export function getLevelLabelsMap(levels: CompetencyLevel[]): Record<string, string> {
  return Object.fromEntries(
    levels
      .filter(l => l.status === 'active')
      .sort((a, b) => a.level - b.level)
      .map(l => [l.name, l.label])
  );
}

/** Get a map of UUID id -> label for active levels (for display when column stores UUID) */
export function getLevelLabelsByIdMap(levels: CompetencyLevel[]): Record<string, string> {
  return Object.fromEntries(
    levels
      .filter(l => l.status === 'active')
      .sort((a, b) => a.level - b.level)
      .map(l => [l.id, l.label])
  );
}

/** Get label for a specific level name */
export function getLevelLabel(levels: CompetencyLevel[], name: string): string {
  return levels.find(l => l.name === name)?.label || name;
}

/** Get label for a specific level UUID */
export function getLevelLabelById(levels: CompetencyLevel[], id: string): string {
  return levels.find(l => l.id === id)?.label || id;
}

/** Get level name by UUID */
export function getLevelNameById(levels: CompetencyLevel[], id: string): string {
  return levels.find(l => l.id === id)?.name || '';
}

/** Get label for a numeric level */
export function getLevelLabelByNumber(levels: CompetencyLevel[], levelNum: number): string {
  return levels.find(l => l.level === levelNum)?.label || `Level ${levelNum}`;
}

/** Get competency level name by numeric level */
export function getNameByLevel(levels: CompetencyLevel[], levelNum: number): string {
  return levels.find(l => l.level === levelNum)?.name || '';
}

/** Get numeric level by competency name */
export function getLevelByName(levels: CompetencyLevel[], name: string): number {
  return levels.find(l => l.name === name)?.level || 1;
}

/** Map rating level (1-5) to competency name */
export function getLevelToCompetencyMap(levels: CompetencyLevel[]): Record<number, string> {
  const active = levels.filter(l => l.status === 'active').sort((a, b) => a.level - b.level);
  const map: Record<number, string> = {};
  for (const l of active) map[l.level] = l.name;
  return map;
}

/** Map rating level (1-5) to competency UUID */
export function getLevelToIdMap(levels: CompetencyLevel[]): Record<number, string> {
  const active = levels.filter(l => l.status === 'active').sort((a, b) => a.level - b.level);
  const map: Record<number, string> = {};
  for (const l of active) map[l.level] = l.id;
  return map;
}

/** Map competency name to numeric level */
export function getCompetencyToLevelMap(levels: CompetencyLevel[]): Record<string, number> {
  const active = levels.filter(l => l.status === 'active').sort((a, b) => a.level - b.level);
  return Object.fromEntries(active.map(l => [l.name, l.level]));
}

/** Map competency UUID to numeric level */
export function getIdToLevelMap(levels: CompetencyLevel[]): Record<string, number> {
  const active = levels.filter(l => l.status === 'active').sort((a, b) => a.level - b.level);
  return Object.fromEntries(active.map(l => [l.id, l.level]));
}

/** Dynamic scoreToLevel using score ranges from competency_levels table */
export function scoreToLevelDynamic(levels: CompetencyLevel[], score: number): number {
  const sorted = levels
    .filter(l => l.status === 'active')
    .sort((a, b) => b.level - a.level); // highest first
  for (const l of sorted) {
    if (score >= l.score_range_min && score <= l.score_range_max) return l.level;
  }
  // Fallback: find nearest
  if (sorted.length > 0) {
    if (score >= sorted[0].score_range_min) return sorted[0].level;
    return sorted[sorted.length - 1].level;
  }
  // Absolute fallback if no levels loaded
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

/** Get rating labels from competency levels (numeric level -> label) */
export function getRatingLabels(levels: CompetencyLevel[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (const l of levels.filter(lv => lv.status === 'active')) {
    map[l.level] = l.label;
  }
  return map;
}

/** Get rating descriptions from competency levels (numeric level -> description) */
export function getRatingDescriptions(levels: CompetencyLevel[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (const l of levels.filter(lv => lv.status === 'active')) {
    map[l.level] = l.description;
  }
  return map;
}

/** Semantic color classes for level badges */
const LEVEL_COLOR_CLASSES: Record<number, string> = {
  1: 'bg-destructive/15 text-destructive',
  2: 'bg-warning/15 text-warning',
  3: 'bg-info/15 text-info',
  4: 'bg-primary/15 text-primary',
  5: 'bg-success/15 text-success',
};

/** Get CSS class for a level number badge */
export function getLevelColorClass(level: number): string {
  return LEVEL_COLOR_CLASSES[level] ?? 'bg-muted text-muted-foreground';
}

/** Get formatted level label like "L1 – Basic Awareness" */
export function getFormattedLevelLabel(levels: CompetencyLevel[], levelNum: number): string {
  const l = levels.find(lv => lv.level === levelNum);
  return l ? `L${l.level} – ${l.label}` : `L${levelNum}`;
}

/** Get short formatted level label like "L1 – Basic" */
export function getShortLevelLabel(levels: CompetencyLevel[], levelNum: number): string {
  const l = levels.find(lv => lv.level === levelNum);
  if (!l) return `L${levelNum}`;
  const shortLabel = l.label.split(' ')[0]; // First word
  return `L${l.level} – ${shortLabel}`;
}
