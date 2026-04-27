// Stub kept temporarily to avoid breaking any stale imports.
// The Review Cycle feature has been removed.
// All consumers should be updated to drop these references.

export const useCycleStore = () => ({
  cycles: [] as Array<{ id: string; name: string; status: string }>,
  activeCycle: null as null | { id: string; name: string; start_date: string; end_date: string },
  initialized: true,
  fetchCycles: async () => {},
  getDaysRemaining: () => null as number | null,
});
