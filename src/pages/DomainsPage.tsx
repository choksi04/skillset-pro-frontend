import { eligibleDomainSkillIds } from "@/lib/domainSkillCount";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDomainStore, Domain } from "@/stores/domainStore";
import { useSkillStore } from "@/stores/skillStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DomainFormDialog from "@/components/domains/DomainFormDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import SearchableSelect from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, Network, MoreHorizontal } from "lucide-react";

export default function DomainsPage() {
  const navigate = useNavigate();
  const { domains, mappings, toggleDomainStatus, fetchDomains, loading, initialized } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { currentRole } = useAuth();
  const isAdmin = currentRole === "admin";
  useEffect(() => {
    fetchDomains();
    fetchSkills();
  }, [fetchDomains, fetchSkills]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase
        .from("users")
        .select("domain_id")
        .is("deleted_on", null)
        .not("domain_id", "is", null);
      if (data) {
        const counts: Record<string, number> = {};
        (data as any[]).forEach((u) => {
          if (u.domain_id) counts[u.domain_id] = (counts[u.domain_id] || 0) + 1;
        });
        setUserCounts(counts);
      }
    };
    fetchCounts();
  }, []);

  const filtered = useMemo(
    () =>
      domains.filter((d) => {
        const matchesSearch =
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.description.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || d.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [domains, search, statusFilter],
  );

  const getSkillCount = (domainId: string) => eligibleDomainSkillIds(domainId, mappings, skills).size;

  const handleCreated = (newId: string) => {
    navigate(`/domains/${newId}`);
  };

  const handleCreateDomain = () => {
    setEditDomain(null);
    setFormOpen(true);
  };
  const handleEditDomain = (domain: Domain) => {
    setEditDomain(domain);
    setFormOpen(true);
  };

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "active", label: "Active" },
    { value: "disabled", label: "Disabled" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Domains</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage organizational domains and their skill mappings. Click a domain to view details.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={handleCreateDomain} className="gap-1.5">
            <Plus size={14} /> Add Domain
          </Button>
        )}
      </div>
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            maxLength={100}
          />
        </div>
        <SearchableSelect
          options={statusOptions}
          value={statusFilter}
          onValueChange={setStatusFilter}
          placeholder="Status"
          className="w-[130px] h-9 text-sm"
        />
      </div>

      {/* Domain Table */}
      {loading && !initialized ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Network size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {domains.length === 0
              ? "No domains yet. Create your first domain to get started."
              : "No domains match your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead className="w-[80px] text-center">Users</TableHead>
                <TableHead className="w-[100px] text-center">Skills</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                {isAdmin && <TableHead className="w-[70px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((domain) => {
                const skillCount = getSkillCount(domain.id);
                const uCount = userCounts[domain.id] || 0;
                return (
                  <TableRow
                    key={domain.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${domain.status === "disabled" ? "opacity-60" : ""}`}
                    onClick={() => navigate(`/domains/${domain.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div>
                          <Network size={16} className="text-primary shrink-0" />
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{domain.name}</span>
                          <p className="text-sm text-muted-foreground line-clamp-1">{domain.description || "—"}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs font-normal">
                        {uCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs font-normal">
                        {skillCount}
                      </Badge>
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
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditDomain(domain)}>
                              <Pencil size={14} className="mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleDomainStatus(domain.id)}>
                              {domain.status === "active" ? (
                                <ToggleLeft size={14} className="mr-2" />
                              ) : (
                                <ToggleRight size={14} className="mr-2" />
                              )}
                              {domain.status === "active" ? "Disable" : "Enable"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <DomainFormDialog open={formOpen} onOpenChange={setFormOpen} editDomain={editDomain} onCreated={handleCreated} />
    </div>
  );
}
