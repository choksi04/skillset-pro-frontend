import { useEffect, useState } from 'react';
import { Info, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'dashboard-notice-dismissed';

export function DashboardNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(sessionStorage.getItem(STORAGE_KEY) !== '1');
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="relative mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={dismiss}
        className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss notice"
      >
        <X className="h-3.5 w-3.5" />
      </Button>

      <div className="space-y-2.5 pr-8">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-sm">
            <span className="font-medium text-foreground">Experimental dashboard</span>
            <span className="text-muted-foreground">
              {' '}
              — This dashboard is experimental and will continue to evolve. Layout, widgets, and metrics may change in upcoming releases.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-sm">
            <span className="font-medium text-foreground">SIAP is in Beta</span>
            <span className="text-muted-foreground">
              {' '}
              — You're using an early version; your feedback shapes what comes next. Reach out to Team Aekatra with thoughts or issues.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
