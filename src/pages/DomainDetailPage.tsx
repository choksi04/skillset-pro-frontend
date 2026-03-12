import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import DomainFormDialog from '@/components/domains/DomainFormDialog';
import DomainSkillManager from '@/components/domains/DomainSkillManager';
import {
  ArrowLeft, Pencil, Users, UserCircle, Calendar, Clock, FolderOpen, Settings2,
} from 'lucide-react';
import { format } from 'date-fns';

export default function DomainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, categories, fetchSkills, loading, initialized } = useSkillStore();
  const { user, currentRole } = useAuth();
  const isAdmin = currentRole === 'admin';

  const [editOpen, setEditOpen] = useState(false);
  const [manageSkillsOpen, setManageSkillsOpen] = useState(false);

  useEffect(() => { fetchDomains(); fetchSkills(); }, [fetchDomains, fetchSkills]);

  const domain = domains.find((d) => d.id === id);
  const currentMappings = useMemo(() => mappings.filter((m) => m.domain_id === id), [mappings, id]);
  const mappedSkillIds = useMemo(() => new Set(currentMappings.map((m) => m.skill_id)), [currentMappings]);

  // Group mapped skills by category
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

  // Not found
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

  // Loading
  if (!domain) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const formatDate = (d: string) => {
    try { return format(new Date(d), 'MMM d, yyyy · h:mm a'); } catch { return d; }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/domains')} className="gap-1.5 -ml-2">
        <ArrowLeft size={14} /> Back to Domains
      </Button>

      {/* ─── Header Card ─── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-card-foreground tracking-tight">{domain.name}</h1>
                <Badge
                  variant={domain.status === 'active' ? 'default' : 'outline'}
                  className={`text-xs capitalize ${domain.status === 'active' ? 'bg-success/15 text-success border-success/20' : 'text-muted-foreground'}`}
                >
                  {domain.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {domain.description || 'No description provided.'}
              </p>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5 shrink-0">
                <Pencil size={14} /> Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Info Cards Row ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Domain Lead */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <UserCircle size={16} className="text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Domain Lead</h3>
          </div>
          <p className="text-sm text-muted-foreground italic">No domain lead assigned</p>
        </div>

        {/* Employees */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employees</h3>
          </div>
          <p className="text-2xl font-bold text-card-foreground">0</p>
          <p className="text-xs text-muted-foreground mt-0.5">assigned to this domain</p>
        </div>

        {/* Skills Count */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={16} className="text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mapped Skills</h3>
          </div>
          <p className="text-2xl font-bold text-card-foreground">{currentMappings.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">across {mappedByCategory.size} {mappedByCategory.size === 1 ? 'category' : 'categories'}</p>
        </div>
      </div>

      {/* ─── Skills Section ─── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Skills</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Skills mapped to this domain, grouped by category</p>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setManageSkillsOpen(true)} className="gap-1.5">
              <Settings2 size={14} /> Manage Skills
            </Button>
          )}
        </div>

        <div className="p-5">
          {currentMappings.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <FolderOpen size={32} className="mx-auto mb-3 text-muted-foreground/40" />
              <p>No skills mapped yet.</p>
              {isAdmin && <p className="mt-1">Click "Manage Skills" to start mapping skills to this domain.</p>}
            </div>
          ) : (
            <div className="space-y-5">
              {Array.from(mappedByCategory.entries()).map(([catName, catSkills]) => (
                <div key={catName}>
                  <div className="flex items-center gap-2 mb-3">
                    <FolderOpen size={14} className="text-primary shrink-0" />
                    <h3 className="text-sm font-semibold text-card-foreground">{catName}</h3>
                    <Badge variant="secondary" className="text-xs">{catSkills.length}</Badge>
                  </div>
                  <div className="ml-6 border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Skill Name</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Description</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-[80px]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {catSkills.map((skill) => (
                          <tr key={skill.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{skill.skill_name}</td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs line-clamp-1" title={skill.skill_description}>{skill.skill_description || '—'}</td>
                            <td className="px-4 py-2.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${skill.status === 'active' ? 'text-success border-success/30' : 'text-muted-foreground'}`}
                              >
                                {skill.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Metadata Section ─── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metadata</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Created</p>
            <p className="text-foreground font-medium flex items-center gap-1.5">
              <Clock size={12} className="text-muted-foreground" />
              {formatDate(domain.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Last Updated</p>
            <p className="text-foreground font-medium flex items-center gap-1.5">
              <Clock size={12} className="text-muted-foreground" />
              {formatDate(domain.updated_at)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Domain ID</p>
            <p className="text-foreground font-mono text-xs break-all">{domain.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Tenant</p>
            <p className="text-foreground font-mono text-xs">{domain.tenant_id}</p>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <DomainFormDialog open={editOpen} onOpenChange={setEditOpen} editDomain={domain} />

      {manageSkillsOpen && id && (
        <DomainSkillManager
          domainId={id}
          onClose={() => setManageSkillsOpen(false)}
        />
      )}
    </div>
  );
}
