import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AdminFilters {
  domainId: string; // '' = all
  managerId: string;
  categoryId: string; // skill_categories.id — joins use ID (not name)
}

interface AdminFiltersCtx {
  filters: AdminFilters;
  setFilter: (key: keyof AdminFilters, value: string) => void;
  reset: () => void;
}

const Ctx = createContext<AdminFiltersCtx | null>(null);

export function AdminFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<AdminFilters>({
    domainId: '',
    managerId: '',
    categoryId: '',
  });
  const value = useMemo<AdminFiltersCtx>(
    () => ({
      filters,
      setFilter: (k, v) => setFilters((f) => ({ ...f, [k]: v })),
      reset: () => setFilters({ domainId: '', managerId: '', categoryId: '' }),
    }),
    [filters],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminFilters(): AdminFiltersCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdminFilters must be used inside AdminFiltersProvider');
  return v;
}
