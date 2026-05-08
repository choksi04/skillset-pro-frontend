import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

interface DeltaBadgeProps {
  /** The delta value (current − previous). Null/undefined → "—" badge. */
  value: number | null | undefined;
  /** Optional unit suffix to display alongside the number, e.g. "%" or "L". */
  suffix?: string;
  /** Number of decimal places for display. Default 1. */
  decimals?: number;
  /** When true, treat positive as bad (e.g. self-vs-validated gap). Default false. */
  inverted?: boolean;
  /** Optional label prefix, e.g. "vs prev" — rendered before the value. */
  label?: string;
}

export function DeltaBadge({
  value,
  suffix = '',
  decimals = 1,
  inverted = false,
  label,
}: DeltaBadgeProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        <Minus size={10} />
        {label ? `${label} —` : '—'}
      </span>
    );
  }

  const isZero = Math.abs(value) < Math.pow(10, -decimals) / 2;
  const positive = value > 0;
  const tone = isZero
    ? 'bg-muted text-muted-foreground'
    : positive === inverted
      ? 'bg-destructive/15 text-destructive'
      : 'bg-success/15 text-success';
  const Icon = isZero ? Minus : positive ? ArrowUp : ArrowDown;
  const sign = isZero ? '' : positive ? '+' : '−';
  const display = `${sign}${Math.abs(value).toFixed(decimals)}${suffix}`;

  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ' +
        tone
      }
    >
      <Icon size={10} />
      {label ? `${label} ${display}` : display}
    </span>
  );
}
