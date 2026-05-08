import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export interface FilterDef {
  /** Stable key used in the filter-value map. */
  key: string;
  /** Visible label, e.g. "Domain". */
  label: string;
  /** Selectable options. Always includes an "All" option implicitly. */
  options: { value: string; label: string }[];
}

interface FilterBarProps {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  className?: string;
}

const ALL = '__all__';

export function FilterBar({ filters, values, onChange, onReset, className }: FilterBarProps) {
  const activeCount = filters.filter((f) => values[f.key] && values[f.key] !== ALL).length;

  return (
    <div
      className={
        'flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 ' +
        (className ?? '')
      }
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Filter
      </span>
      {filters.map((f) => (
        <div key={f.key} className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{f.label}</span>
          <Select
            value={values[f.key] ?? ALL}
            onValueChange={(v) => onChange(f.key, v === ALL ? '' : v)}
          >
            <SelectTrigger className="h-7 min-w-[140px] text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL}>All</SelectItem>
              {f.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      {activeCount > 0 && onReset ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7 gap-1 text-xs"
          onClick={onReset}
        >
          <X size={12} /> Clear
        </Button>
      ) : null}
    </div>
  );
}

export const FILTER_ALL = ALL;
