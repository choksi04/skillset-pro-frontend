import { Badge } from '@/components/ui/badge';

export function ScoreChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {value !== null ? (
        <Badge variant="secondary" className="text-xs font-semibold">L{value}</Badge>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}
