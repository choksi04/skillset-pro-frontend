import { useEffect, useState } from 'react';
import { Clock, Hourglass } from 'lucide-react';

function fmt(total: number) {
  const s = Math.max(0, Math.floor(total));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface Props {
  /** Seconds remaining when the timer mounts (resumed value or full duration). */
  initialRemaining: number;
  /** Full assessment duration in seconds — used to derive elapsed time. */
  totalSeconds: number;
  isPaused?: boolean;
  onTick?: (remaining: number) => void;
  onTimeUp?: () => void;
}

/**
 * Countdown chip showing both remaining and elapsed time.
 * Used by the adaptive runner; the fixed runner keeps its own timer.
 */
export default function AssessmentTimer({
  initialRemaining,
  totalSeconds,
  isPaused = false,
  onTick,
  onTimeUp,
}: Props) {
  const [remaining, setRemaining] = useState(Math.max(0, initialRemaining));

  useEffect(() => {
    if (isPaused || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          onTimeUp?.();
          onTick?.(0);
          return 0;
        }
        const next = r - 1;
        onTick?.(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isPaused, remaining, onTick, onTimeUp]);

  const elapsed = Math.max(0, totalSeconds - remaining);
  const isLow = remaining <= 300;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-mono text-xs font-medium text-muted-foreground">
        <Hourglass size={12} />
        <span className="sr-only">Elapsed</span>
        {fmt(elapsed)}
      </div>
      <div
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm font-medium ${
          isLow
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : 'border-border bg-background text-foreground'
        }`}
      >
        <Clock size={14} />
        <span className="sr-only">Remaining</span>
        {fmt(remaining)}
      </div>
    </div>
  );
}
