import { useState, useMemo, useEffect } from "react";
import { useDomainStore, Domain } from "@/stores/domainStore";
import { useSkillStore } from "@/stores/skillStore";
import { useAuth } from "@/contexts/AuthContext";
import DomainFormDialog from "@/components/domains/DomainFormDialog";
import DomainSkillMapDialog from "@/components/domains/DomainSkillMapDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, Link2, Network } from "lucide-react";

export default function DomainsPage() {
  const { domains, mappings, toggleDomainStatus, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { currentRole } = useAuth();
  const isAdmin = currentRole === "admin" || currentRole === "hr";
  useEffect(() => {
    fetchDomains();
    fetchSkills();
  }, [fetchDomains, fetchSkills]);

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);
  const [mapDomain, setMapDomain] = useState<Domain | null>(null);

  const filtered = useMemo(
    () =>
      domains.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.description.toLowerCase().includes(search.toLowerCase()),
      ),
    [domains, search],
  );

  const getSkillCount = (domainId: string) => mappings.filter((m) => m.domain_id === domainId).length;

  const getSkillNames = (domainId: string) => {
    const ids = mappings.filter((m) => m.domain_id === domainId).map((m) => m.skill_id);
    return skills.filter((s) => ids.includes(s.id)).map((s) => s.skill_name);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Domains", value: domains.length, icon: <Network size={18} /> },
          { label: "Active", value: domains.filter((d) => d.status === "active").length, color: "text-success" },
          { label: "Total Mappings", value: mappings.length },
          { label: "Avg Skills/Domain", value: domains.length ? (mappings.length / domains.length).toFixed(1) : "0" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${(s as any).color ?? "text-card-foreground"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            maxLength={100}
          />
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => {
              setEditDomain(null);
              setFormOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus size={14} /> Add Domain
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Domain</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[250px]">Skills</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              {isAdmin && <TableHead className="w-[120px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-sm text-muted-foreground py-10">
                  No domains found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((domain) => {
                const skillNames = getSkillNames(domain.id);
                return (
                  <TableRow key={domain.id} className={domain.status === "disabled" ? "opacity-60" : ""}>
                    <TableCell className="font-medium text-foreground">{domain.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                      {domain.description}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {skillNames.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">None</span>
                        ) : (
                          skillNames.slice(0, 4).map((name) => (
                            <Badge key={name} variant="secondary" className="text-xs font-normal">
                              {name}
                            </Badge>
                          ))
                        )}
                        {skillNames.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{skillNames.length - 4}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={domain.status === "active" ? "default" : "outline"}
                        className={`text-xs ${domain.status === "active" ? "bg-success/15 text-success border-success/20 hover:bg-success/20" : ""}`}
                      >
                        {domain.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setMapDomain(domain)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Manage skills"
                          >
                            <Link2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setEditDomain(domain);
                              setFormOpen(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => toggleDomainStatus(domain.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title={domain.status === "active" ? "Disable" : "Enable"}
                          >
                            {domain.status === "active" ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
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
      {mapDomain && (
        <DomainSkillMapDialog
          open={!!mapDomain}
          onOpenChange={(v) => {
            if (!v) setMapDomain(null);
          }}
          domainId={mapDomain.id}
          domainName={mapDomain.name}
        />
      )}
    </div>
  );
}
