import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bell } from 'lucide-react';
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

export default function NotificationDropdown() {
  const { currentRole, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch notifications from DB on mount and when user changes
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        setNotifications(data as AppNotification[]);
      }
      setLoaded(true);
    };
    load();
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const myNotifications = notifications.filter((n) => {
    if (n.target_user_id && n.target_user_id === user?.id) return true;
    if (!n.target_user_id && n.target_role === currentRole) return true;
    return false;
  }).slice(0, 20);

  const unread = myNotifications.filter((n) => !n.read).length;

  const handleClick = async (notif: AppNotification) => {
    if (!notif.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
    }
    if (notif.action_link) {
      navigate(notif.action_link);
      setOpen(false);
    }
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
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-popover-foreground">Notifications</span>
            {unread > 0 && <span className="text-[10px] text-muted-foreground">{unread} unread</span>}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {myNotifications.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">No notifications yet.</p>
            ) : (
              myNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-3 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                  onClick={() => handleClick(n)}
                >
                  <p className="text-xs text-popover-foreground leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
