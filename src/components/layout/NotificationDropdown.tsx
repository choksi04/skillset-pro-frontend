import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  Rocket,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AppNotification {
  id: string;
  tenant_id: string;
  target_role: string;
  target_user_id: string | null;
  message: string;
  type: string;
  reference_id: string;
  action_link: string | null;
  read: boolean;
  created_at: string;
}

type TypeMeta = {
  label: string;
  Icon: LucideIcon;
  badgeClass: string;
};

const TYPE_META: Record<string, TypeMeta> = {
  assessment_assigned: {
    label: 'Assessment',
    Icon: ClipboardCheck,
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  assessment_reminder: {
    label: 'Reminder',
    Icon: BellRing,
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  assessment_completed: {
    label: 'Assessment',
    Icon: CheckCircle2,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  review_completed: {
    label: 'Review',
    Icon: UserCheck,
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  registry_submitted: {
    label: 'Registry',
    Icon: FileCheck,
    badgeClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  },
  cycle_activated: {
    label: 'Cycle',
    Icon: Rocket,
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
  },
};

const DEFAULT_META: TypeMeta = {
  label: 'Update',
  Icon: Bell,
  badgeClass: 'bg-muted text-muted-foreground border-border',
};

function getTypeMeta(type: string): TypeMeta {
  return TYPE_META[type] ?? DEFAULT_META;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

type Bucket = 'Today' | 'Yesterday' | 'This Week' | 'Earlier';

function bucketOf(iso: string): Bucket {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - 6 * 86400000;
  const t = d.getTime();
  if (t >= startOfToday) return 'Today';
  if (t >= startOfYesterday) return 'Yesterday';
  if (t >= startOfWeek) return 'This Week';
  return 'Earlier';
}

const BUCKET_ORDER: Bucket[] = ['Today', 'Yesterday', 'This Week', 'Earlier'];

export default function NotificationDropdown() {
  const { currentRole, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, tenant_id, target_role, target_user_id, message, type, reference_id, action_link, read, created_at')
        .or(`target_user_id.eq.${user.id},and(target_user_id.is.null,target_role.eq.${currentRole})`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) {
        setNotifications(data as AppNotification[]);
      }
    };
    load();
  }, [user?.id, currentRole]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const myNotifications = useMemo(
    () =>
      notifications
        .filter((n) => {
          if (n.target_user_id && n.target_user_id === user?.id) return true;
          if (!n.target_user_id && n.target_role === currentRole) return true;
          return false;
        })
        .slice(0, 20),
    [notifications, user?.id, currentRole],
  );

  const unread = myNotifications.filter((n) => !n.read).length;

  const grouped = useMemo(() => {
    const map = new Map<Bucket, AppNotification[]>();
    for (const n of myNotifications) {
      const b = bucketOf(n.created_at);
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(n);
    }
    return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({ bucket: b, items: map.get(b)! }));
  }, [myNotifications]);

  const handleClick = async (notif: AppNotification) => {
    if (!notif.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    }
    if (notif.action_link) {
      navigate(notif.action_link);
      setOpen(false);
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const unreadIds = myNotifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    setNotifications((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read: true } : n)),
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-96 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-popover-foreground">Notifications</span>
              {unread > 0 && (
                <span className="text-[10px] text-muted-foreground">{unread} unread</span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <CheckCheck size={12} />
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {grouped.length === 0 ? (
              <p className="text-xs text-muted-foreground p-6 text-center">No notifications yet.</p>
            ) : (
              grouped.map(({ bucket, items }) => (
                <div key={bucket}>
                  <div className="sticky top-0 px-3 py-1.5 bg-muted/40 backdrop-blur-sm border-b border-border">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {bucket}
                    </span>
                  </div>
                  {items.map((n) => {
                    const meta = getTypeMeta(n.type);
                    const { Icon } = meta;
                    return (
                      <div
                        key={n.id}
                        className={`px-3 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 transition-colors flex gap-2.5 ${
                          !n.read ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => handleClick(n)}
                      >
                        <div className="flex items-start pt-0.5">
                          {!n.read ? (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          ) : (
                            <span className="h-2 w-2 shrink-0" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${meta.badgeClass}`}
                            >
                              <Icon size={10} />
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-xs text-popover-foreground leading-relaxed break-words">
                            {n.message}
                          </p>
                          <p
                            className="text-[10px] text-muted-foreground mt-0.5"
                            title={new Date(n.created_at).toLocaleString()}
                          >
                            {formatRelative(n.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
