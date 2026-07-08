import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useDomainStore } from '@/stores/domainStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Mail, Briefcase, Building2, Moon, Sun, Network, ShieldCheck, LogOut } from 'lucide-react';

interface ProfilePopoverProps {
  children: ReactNode;
}

const roleConfig: Record<string, { label: string; className: string }> = {
  admin: { label: 'Administrator', className: 'bg-primary/15 text-primary border-primary/30' },
  manager: { label: 'Manager', className: 'bg-info/15 text-info border-info/30' },
  employee: { label: 'Employee', className: 'bg-muted text-foreground border-border' },
};

export default function ProfilePopover({ children }: ProfilePopoverProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { domains, fetchDomains } = useDomainStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      await fetchDomains();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, user, fetchDomains]);

  if (!user) return <>{children}</>;

  const initials =
    user.full_name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?';

  const role = roleConfig[user.role] ?? roleConfig.employee;
  const homeDomain = user.domain_id ? domains.find((d) => d.id === user.domain_id)?.name ?? null : null;
  const ledDomains = domains.filter((d) => d.domain_lead_id === user.id).map((d) => ({ id: d.id, name: d.name }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden"
      >
        {/* Identity */}
        <div className="px-4 py-4 flex items-center gap-3 border-b border-border">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{user.full_name}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Mail size={11} />
              <span className="truncate">{user.email}</span>
            </div>
            <Badge variant="outline" className={`mt-1.5 text-[10px] font-medium ${role.className}`}>
              <ShieldCheck size={10} className="mr-1" />
              {role.label}
            </Badge>
          </div>
        </div>

        {/* Details */}
        <div className="px-4 py-3 space-y-3 border-b border-border">
          {user.designation && (
            <div className="flex items-start gap-2.5">
              <Briefcase size={13} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Designation</p>
                <p className="text-sm text-foreground mt-0.5">{user.designation}</p>
              </div>
            </div>
          )}
          {user.department && (
            <div className="flex items-start gap-2.5">
              <Building2 size={13} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Department</p>
                <p className="text-sm text-foreground mt-0.5">{user.department}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2.5">
            <Network size={13} className="text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Domain</p>
              {loading ? (
                <Skeleton className="h-4 w-32 mt-1" />
              ) : (
                <p className="text-sm text-foreground mt-0.5">
                  {homeDomain ?? <span className="italic text-muted-foreground">Not assigned</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Crown size={13} className="text-warning mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Your Domain Lead</p>
              {loading ? (
                <Skeleton className="h-4 w-40 mt-1" />
              ) : ledDomains.length === 0 ? (
                <p className="text-sm italic text-muted-foreground mt-0.5">No domain lead assigned</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {ledDomains.map((d) => (
                    <Badge key={d.id} variant="outline" className="text-xs font-normal">
                      {d.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {theme === 'dark' ? <Moon size={13} className="text-muted-foreground" /> : <Sun size={13} className="text-muted-foreground" />}
            <span className="text-sm text-foreground">Appearance</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={toggleTheme}>
            {theme === 'dark' ? <><Sun size={12} /> Light</> : <><Moon size={12} /> Dark</>}
          </Button>
        </div>

        {/* Sign out */}
        <div className="px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-2"
            onClick={() => { setOpen(false); logout(); }}
          >
            <LogOut size={13} />
            Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
