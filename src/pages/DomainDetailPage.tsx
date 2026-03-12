import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowLeft, FolderOpen, Search, X, ChevronsDownUp } from 'lucide-react';

export default function DomainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { domains, mappings, addMapping, removeMapping, fetchDomains } = useDomainStore();
  const { skills, categories, fetchSkills, loading, initialized } = useSkillStore();
  const { user, currentRole } = useAuth();
  const isAdmin = currentRole === 'admin' || currentRole === 'hr';

  useEffect(() => { fetchDomains(); fetchSkills(); }, [fetchDomains, fetchSkills]);

  const domain = domains.find((d) => d.id === id);
  const currentMappings = useMemo(() => mappings.filter((m) => m.domain_id === id), [mappings, id]);
  const mappedSkillIds = useMemo(() => new Set(currentMappings.map((m) => m.skill_id)), [currentMappings]);

  const [search, setSearch] = useState('');
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  const activeSkills = useMemo(() => skills.filter((s) => s.status === 'active'), [skills]);
  const activeCategories = useMemo(() => categories.filter((c) => c.status === 'active'), [categories]);

  // Filter skills by search
  const filteredSkills = useMemo(() => {
    if (!search) return activeSkills;
    const q = search.toLowerCase();
    return activeSkills.filter(
      (s) => s.skill_name.toLowerCase().includes(q) || s.skill_description.toLowerCase().includes(q) || s.skill_category.toLowerCase().includes(q)
    );
  }, [activeSkills, search]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, typeof activeSkills>();
    filteredSkills.forEach((s) => {
      const cat = s.skill_category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [filteredSkills]);

  const handleToggleSkill = (skillId: string) => {
    if (!id) return;
    if (mappedSkillIds.has(skillId)) {
      const mapping = currentMappings.find((m) => m.skill_id === skillId);
      if (mapping) removeMapping(mapping.id);
    } else {
      addMapping({
        domain_id: id,
        skill_id: skillId,
        tenant_id: user?.tenant_id ?? 'tenant-001',
        skill_weight: 1,
      });
    }
  };

  const handleToggleCategory = (categoryName: string) => {
    if (!id) return;
    const catSkills = activeSkills.filter((s) => s.skill_category === categoryName);
    const allMapped = catSkills.every((s) => mappedSkillIds.has(s.id));

    if (allMapped) {
      // Remove all skills in this category
      catSkills.forEach((s) => {
        const mapping = currentMappings.find((m) => m.skill_id === s.id);
        if (mapping) removeMapping(mapping.id);
      });
    } else {
      // Add all unmapped skills in this category
      catSkills.forEach((s) => {
        if (!mappedSkillIds.has(s.id)) {
          addMapping({
            domain_id: id,
            skill_id: s.id,
            tenant_id: user?.tenant_id ?? 'tenant-001',
            skill_weight: 1,
          });
        }
      });
    }
  };

  const getCategoryState = (categoryName: string) => {
    const catSkills = activeSkills.filter((s) => s.skill_category === categoryName);
    if (catSkills.length === 0) return 'none';
    const mappedCount = catSkills.filter((s) => mappedSkillIds.has(s.id)).length;
    if (mappedCount === 0) return 'none';
    if (mappedCount === catSkills.length) return 'all';
    return 'partial';
  };

  // Group mapped skills by category for summary
  const mappedByCategory = useMemo(() => {
    const map = new Map<string, typeof skills>();
    currentMappings.forEach((m) => {
      const skill = skills.find((s) => s.id === m.skill_id);
      if (skill) {
        const cat = skill.skill_category || 'Uncategorized';
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(skill);
      }
    });
    return map;
  }, [currentMappings, skills]);

  if (!domain && initialized) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/domains')} className="gap-1.5">
          <ArrowLeft size={14} /> Back to Domains
        </Button>
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Domain not found.
        </div>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/domains')} className="gap-1.5">
          <ArrowLeft size={14} /> Back
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-card-foreground">{domain.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{domain.description}</p>
          </div>
          <Badge
            variant={domain.status === 'active' ? 'default' : 'outline'}
            className={`text-xs ${domain.status === 'active' ? 'bg-success/15 text-success border-success/20' : ''}`}
          >
            {domain.status}
          </Badge>
        </div>
      </div>

      {/* Mapped Skills Summary */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-card-foreground mb-3">
          Mapped Skills ({currentMappings.length})
        </h2>
        {currentMappings.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No skills mapped yet. {isAdmin ? 'Use the section below to add skills by category.' : ''}</p>
        ) : (
          <div className="space-y-3">
            {Array.from(mappedByCategory.entries()).map(([catName, catSkills]) => (
              <div key={catName}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  <FolderOpen size={12} className="inline mr-1.5 text-primary" />
                  {catName}
                </p>
                <div className="flex flex-wrap gap-1.5 ml-5">
                  {catSkills.map((skill) => (
                    <Badge key={skill.id} variant="secondary" className="gap-1 text-xs pr-1">
                      {skill.skill_name}
                      {isAdmin && (
                        <button onClick={() => handleToggleSkill(skill.id)} className="ml-0.5 hover:text-destructive transition-colors">
                          <X size={12} />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skill Selection (Admin only) */}
      {isAdmin && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-card-foreground">Manage Skills</h2>
            <p className="text-xs text-muted-foreground">Select categories or individual skills to map</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search skills..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" maxLength={100} />
            </div>
            {openAccordions.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setOpenAccordions([])} className="gap-1.5 text-xs text-muted-foreground">
                <ChevronsDownUp size={14} /> Collapse All
              </Button>
            )}
          </div>

          {loading && !initialized ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : grouped.size === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No skills found.</p>
          ) : (
            <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="space-y-2">
              {Array.from(grouped.entries()).map(([catName, catSkills]) => {
                const catState = getCategoryState(catName);
                return (
                  <AccordionItem key={catName} value={catName} className="rounded-lg border border-border overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3 text-left flex-1">
                        <Checkbox
                          checked={catState === 'all'}
                          // @ts-ignore - indeterminate is valid
                          data-state={catState === 'partial' ? 'indeterminate' : catState === 'all' ? 'checked' : 'unchecked'}
                          onCheckedChange={() => handleToggleCategory(catName)}
                          onClick={(e) => e.stopPropagation()}
                          className={catState === 'partial' ? 'opacity-70' : ''}
                        />
                        <FolderOpen size={14} className="text-primary shrink-0" />
                        <span className="font-medium text-sm text-card-foreground">{catName}</span>
                        <span className="text-xs text-muted-foreground">
                          ({catSkills.filter((s) => mappedSkillIds.has(s.id)).length}/{catSkills.length} mapped)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-1 ml-7">
                        {catSkills.map((skill) => (
                          <label
                            key={skill.id}
                            className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              checked={mappedSkillIds.has(skill.id)}
                              onCheckedChange={() => handleToggleSkill(skill.id)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">{skill.skill_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{skill.skill_description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      )}
    </div>
  );
}
