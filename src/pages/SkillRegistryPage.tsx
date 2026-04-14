import { useState, useMemo, useEffect } from 'react';
import { useSkillRegistryStore, SkillRegistry } from '@/stores/skillRegistryStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle, FileText, Plus, Edit, Eye, Play,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function computeAvg(items: { self_score: number }[]): number | null {
  if (!items || items.length === 0) return null;
  const sum = items.reduce((acc, i) => acc + i.self_score, 0);
  return Math.round((sum / items.length) * 10) / 10;
}

export default function SkillRegistryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { registries, items, fetchRegistries, fetchItemsForRegistries, createNewVersion, getDraft, getLatest, loading } = useSkillRegistryStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  useEffect(() => {
    fetchRegistries(employeeId);
    fetchDomains();
    fetchSkills();
  }, []);

  const assignedDomain = useMemo(() => {
    if (user?.domain_id) return domains.find((d) => d.id === user.domain_id) ?? null;
    return null;
  }, [user, domains]);

  const domainSkills = useMemo(() => {
    if (!assignedDomain) return [];
    const skillIds = mappings.filter((m) => m.domain_id === assignedDomain.id).map((m) => m.skill_id);
    return skills.filter((s) => skillIds.includes(s.id) && s.status === 'active');
  }, [assignedDomain, mappings, skills]);

  const myRegistries = useMemo(
    () => registries.filter((r) => r.employee_id === employeeId),
    [registries, employeeId]
  );

  // Batch fetch items for all displayed registries
  useEffect(() => {
    if (myRegistries.length > 0) {
      fetchItemsForRegistries(myRegistries.map((r) => r.id));
    }
  }, [myRegistries]);

  const draft = getDraft(employeeId);
  const latest = getLatest(employeeId);

  const handleCreateNewVersion = async () => {
    if (!assignedDomain) return;
    const reg = await createNewVersion(employeeId, tenantId, assignedDomain.id);
    if (reg) navigate(`/skill-registry/${reg.id}`);
  };

  // No domain warning
  if (!assignedDomain) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Your Skillset Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">Update and submit your self-assessed skill ratings anytime.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle size={32} className="text-warning mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Domain Assigned</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You have not been assigned to a domain yet. Please contact your manager or admin.
          </p>
        </div>
      </div>
    );
  }

  // Domain without skills
  if (domainSkills.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Your Skillset Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">Update and submit your self-assessed skill ratings anytime.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle size={32} className="text-warning mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Skills Configured</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            No skills have been configured for your domain ({assignedDomain.name}). Please contact your admin.
          </p>
        </div>
      </div>
    );
  }

  const submittedRegistries = myRegistries.filter((r) => r.status === 'submitted');

  const AvgBadge = ({ registryId }: { registryId: string }) => {
    const regItems = items.get(registryId);
    const avg = computeAvg(regItems ?? []);
    if (avg === null) return null;
    return (
      <Badge variant="outline" className="text-xs font-medium">
        Avg Level: {avg}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Your Skillset Registry</h2>
        <p className="text-sm text-muted-foreground mt-1">Update and submit your self-assessed skill ratings anytime. Each submission creates a new version.</p>
      </div>

      {/* Section 1: Current / Latest Version */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Current Registry</h3>

        {draft ? (
          <Card className="border-primary/20 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => navigate(`/skill-registry/${draft.id}`)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Your Skillset Registry</p>
                    <Badge className="text-[10px] bg-warning/15 text-warning border-warning/20">Draft</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    v{draft.version_number} · {assignedDomain.name} · {formatDateTime(draft.created_at)}
                  </p>
                </div>
                <Button variant="default" size="sm" className="gap-1.5">
                  <Edit size={13} /> Continue Editing
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : latest ? (
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Your Skillset Registry</p>
                    <Badge className="text-[10px] bg-success/15 text-success border-success/20">Submitted</Badge>
                    <AvgBadge registryId={latest.id} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    v{latest.version_number} · {assignedDomain.name} · {latest.submitted_at ? formatDateTime(latest.submitted_at) : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={(e) => { e.stopPropagation(); navigate(`/skill-registry/${latest.id}`); }}>
                    <Eye size={13} /> View
                  </Button>
                  <Button variant="default" size="sm" className="gap-1.5" onClick={handleCreateNewVersion}>
                    <Plus size={13} /> Create New Version
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-2 border-muted-foreground/20">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <FileText size={28} className="text-muted-foreground mb-2" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Start Your First Registry</h3>
              <p className="text-xs text-muted-foreground mb-3">Rate your skills to create your first skill registry version.</p>
              <Button size="sm" className="gap-1.5" onClick={handleCreateNewVersion}>
                <Play size={13} /> Start Self Review
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section 2: Version History */}
      {submittedRegistries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText size={14} className="text-muted-foreground" /> Version History
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-medium">Version</TableHead>
                  <TableHead className="text-xs font-medium">Date</TableHead>
                  <TableHead className="text-xs font-medium">Domain</TableHead>
                  <TableHead className="text-xs font-medium">Avg Level</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                  <TableHead className="text-xs font-medium text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submittedRegistries.map((reg) => {
                  const regItems = items.get(reg.id);
                  const avg = computeAvg(regItems ?? []);
                  return (
                    <TableRow key={reg.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/skill-registry/${reg.id}`)}>
                      <TableCell className="text-sm font-medium">v{reg.version_number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {reg.submitted_at ? formatDateTime(reg.submitted_at) : formatDateTime(reg.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{assignedDomain.name}</TableCell>
                      <TableCell className="text-sm font-medium">{avg !== null ? avg : '—'}</TableCell>
                      <TableCell>
                        <Badge className="text-[10px] bg-success/15 text-success border-success/20">Submitted</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/skill-registry/${reg.id}`); }}>
                          <Eye size={13} /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {myRegistries.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No registry versions yet.</p>
        </div>
      )}
    </div>
  );
}
