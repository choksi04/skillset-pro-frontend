import { useMemo, useState, useEffect, useCallback } from 'react';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Search, FolderOpen, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DomainSkillManagerProps {
  domainId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DomainSkillManager({ domainId, open, onOpenChange }: DomainSkillManagerProps) {
  const { mappings, addMapping, removeMapping } = useDomainStore();
  const { skills, categories } = useSkillStore();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [pendingSkillIds, setPendingSkillIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const activeSkills = useMemo(() => skills.filter((s) => s.status === 'active'), [skills]);
  const currentMappings = useMemo(() => mappings.filter((m) => m.domain_id === domainId), [mappings, domainId]);
  const mappedSkillIds = useMemo(() => new Set(currentMappings.map((m) => m.skill_id)), [currentMappings]);

  // Initialize pending state from current mappings when sheet opens
  useEffect(() => {
    if (open) {
      setPendingSkillIds(new Set(currentMappings.map((m) => m.skill_id)));
    }
  }, [open, currentMappings]);

  const isDirty = useMemo(() => {
    if (pendingSkillIds.size !== mappedSkillIds.size) return true;
    for (const id of pendingSkillIds) {
      if (!mappedSkillIds.has(id)) return true;
    }
    return false;
  }, [pendingSkillIds, mappedSkillIds]);

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? activeSkills.filter((s) => s.skill_name.toLowerCase().includes(q) || s.skill_category.toLowerCase().includes(q))
      : activeSkills;

    const map = new Map<string, typeof activeSkills>();
    filtered.forEach((s) => {
      const cat = s.skill_category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [activeSkills, search]);

  const toggleExpand = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const getCategoryState = (catName: string): 'none' | 'partial' | 'all' => {
    const catSkills = activeSkills.filter((s) => s.skill_category === catName);
    if (catSkills.length === 0) return 'none';
    const mapped = catSkills.filter((s) => pendingSkillIds.has(s.id)).length;
    if (mapped === 0) return 'none';
    if (mapped === catSkills.length) return 'all';
    return 'partial';
  };

  const handleToggleCategory = (catName: string) => {
    const catSkills = activeSkills.filter((s) => s.skill_category === catName);
    const allMapped = catSkills.every((s) => pendingSkillIds.has(s.id));

    setPendingSkillIds((prev) => {
      const next = new Set(prev);
      if (allMapped) {
        catSkills.forEach((s) => next.delete(s.id));
      } else {
        catSkills.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const handleToggleSkill = (skillId: string) => {
    setPendingSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Find removed: in mappedSkillIds but not in pendingSkillIds
      for (const m of currentMappings) {
        if (!pendingSkillIds.has(m.skill_id)) {
          await removeMapping(m.id);
        }
      }
      // Find added: in pendingSkillIds but not in mappedSkillIds
      for (const skillId of pendingSkillIds) {
        if (!mappedSkillIds.has(skillId)) {
          await addMapping({ domain_id: domainId, skill_id: skillId, tenant_id: user?.tenant_id ?? 'tenant-001', skill_weight: 1 });
        }
      }
      toast.success('Skill mappings saved successfully.');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to save skill mappings.');
    } finally {
      setSaving(false);
    }
  };

  const changeCount = useMemo(() => {
    let added = 0, removed = 0;
    for (const id of pendingSkillIds) {
      if (!mappedSkillIds.has(id)) added++;
    }
    for (const id of mappedSkillIds) {
      if (!pendingSkillIds.has(id)) removed++;
    }
    return { added, removed };
  }, [pendingSkillIds, mappedSkillIds]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v && !saving) onOpenChange(false); }}>
      <SheetContent side="right" className="sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Manage Skills</SheetTitle>
          <SheetDescription>Select categories to map all skills, or expand to pick individual skills.</SheetDescription>
        </SheetHeader>

        <div className="relative mt-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search categories or skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            maxLength={100}
          />
        </div>

        <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground">
          <span>{pendingSkillIds.size} skill{pendingSkillIds.size !== 1 ? 's' : ''} selected</span>
          <Separator orientation="vertical" className="h-3" />
          <span>{grouped.size} {grouped.size === 1 ? 'category' : 'categories'} shown</span>
          {isDirty && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="text-primary font-medium">
                {changeCount.added > 0 && `+${changeCount.added}`}
                {changeCount.added > 0 && changeCount.removed > 0 && ', '}
                {changeCount.removed > 0 && `-${changeCount.removed}`}
                {' '}change{(changeCount.added + changeCount.removed) !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
          {grouped.size === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No skills found.</p>
          ) : (
            Array.from(grouped.entries()).map(([catName, catSkills]) => {
              const catState = getCategoryState(catName);
              const isExpanded = expandedCats.has(catName);
              const mappedCount = catSkills.filter((s) => pendingSkillIds.has(s.id)).length;

              return (
                <div key={catName} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={catState === 'all' ? true : catState === 'partial' ? 'indeterminate' : false}
                      onCheckedChange={() => handleToggleCategory(catName)}
                    />
                    <button
                      onClick={() => toggleExpand(catName)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      {isExpanded ? <ChevronDown size={14} className="text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                      <FolderOpen size={14} className="text-primary shrink-0" />
                      <span className="text-sm font-medium text-card-foreground truncate">{catName}</span>
                    </button>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {mappedCount}/{catSkills.length}
                    </Badge>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border">
                          {catSkills.map((skill) => (
                            <tr key={skill.id} className="hover:bg-muted/20 transition-colors">
                              <td className="pl-12 pr-2 py-2.5 w-8">
                                <Checkbox
                                  checked={pendingSkillIds.has(skill.id)}
                                  onCheckedChange={() => handleToggleSkill(skill.id)}
                                />
                              </td>
                              <td className="px-2 py-2.5 font-medium text-foreground whitespace-nowrap">{skill.skill_name}</td>
                              <td className="px-2 py-2.5 text-xs text-muted-foreground truncate max-w-[200px]" title={skill.skill_description}>
                                {skill.skill_description || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <Separator />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isDirty || saving}>
            {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
