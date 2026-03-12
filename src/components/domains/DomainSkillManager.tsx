import { useMemo, useState } from 'react';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Search, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';

interface DomainSkillManagerProps {
  domainId: string;
  onClose: () => void;
}

export default function DomainSkillManager({ domainId, onClose }: DomainSkillManagerProps) {
  const { mappings, addMapping, removeMapping } = useDomainStore();
  const { skills, categories } = useSkillStore();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const activeSkills = useMemo(() => skills.filter((s) => s.status === 'active'), [skills]);
  const currentMappings = useMemo(() => mappings.filter((m) => m.domain_id === domainId), [mappings, domainId]);
  const mappedSkillIds = useMemo(() => new Set(currentMappings.map((m) => m.skill_id)), [currentMappings]);

  // Group skills by category
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
    const mapped = catSkills.filter((s) => mappedSkillIds.has(s.id)).length;
    if (mapped === 0) return 'none';
    if (mapped === catSkills.length) return 'all';
    return 'partial';
  };

  const handleToggleCategory = (catName: string) => {
    const catSkills = activeSkills.filter((s) => s.skill_category === catName);
    const allMapped = catSkills.every((s) => mappedSkillIds.has(s.id));

    if (allMapped) {
      catSkills.forEach((s) => {
        const m = currentMappings.find((mp) => mp.skill_id === s.id);
        if (m) removeMapping(m.id);
      });
    } else {
      catSkills.forEach((s) => {
        if (!mappedSkillIds.has(s.id)) {
          addMapping({ domain_id: domainId, skill_id: s.id, tenant_id: user?.tenant_id ?? 'tenant-001', skill_weight: 1 });
        }
      });
    }
  };

  const handleToggleSkill = (skillId: string) => {
    if (mappedSkillIds.has(skillId)) {
      const m = currentMappings.find((mp) => mp.skill_id === skillId);
      if (m) removeMapping(m.id);
    } else {
      addMapping({ domain_id: domainId, skill_id: skillId, tenant_id: user?.tenant_id ?? 'tenant-001', skill_weight: 1 });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Skills</DialogTitle>
          <DialogDescription>Select categories to map all skills, or expand to pick individual skills.</DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search categories or skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            maxLength={100}
          />
        </div>

        {/* Summary */}
        <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground">
          <span>{currentMappings.length} skill{currentMappings.length !== 1 ? 's' : ''} mapped</span>
          <Separator orientation="vertical" className="h-3" />
          <span>{grouped.size} {grouped.size === 1 ? 'category' : 'categories'} shown</span>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
          {grouped.size === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No skills found.</p>
          ) : (
            Array.from(grouped.entries()).map(([catName, catSkills]) => {
              const catState = getCategoryState(catName);
              const isExpanded = expandedCats.has(catName);
              const mappedCount = catSkills.filter((s) => mappedSkillIds.has(s.id)).length;

              return (
                <div key={catName} className="border border-border rounded-lg overflow-hidden">
                  {/* Category row */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={catState === 'all'}
                      data-state={catState === 'partial' ? 'indeterminate' : catState === 'all' ? 'checked' : 'unchecked'}
                      onCheckedChange={() => handleToggleCategory(catName)}
                      className={catState === 'partial' ? 'opacity-70' : ''}
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

                  {/* Expanded skills */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border">
                          {catSkills.map((skill) => (
                            <tr key={skill.id} className="hover:bg-muted/20 transition-colors">
                              <td className="pl-12 pr-2 py-2.5 w-8">
                                <Checkbox
                                  checked={mappedSkillIds.has(skill.id)}
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
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
