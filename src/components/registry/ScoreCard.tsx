import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ScoreCardProps {
  label: string;
  value: number | null;
  icon?: ReactNode;
  trend?: number | null;
  children?: ReactNode;
}

export function ScoreCard({ label, value, icon, trend, children }: ScoreCardProps) {
  return (
    <Card className="border-border">
      <CardContent className="p-5 flex flex-col items-center justify-center gap-2">
        {icon && (
          <div className="rounded-lg bg-primary/10 p-2.5">
            {icon}
          </div>
        )}
        <span className="text-xs text-muted-foreground text-center font-medium">{label}</span>
        {children ? children : value !== null ? (
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-bold text-foreground">L{value}</span>
            {trend !== undefined && trend !== null && (
              <span className={`text-xs font-semibold ${trend > 0 ? 'text-success' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {trend > 0 ? `↑${trend}` : trend < 0 ? `↓${Math.abs(trend)}` : '—'}
              </span>
            )}
          </div>
        ) : (
          <span className="text-lg text-muted-foreground">—</span>
        )}
      </CardContent>
    </Card>
  );
}
