import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSkillRegistryStore } from '@/stores/skillRegistryStore';
import { useCompetencyLevelStore, getRatingLabels } from '@/stores/competencyLevelStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { supabase } from '@/integrations/supabase/client';
import { RatingLevel } from '@/stores/registryStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowLeft, FolderOpen, Search } from 'lucide-react';

export default function TeamRegistryDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();

  const { registries, fetchRegistries, fetchItems } = useSkillRegistryStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();

  useEffect(() => {
    fetchRegistries();
    fetchDomains();
    fetchSkills();
  }, []);

  const registry = useMemo(() => registries.find((r) => r.id === submissionId), [registries, submissionId]);

  const [employeeName, setEmployeeName] = useState('');
  const [ratings, setRatings] = useState<Record<string, RatingLevel>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!registry) return;
    supabase.from('users').select('id, full_name').eq('id', registry.employee_id).single().then(({ data }) => {
      if (data) setEmployeeName((data as any).full_name);
    });
  }, [registry?.employee_id]);

  useEffect(() => {
    if (!submissionId) return;
    fetchItems(submissionId).then((items) => {
      const rMap: Record<string, RatingLevel> = {};
      const cMap: Record<string, string> = {};
      items.forEach((i) => {
        rMap[i.skill_id] = i.self_score as RatingLevel;
        if (i.comment) cMap[i.skill_id] = i.comment;
      });
      setRatings(rMap);
      setComments(cMap);
    });
  }, [submissionId]);

  const domain = useMemo(() => registry ? domains.find((d) => d.id === registry.domain_id) : null, [registry, domains]);

  const domainSkillIds = useMemo(() => {
    if (!domain) return [];
    return mappings.filter((m) => m.domain_id === domain.id).map((m) => m.skill_id);
  }, [domain, mappings]);

  const domainSkills = useMemo(
    () => skills.filter((s) => domainSkillIds.includes(s.id) && s.status === 'active'),
    [skills, domainSkillIds]
  );

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return domainSkills;
    const q = search.toLowerCase();
    return domainSkills.filter((s) =>
      s.skill_name.toLowerCase().includes(q) || (s.skill_category || '').toLowerCase().includes(q)
    );
  }, [domainSkills, search]);

  const groupedSkills = useMemo(() => {
    const map = new Map<string, typeof domainSkills>();
    filteredSkills.forEach((s) => {
      const cat = s.skill_category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [filteredSkills]);

  if (!registry) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/team-registry')} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Back to Team Registry
        </Button>
        <div className="text-center py-16 text-sm text-muted-foreground">Registry not found.</div>
      </div>
    );
  }

  const pageDescription = [
    domain?.name ?? 'Unknown domain',
    `v${registry.version_number}`,
    registry.submitted_at ? `Submitted ${new Date(registry.submitted_at).toLocaleDateString()}` : `Created ${new Date(registry.created_at).toLocaleDateString()}`,
  ].join(' · ');

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" onClick={() => navigate('/team-registry')} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft size={14} /> Back to Team Registry
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-foreground">{employeeName || registry.employee_id}</h2>
          <Badge className={`text-xs ${registry.status === 'draft' ? 'bg-warning/15 text-warning border-warning/20' : 'bg-success/15 text-success border-success/20'}`}>
            {registry.status === 'draft' ? 'Draft' : 'Submitted'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{pageDescription}</p>
      </div>

      {/* Search */}
      {domainSkills.length > 4 && (
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search skills..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
      )}

      {/* Skill breakdown */}
      <Accordion type="multiple" defaultValue={Array.from(groupedSkills.keys())} className="space-y-3">
        {Array.from(groupedSkills.entries()).map(([catName, catSkills]) => (
          <AccordionItem key={catName} value={catName} className="rounded-xl border border-border bg-card overflow-hidden">
            <AccordionTrigger className="px-5 py-3 hover:no-underline">
              <div className="flex items-center gap-3 text-left flex-1">
                <FolderOpen size={16} className="text-primary shrink-0" />
                <span className="font-semibold text-card-foreground">{catName}</span>
                <span className="text-xs text-muted-foreground">({catSkills.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
              <div className="divide-y divide-border">
                {catSkills.map((skill) => (
                  <div key={skill.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{skill.skill_name}</p>
                      {comments[skill.id] && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">"{comments[skill.id]}"</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {ratings[skill.id] != null ? `L${ratings[skill.id]} — ${getRatingLabels(useCompetencyLevelStore.getState().levels)[ratings[skill.id]] ?? `Level ${ratings[skill.id]}`}` : '—'}
                    </Badge>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
