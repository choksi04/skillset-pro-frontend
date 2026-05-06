import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface ActionListItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
}

interface ActionListProps {
  items: ActionListItem[];
  loading?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: ReactNode;
}

export function ActionList({
  items,
  loading,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
}: ActionListProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        compact
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-2">
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const Icon = item.icon;
            const Wrapper: any = item.onClick ? 'button' : 'div';
            return (
              <li key={item.id}>
                <Wrapper
                  type={item.onClick ? 'button' : undefined}
                  onClick={item.onClick}
                  className={
                    'flex w-full items-center gap-3 rounded-md px-3 py-3 text-left ' +
                    (item.onClick ? 'transition hover:bg-muted/60' : '')
                  }
                >
                  {Icon ? (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon size={14} />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {item.title}
                    </div>
                    {item.description ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    ) : null}
                  </div>
                  {item.badge ? (
                    <div className="flex-shrink-0">{item.badge}</div>
                  ) : null}
                  {item.onClick ? (
                    <ChevronRight
                      size={14}
                      className="flex-shrink-0 text-muted-foreground"
                    />
                  ) : null}
                </Wrapper>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
