import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  onClick?: () => void;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'info';
}

const TONE_CLASSES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  info: 'bg-info/15 text-info',
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  onClick,
  tone = 'primary',
}: StatCardProps) {
  const Wrapper: any = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={
        'group block w-full text-left ' +
        (onClick ? 'cursor-pointer' : '')
      }
    >
      <Card
        className={
          'h-full transition ' +
          (onClick ? 'hover:border-primary/40 hover:shadow-sm' : '')
        }
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            {Icon ? (
              <div
                className={
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ' +
                  TONE_CLASSES[tone]
                }
              >
                <Icon size={18} />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <div className="mt-1 text-2xl font-semibold text-card-foreground">
                {loading ? <Skeleton className="h-7 w-20" /> : value}
              </div>
              {hint !== undefined && hint !== null ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {loading ? <Skeleton className="h-3 w-24" /> : hint}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  );
}
