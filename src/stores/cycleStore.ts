import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';
import { isAfter, addDays, parseISO, differenceInDays, format } from 'date-fns';

export interface ReviewCycle {
  id: string;
  tenant_id: string;
  name: string;
  start_date: string;
  end_date: string;
  grace_period_days: number;
  status: 'draft' | 'active' | 'closed';
  closed_at?: string;
  created_at: string;
  created_by?: string;
  modified_at?: string;
  modified_by?: string;
}

export interface CycleSummary {
  totalEmployees: number;
  submitted: number;
  assessmentsPending: number;
  assessmentsCompleted: number;
  managerReviewsPending: number;
  approved: number;
}

interface CycleStore {
  cycles: ReviewCycle[];
  activeCycle: ReviewCycle | null;
  loading: boolean;
  initialized: boolean;
  summary: CycleSummary | null;

  fetchCycles: () => Promise<void>;
  createCycle: (params: { tenant_id: string; name: string; start_date: string; end_date: string; grace_period_days?: number }) => Promise<void>;
  activateCycle: (cycleId: string) => Promise<void>;
  closeCycle: (cycleId: string) => Promise<void>;
  deleteCycle: (cycleId: string) => Promise<void>;
  sendReminder: (cycleId: string) => Promise<number>;
  computeSummary: (tenantId: string) => Promise<void>;
  isSubmissionAllowed: () => boolean;
  getDaysRemaining: () => number | null;
}

export const useCycleStore = create<CycleStore>((set, get) => ({
  cycles: [],
  activeCycle: null,
  loading: false,
  initialized: false,
  summary: null,

  fetchCycles: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('review_cycles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const cycles: ReviewCycle[] = (data || []).map((c: any) => ({
        id: c.id, tenant_id: c.tenant_id, name: c.name,
        start_date: c.start_date, end_date: c.end_date,
        grace_period_days: c.grace_period_days, status: c.status as any,
        closed_at: c.closed_at, created_at: c.created_at,
        created_by: c.created_by, modified_at: c.modified_at, modified_by: c.modified_by,
      }));

      let active = cycles.find((c) => c.status === 'active') || null;

      // Auto-close check
      if (active) {
        const graceEnd = addDays(parseISO(active.end_date), active.grace_period_days);
        if (isAfter(new Date(), graceEnd)) {
          const now = new Date().toISOString();
          const userId = getCurrentUserId();
          await supabase.from('review_cycles').update({
            status: 'closed', closed_at: now, modified_at: now, modified_by: userId,
          }).eq('id', active.id);
          active = { ...active, status: 'closed', closed_at: now };
          const idx = cycles.findIndex((c) => c.id === active!.id);
          if (idx >= 0) cycles[idx] = active;
        }
      }

      set({ cycles, activeCycle: active?.status === 'active' ? active : null, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch cycles:', err);
      set({ loading: false, initialized: true });
    }
  },

  createCycle: async ({ tenant_id, name, start_date, end_date, grace_period_days = 3 }) => {
    const id = `cycle-${Date.now()}`;
    const userId = getCurrentUserId();
    const { error } = await supabase.from('review_cycles').insert({
      id, tenant_id, name, start_date, end_date, grace_period_days, status: 'draft', created_by: userId,
    });
    if (error) throw error;

    const newCycle: ReviewCycle = {
      id, tenant_id, name, start_date, end_date, grace_period_days,
      status: 'draft', created_at: new Date().toISOString(), created_by: userId,
    };
    set((s) => ({ cycles: [newCycle, ...s.cycles] }));
  },

  activateCycle: async (cycleId) => {
    const cycle = get().cycles.find((c) => c.id === cycleId);
    if (!cycle) return;
    const userId = getCurrentUserId();
    const now = new Date().toISOString();

    // Close any previous active cycle
    const currentActive = get().activeCycle;
    if (currentActive && currentActive.id !== cycleId) {
      await supabase.from('review_cycles').update({
        status: 'closed', closed_at: now, modified_at: now, modified_by: userId,
      }).eq('id', currentActive.id);
    }

    // Activate new cycle
    await supabase.from('review_cycles').update({
      status: 'active', modified_at: now, modified_by: userId,
    }).eq('id', cycleId);

    // Send notifications to ALL active users in tenant (role-specific messages)
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, role')
      .eq('tenant_id', cycle.tenant_id)
      .eq('status', 'active');

    if (allUsers && allUsers.length > 0) {
      const notifications = allUsers.map((u: any) => {
        let message = '';
        let actionLink = '/skill-registry';
        if (u.role === 'employee') {
          message = `A new review cycle '${cycle.name}' has started. Submit your skill ratings by ${format(parseISO(cycle.end_date), 'MMM d, yyyy')}.`;
        } else if (u.role === 'manager') {
          message = `A new review cycle '${cycle.name}' has started. Monitor your team's progress.`;
          actionLink = '/review-cycles';
        } else {
          message = `Review cycle '${cycle.name}' is now active.`;
          actionLink = '/review-cycles';
        }
        return {
          id: `notif-cycle-${Date.now()}-${u.id}`,
          tenant_id: cycle.tenant_id,
          target_role: u.role,
          target_user_id: u.id,
          message,
          type: 'cycle_activated',
          reference_id: cycleId,
          action_link: actionLink,
          read: false,
        };
      });
      await supabase.from('notifications').insert(notifications);
    }

    const updated = { ...cycle, status: 'active' as const, modified_at: now };
    set((s) => ({
      cycles: s.cycles.map((c) =>
        c.id === cycleId ? updated
          : (currentActive && c.id === currentActive.id) ? { ...c, status: 'closed' as const, closed_at: now }
          : c
      ),
      activeCycle: updated,
    }));
  },

  closeCycle: async (cycleId) => {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    await supabase.from('review_cycles').update({
      status: 'closed', closed_at: now, modified_at: now, modified_by: userId,
    }).eq('id', cycleId);

    set((s) => ({
      cycles: s.cycles.map((c) => c.id === cycleId ? { ...c, status: 'closed' as const, closed_at: now } : c),
      activeCycle: s.activeCycle?.id === cycleId ? null : s.activeCycle,
    }));
  },

  deleteCycle: async (cycleId) => {
    await supabase.from('review_cycles').delete().eq('id', cycleId);
    set((s) => ({
      cycles: s.cycles.filter((c) => c.id !== cycleId),
      activeCycle: s.activeCycle?.id === cycleId ? null : s.activeCycle,
    }));
  },

  sendReminder: async (cycleId) => {
    const cycle = get().cycles.find((c) => c.id === cycleId);
    if (!cycle) return 0;

    // Find employees who haven't submitted for this cycle
    const { data: employees } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', cycle.tenant_id)
      .eq('role', 'employee')
      .eq('status', 'active');

    const { data: submissions } = await supabase
      .from('skill_registry_submissions')
      .select('employee_id')
      .eq('cycle', cycle.name)
      .is('deleted_on', null);

    const submittedIds = new Set((submissions || []).map((s: any) => s.employee_id));
    const pending = (employees || []).filter((e: any) => !submittedIds.has(e.id));

    if (pending.length > 0) {
      const notifications = pending.map((emp: any) => ({
        id: `notif-remind-${Date.now()}-${emp.id}`,
        tenant_id: cycle.tenant_id,
        target_role: 'employee',
        target_user_id: emp.id,
        message: `Reminder: Please submit your skill ratings for '${cycle.name}' before ${format(parseISO(cycle.end_date), 'MMM d, yyyy')}.`,
        type: 'submission_reminder',
        reference_id: cycleId,
        action_link: '/skill-registry',
        read: false,
      }));
      await supabase.from('notifications').insert(notifications);
    }

    return pending.length;
  },

  computeSummary: async (tenantId) => {
    const active = get().activeCycle;
    if (!active) { set({ summary: null }); return; }

    const [empRes, subRes, assRes, attRes, revRes] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('role', 'employee').eq('status', 'active'),
      supabase.from('skill_registry_submissions').select('id', { count: 'exact', head: true }).eq('cycle', active.name).is('deleted_on', null),
      supabase.from('assessments').select('id', { count: 'exact', head: true }).is('deleted_on', null),
      supabase.from('assessment_attempts').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'evaluated']).is('deleted_on', null),
      supabase.from('manager_reviews').select('id, status', { count: 'exact' }).is('deleted_on', null),
    ]);

    const pendingReviews = (revRes.data || []).filter((r: any) => r.status !== 'completed').length;
    const approvedReviews = (revRes.data || []).filter((r: any) => r.status === 'completed').length;

    set({
      summary: {
        totalEmployees: empRes.count || 0,
        submitted: subRes.count || 0,
        assessmentsPending: (assRes.count || 0) - (attRes.count || 0),
        assessmentsCompleted: attRes.count || 0,
        managerReviewsPending: pendingReviews,
        approved: approvedReviews,
      },
    });
  },

  isSubmissionAllowed: () => {
    const active = get().activeCycle;
    if (!active) return false;
    const now = new Date();
    const graceEnd = addDays(parseISO(active.end_date), active.grace_period_days);
    return !isAfter(now, graceEnd);
  },

  getDaysRemaining: () => {
    const active = get().activeCycle;
    if (!active) return null;
    const end = parseISO(active.end_date);
    const days = differenceInDays(end, new Date());
    return days;
  },
}));
