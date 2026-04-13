import { useState, useMemo, useEffect } from 'react';
import { useSkillRegistryStore } from '@/stores/skillRegistryStore';
import { useDomainStore } from '@/stores/domainStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Users, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TeamRegistryPage() {
  const { user, currentRole } = useAuth();
  const navigate = useNavigate();
  const { registries, fetchRegistries } = useSkillRegistryStore();
  const { domains, fetchDomains } = useDomainStore();
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRegistries();
    fetchDomains();
  }, []);

  const teamRegistries = useMemo(() => {
    if (currentRole === 'admin') return registries;
    const managerDomainId = user?.domain_id;
    if (!managerDomainId) return [];
    return registries.filter((r) => r.domain_id === managerDomainId);
  }, [registries, currentRole, user]);

  // Fetch employee names
  useEffect(() => {
    const employeeIds = [...new Set(teamRegistries.map((r) => r.employee_id))];
    if (employeeIds.length === 0) return;
    supabase.from('users').select('id, full_name').in('id', employeeIds).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((u: any) => { map[u.id] = u.full_name; });
        setUserNames(map);
      }
    });
  }, [teamRegistries]);

  // Group by employee, show latest version per employee
  const groupedByEmployee = useMemo(() => {
    const map = new Map<string, typeof teamRegistries>();
    teamRegistries.forEach((r) => {
      if (!map.has(r.employee_id)) map.set(r.employee_id, []);
      map.get(r.employee_id)!.push(r);
    });
    // Sort each employee's registries by version desc
    map.forEach((regs) => regs.sort((a, b) => b.version_number - a.version_number));
    return map;
  }, [teamRegistries]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Team Registry</h2>
        <p className="text-sm text-muted-foreground mt-1">Monitor your team's skill self-assessments and version history.</p>
      </div>

      {groupedByEmployee.size === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Users size={32} className="text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Registries Yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            No team members have submitted their skill registries yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from(groupedByEmployee.entries()).map(([empId, regs]) => {
            const latest = regs[0];
            const domain = domains.find((d) => d.id === latest.domain_id);

            return (
              <Card
                key={empId}
                className="border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/team-registry/${latest.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="rounded-full bg-muted p-2 shrink-0">
                        <User size={16} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {userNames[empId] || empId}
                        </p>
                        <p className="text-xs text-muted-foreground">{domain?.name ?? 'Unknown domain'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">v{latest.version_number}</span>
                      <Badge className={`text-[10px] ${latest.status === 'draft' ? 'bg-warning/15 text-warning border-warning/20' : 'bg-success/15 text-success border-success/20'}`}>
                        {latest.status === 'draft' ? 'Draft' : 'Submitted'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{regs.length} version{regs.length !== 1 ? 's' : ''}</span>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
