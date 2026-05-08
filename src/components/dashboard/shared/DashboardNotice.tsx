import { useEffect, useState } from 'react';
import { Info, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'dashboard-notice-dismissed';

type NoticeProps = {
  icon: React.ReactNode;
  title: string;
  body: string;
  onDismiss: () => void;
};

function NoticeAlert({ icon, title, body, onDismiss }: NoticeProps) {
  return (
    <div className="relative rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 pr-9 dark:border-orange-400/30 dark:bg-orange-400/10">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-orange-600 dark:text-orange-400">{icon}</span>
        <div className="text-sm">
          <span className="font-semibold text-orange-900 dark:text-orange-100">{title}</span>
          <span className="text-orange-900/80 dark:text-orange-100/80"> — {body}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        className="absolute right-1.5 top-1.5 h-6 w-6 text-orange-700/70 hover:bg-orange-500/15 hover:text-orange-900 dark:text-orange-300/70 dark:hover:text-orange-100"
        aria-label="Dismiss notice"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function DashboardNotice() {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      setDismissed(raw ? JSON.parse(raw) : {});
    } catch {
      setDismissed({});
    }
    setHydrated(true);
  }, []);

  const dismiss = (key: string) => {
    setDismissed((prev) => {
      const next = { ...prev, [key]: true };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (!hydrated) return null;

  const showBeta = !dismissed.beta;
  const showExperimental = !dismissed.experimental;
  if (!showBeta && !showExperimental) return null;

  return (
    <div className="mb-4 space-y-2">
      {showBeta && (
        <NoticeAlert
          icon={<Sparkles className="h-4 w-4" />}
          title="SIAP is in Beta"
          body="You're using an early version; your feedback shapes what comes next. Reach out to Team Aekatra with thoughts or issues."
          onDismiss={() => dismiss('beta')}
        />
      )}
      {showExperimental && (
        <NoticeAlert
          icon={<Info className="h-4 w-4" />}
          title="Experimental dashboard"
          body="This dashboard is experimental and will continue to evolve. Layout, widgets, and metrics may change in upcoming releases."
          onDismiss={() => dismiss('experimental')}
        />
      )}
    </div>
  );
}
