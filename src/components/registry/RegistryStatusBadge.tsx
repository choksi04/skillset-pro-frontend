import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { registryStatusConfig, type RegistryStatus } from '@/lib/registryStatus';

interface RegistryStatusBadgeProps {
  status: RegistryStatus;
  /** Compact (sm) or default sizing. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Shared status pill for skill-registry views.
 * Always pulls label + colors from `registryStatusConfig` so all pages stay in sync.
 */
export function RegistryStatusBadge({ status, size = 'md', className }: RegistryStatusBadgeProps) {
  const cfg = registryStatusConfig[status];
  const sizeClass =
    size === 'sm'
      ? 'text-[10px] px-2 py-0.5 rounded-full font-medium'
      : 'text-xs px-2.5 py-0.5 rounded-full font-medium';
  return (
    <Badge variant={cfg.variant} className={cn(sizeClass, cfg.badgeClass, className)}>
      {cfg.label}
    </Badge>
  );
}

export default RegistryStatusBadge;
