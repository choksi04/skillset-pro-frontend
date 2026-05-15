import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Mail, Briefcase, Building2, Moon, Sun, Network, ShieldCheck } from 'lucide-react';

interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleConfig: Record<string, { label: string; className: string }> = {
  admin: { label: 'Administrator', className: 'bg-primary/15 text-primary border-primary/30' },
  manager: { label: 'Manager', className: 'bg-info/15 text-info border-info/30' },
  employee: { label: 'Employee', className: 'bg-muted text-foreground border-border' },
};

export default function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [homeDomain, setHomeDomain] = useState<string | null>(null);
  const [ledDomains, setLedDomains] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [home, led] = await Promise.all([
        user.domain_id
          ? supabase.from('domains').select('name').eq('id', user.domain_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from('domains').select('id, name').eq('domain_lead_id', user.id).is('deleted_on', null),
      ]);
      if (cancelled) return;
      setHomeDomain(home.data?.name ?? null);
      setLedDomains((led.data ?? []) as { id: string; name: string }[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  if (!user) return null;

  const initials =
    user.full_name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?';

  const role = roleConfig[user.role] ?? roleConfig.employee;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="text-base font-semibold">Profile</SheetTitle>
          <SheetDescription className="text-xs">Your account details and preferences.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Identity */}
          <div className="px-6 py-5 flex items-center gap-4 border-b border-border">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{user.full_name}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Mail size={12} />
                <span className="truncate">{user.email}</span>
              </div>
              <Badge variant="outline" className={`mt-2 text-[10px] font-medium ${role.className}`}>
                <ShieldCheck size={10} className="mr-1" />
                {role.label}
              </Badge>
            </div>
          </div>

          {/* Details */}
          <div className="px-6 py-5 space-y-4 border-b border-border">
            {user.designation && (
              <div className="flex items-start gap-3">
                <Briefcase size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Designation</p>
                  <p className="text-sm text-foreground mt-0.5">{user.designation}</p>
                </div>
              </div>
            )}
            {user.department && (
              <div className="flex items-start gap-3">
                <Building2 size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Department</p>
                  <p className="text-sm text-foreground mt-0.5">{user.department}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Network size={14} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Domain</p>
                {loading ? (
                  <Skeleton className="h-4 w-32 mt-1" />
                ) : (
                  <p className="text-sm text-foreground mt-0.5">{homeDomain ?? <span className="text-muted-foreground">Not assigned</span>}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Crown size={14} className="text-warning mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Domain Lead Of</p>
                {loading ? (
                  <Skeleton className="h-4 w-40 mt-1" />
                ) : ledDomains.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-0.5">Not a domain lead</p>
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

          {/* Preferences */}
          <div className="px-6 py-5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-3">Preferences</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {theme === 'dark' ? <Moon size={14} className="text-muted-foreground" /> : <Sun size={14} className="text-muted-foreground" />}
                <span className="text-sm text-foreground">Appearance</span>
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={toggleTheme}>
                {theme === 'dark' ? <><Sun size={13} /> Light mode</> : <><Moon size={13} /> Dark mode</>}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
