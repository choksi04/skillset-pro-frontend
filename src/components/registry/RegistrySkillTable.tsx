import { useState, useMemo } from 'react';
import { Skill } from '@/stores/skillStore';
import { RatingLevel } from '@/stores/registryStore';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { FolderOpen, Search } from 'lucide-react';

interface RegistrySkillTableProps {
  skills: Skill[];
  ratedSkillIds: string[];
  ratingMap: Record<string, RatingLevel>;
  assessmentScoreMap: Record<string, number>;
  finalScoreMap: Record<string, number>;
}

export function RegistrySkillTable({
  skills, ratedSkillIds, ratingMap, assessmentScoreMap, finalScoreMap,
}: RegistrySkillTableProps) {
  const [search, setSearch] = useState('');

  const ratedSkills = useMemo(
    () => skills.filter((s) => ratedSkillIds.includes(s.id)),
    [skills, ratedSkillIds]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return ratedSkills;
    const q = search.toLowerCase();
    return ratedSkills.filter((s) =>
      s.skill_name.toLowerCase().includes(q) || (s.skill_category || '').toLowerCase().includes(q)
    );
  }, [ratedSkills, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Skill[]>();
    filtered.forEach((s) => {
      const cat = s.skill_category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {ratedSkills.length > 4 && (
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search skills..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
      )}

      <Accordion type="multiple" defaultValue={[]} className="space-y-3">
        {Array.from(grouped.entries()).map(([catName, catSkills]) => (
          <AccordionItem key={catName} value={catName} className="rounded-xl border border-border bg-card overflow-hidden">
            <AccordionTrigger className="px-5 py-3 hover:no-underline">
              <div className="flex items-center gap-3 text-left flex-1">
                <FolderOpen size={16} className="text-primary shrink-0" />
                <span className="font-semibold text-card-foreground">{catName}</span>
                <span className="text-xs text-muted-foreground">({catSkills.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground">Skill</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Self</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Assessment</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Final</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {catSkills.map((skill) => {
                      const selfR = ratingMap[skill.id] ?? null;
                      const assessR = assessmentScoreMap[skill.id] ?? null;
                      const finalR = finalScoreMap[skill.id] ?? null;
                      const gap = selfR !== null && finalR !== null ? finalR - selfR : null;
                      return (
                        <tr key={skill.id} className="hover:bg-muted/20">
                          <td className="px-5 py-3 font-medium text-foreground">{skill.skill_name}</td>
                          <td className="text-center px-3 py-3">{selfR !== null ? <Badge variant="secondary" className="text-xs">L{selfR}</Badge> : '—'}</td>
                          <td className="text-center px-3 py-3">{assessR !== null ? <Badge variant="outline" className="text-xs">L{assessR}</Badge> : '—'}</td>
                          <td className="text-center px-3 py-3">{finalR !== null ? <Badge className="text-xs bg-primary/10 text-primary border-primary/20">L{finalR}</Badge> : '—'}</td>
                          <td className="text-center px-3 py-3">
                            {gap !== null ? (
                              <span className={`text-xs font-semibold ${gap > 0 ? 'text-success' : gap < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {gap > 0 ? `+${gap}` : gap}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
