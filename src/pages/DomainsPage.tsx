import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDomainStore, Domain } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import DomainFormDialog from '@/components/domains/DomainFormDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, Network } from 'lucide-react';

export default function DomainsPage() {
  const navigate = useNavigate();
  const { domains, mappings, toggleDomainStatus, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { currentRole } = useAuth();
  const isAdmin = currentRole === 'admin';
  useEffect(() => { fetchDomains(); fetchSkills(); }, [fetchDomains, fetchSkills]);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);

  const filtered = useMemo(() =>
    domains.filter((d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase())
    ), [domains, search]);

  const getSkillCount = (domainId: string) => mappings.filter((m) => m.domain_id === domainId).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Domains', value: domains.length, icon: <Network size={18} /> },
          { label: 'Active', value: domains.filter((d) => d.status === 'active').length, color: 'text-success' },
          { label: 'Total Mappings', value: mappings.length },
          { label: 'Avg Skills/Domain', value: domains.length ? (mappings.length / domains.length).toFixed(1) : '0' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${(s as any).color ?? 'text-card-foreground'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search domains..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" maxLength={100} />
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditDomain(null); setFormOpen(true); }} className="gap-1.5">
            <Plus size={14} /> Add Domain
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead className="w-[120px] text-center">Mapped Skills</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              {isAdmin && <TableHead className="w-[100px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 4 : 3} className="text-center text-sm text-muted-foreground py-10">
                  No domains found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((domain) => {
                const skillCount = getSkillCount(domain.id);
                return (
                  <TableRow
                    key={domain.id}
                    className={`cursor-pointer ${domain.status === 'disabled' ? 'opacity-60' : ''}`}
                    onClick={() => navigate(`/domains/${domain.id}`)}
                  >
                    <TableCell>
                      <p className="font-medium text-foreground">{domain.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" title={domain.description}>
                        {domain.description}
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-medium text-card-foreground">{skillCount}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={domain.status === 'active' ? 'default' : 'outline'}
                        className={`text-xs ${domain.status === 'active' ? 'bg-success/15 text-success border-success/20 hover:bg-success/20' : ''}`}
                      >
                        {domain.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditDomain(domain); setFormOpen(true); }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleDomainStatus(domain.id); }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title={domain.status === 'active' ? 'Disable' : 'Enable'}
                          >
                            {domain.status === 'active' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          </button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DomainFormDialog open={formOpen} onOpenChange={setFormOpen} editDomain={editDomain} />
    </div>
  );
}
