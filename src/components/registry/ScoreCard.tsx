import { Card, CardContent } from '@/components/ui/card';

export function ScoreCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
        <span className="text-xs text-muted-foreground text-center">{label}</span>
        {value !== null ? (
          <span className="text-2xl font-bold text-foreground">L{value}</span>
        ) : (
          <span className="text-lg text-muted-foreground">—</span>
        )}
      </CardContent>
    </Card>
  );
}
