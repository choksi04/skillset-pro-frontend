import { useEffect } from 'react';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { Badge } from '@/components/ui/badge';
import { Link2 } from 'lucide-react';

export default function DomainSkillMappingPage() {
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  useEffect(() => { fetchDomains(); fetchSkills(); }, [fetchDomains, fetchSkills]);

  const activeDomains = domains.filter((d) => d.status === 'active');

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Overview of all skill-to-domain mappings. Manage mappings from the Domains page using the link icon.
      </p>

      {activeDomains.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No active domains.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {activeDomains.map((domain) => {
            const domainMappings = mappings.filter((m) => m.domain_id === domain.id);
            const mappedSkills = domainMappings
              .map((m) => skills.find((s) => s.id === m.skill_id))
              .filter(Boolean);

            return (
              <div key={domain.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Link2 size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold text-card-foreground">{domain.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{domain.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {mappedSkills.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No skills mapped</span>
                  ) : (
                    mappedSkills.map((skill) => (
                      <Badge key={skill!.id} variant="secondary" className="text-xs font-normal">
                        {skill!.skill_name}
                      </Badge>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {mappedSkills.length} skill{mappedSkills.length !== 1 ? 's' : ''} mapped
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
