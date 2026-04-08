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

export interface CycleDomainSelection {
  cycle_id: string;
  domain_id: string;
  tenant_id: string;
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
  cycleDomainSelections: CycleDomainSelection[];

  fetchCycles: () => Promise<void>;
  createCycle: (params: { tenant_id: string; name: string; start_date: string; end_date: string; grace_period_days?: number }) => Promise<void>;
  activateCycle: (cycleId: string, selectedDomainIds: string[]) => Promise<void>;
  closeCycle: (cycleId: string) => Promise<void>;
  deleteCycle: (cycleId: string) => Promise<void>;
  sendReminder: (cycleId: string) => Promise<number>;
  computeSummary: (tenantId: string) => Promise<void>;
  isSubmissionAllowed: () => boolean;
  getDaysRemaining: () => number | null;
  getSelectedDomainIds: (cycleId: string) => string[];
  forceSubmitEmployee: (submissionId: string) => Promise<void>;
}

export const useCycleStore = create<CycleStore>((set, get) => ({
  cycles: [],
  activeCycle: null,
  loading: false,
  initialized: false,
  summary: null,
  cycleDomainSelections: [],

  fetchCycles: async () => {
    set({ loading: true });
    try {
      const [cyclesRes, selectionsRes] = await Promise.all([
        supabase.from('review_cycles').select('*').order('created_at', { ascending: false }),
        supabase.from('cycle_domain_selections').select('*'),
      ]);
      if (cyclesRes.error) throw cyclesRes.error;

      const cycles: ReviewCycle[] = (cyclesRes.data || []).map((c: any) => ({
        id: c.id, tenant_id: c.tenant_id, name: c.name,
        start_date: c.start_date, end_date: c.end_date,
        grace_period_days: c.grace_period_days, status: c.status as any,
        closed_at: c.closed_at, created_at: c.created_at,
        created_by: c.created_by, modified_at: c.modified_at, modified_by: c.modified_by,
      }));

      const cycleDomainSelections: CycleDomainSelection[] = (selectionsRes.data || []).map((s: any) => ({
        cycle_id: s.cycle_id, domain_id: s.domain_id, tenant_id: s.tenant_id,
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

      set({ cycles, cycleDomainSelections, activeCycle: active?.status === 'active' ? active : null, loading: false, initialized: true });
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

  activateCycle: async (cycleId, selectedDomainIds) => {
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

    // Save selected domains
    // Remove old selections for this cycle first
    await supabase.from('cycle_domain_selections').delete().eq('cycle_id', cycleId);
    if (selectedDomainIds.length > 0) {
      await supabase.from('cycle_domain_selections').insert(
        selectedDomainIds.map((domainId) => ({
          cycle_id: cycleId, domain_id: domainId, tenant_id: cycle.tenant_id, created_by: userId,
        }))
      );
    }

    // Activate new cycle
    await supabase.from('review_cycles').update({
      status: 'active', modified_at: now, modified_by: userId,
    }).eq('id', cycleId);

    // Get eligible employees: only from selected domains
    const { data: domainAssignments } = await supabase
      .from('employee_domain_assignments')
      .select('employee_id, domain_id')
      .eq('tenant_id', cycle.tenant_id)
      .in('domain_id', selectedDomainIds);

    const eligibleEmployeeIds = new Set((domainAssignments || []).map((a: any) => a.employee_id));

    // Also include users with domain_id directly set (legacy)
    const { data: directUsers } = await supabase
      .from('users')
      .select('id, role')
      .eq('tenant_id', cycle.tenant_id)
      .eq('status', 'active')
      .in('domain_id', selectedDomainIds);

    for (const u of directUsers || []) {
      eligibleEmployeeIds.add(u.id);
    }

    // Send notifications to eligible users + all managers/admins
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, role')
      .eq('tenant_id', cycle.tenant_id)
      .eq('status', 'active');

    if (allUsers && allUsers.length > 0) {
      const notifications = allUsers
        .filter((u: any) => {
          // Include all managers/admins, and employees only if eligible
          if (u.role === 'employee') return eligibleEmployeeIds.has(u.id);
          return true;
        })
        .map((u: any) => {
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
      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    }

    const newSelections: CycleDomainSelection[] = selectedDomainIds.map((domainId) => ({
      cycle_id: cycleId, domain_id: domainId, tenant_id: cycle.tenant_id,
    }));

    const updated = { ...cycle, status: 'active' as const, modified_at: now };
    set((s) => ({
      cycles: s.cycles.map((c) =>
        c.id === cycleId ? updated
          : (currentActive && c.id === currentActive.id) ? { ...c, status: 'closed' as const, closed_at: now }
          : c
      ),
      activeCycle: updated,
      cycleDomainSelections: [
        ...s.cycleDomainSelections.filter((sel) => sel.cycle_id !== cycleId),
        ...newSelections,
      ],
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
    await supabase.from('cycle_domain_selections').delete().eq('cycle_id', cycleId);
    await supabase.from('review_cycles').delete().eq('id', cycleId);
    set((s) => ({
      cycles: s.cycles.filter((c) => c.id !== cycleId),
      activeCycle: s.activeCycle?.id === cycleId ? null : s.activeCycle,
      cycleDomainSelections: s.cycleDomainSelections.filter((sel) => sel.cycle_id !== cycleId),
    }));
  },

  sendReminder: async (cycleId) => {
    const cycle = get().cycles.find((c) => c.id === cycleId);
    if (!cycle) return 0;

    // Get selected domains for this cycle
    const selectedDomainIds = get().getSelectedDomainIds(cycleId);

    // Find eligible employees (assigned to selected domains)
    let employeeIds: string[] = [];
    if (selectedDomainIds.length > 0) {
      const { data: assignments } = await supabase
        .from('employee_domain_assignments')
        .select('employee_id')
        .eq('tenant_id', cycle.tenant_id)
        .in('domain_id', selectedDomainIds);
      
      const { data: directUsers } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', cycle.tenant_id)
        .eq('status', 'active')
        .in('domain_id', selectedDomainIds);

      const idSet = new Set([
        ...(assignments || []).map((a: any) => a.employee_id),
        ...(directUsers || []).map((u: any) => u.id),
      ]);
      employeeIds = Array.from(idSet);
    } else {
      // Fallback: all employees
      const { data: employees } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', cycle.tenant_id)
        .eq('role', 'employee')
        .eq('status', 'active');
      employeeIds = (employees || []).map((e: any) => e.id);
    }

    const { data: submissions } = await supabase
      .from('skill_registry_submissions')
      .select('employee_id')
      .eq('cycle', cycle.name)
      .is('deleted_on', null);

    const submittedIds = new Set((submissions || []).map((s: any) => s.employee_id));
    const pending = employeeIds.filter((id) => !submittedIds.has(id));

    if (pending.length > 0) {
      const notifications = pending.map((empId) => ({
        id: `notif-remind-${Date.now()}-${empId}`,
        tenant_id: cycle.tenant_id,
        target_role: 'employee',
        target_user_id: empId,
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

    const selectedDomainIds = get().getSelectedDomainIds(active.id);

    // Count eligible employees (from selected domains only)
    let totalEmployees = 0;
    if (selectedDomainIds.length > 0) {
      const { data: assignments } = await supabase
        .from('employee_domain_assignments')
        .select('employee_id')
        .eq('tenant_id', tenantId)
        .in('domain_id', selectedDomainIds);
      
      const { data: directUsers } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .in('domain_id', selectedDomainIds);

      const uniqueIds = new Set([
        ...(assignments || []).map((a: any) => a.employee_id),
        ...(directUsers || []).map((u: any) => u.id),
      ]);
      totalEmployees = uniqueIds.size;
    } else {
      const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('role', 'employee').eq('status', 'active');
      totalEmployees = count || 0;
    }

    const [subRes, assRes, attRes, revRes] = await Promise.all([
      supabase.from('skill_registry_submissions').select('id', { count: 'exact', head: true }).eq('cycle', active.name).is('deleted_on', null),
      supabase.from('assessments').select('id', { count: 'exact', head: true }).is('deleted_on', null),
      supabase.from('assessment_attempts').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'evaluated']).is('deleted_on', null),
      supabase.from('manager_reviews').select('id, status', { count: 'exact' }).is('deleted_on', null),
    ]);

    const pendingReviews = (revRes.data || []).filter((r: any) => r.status !== 'completed').length;
    const approvedReviews = (revRes.data || []).filter((r: any) => r.status === 'completed').length;

    set({
      summary: {
        totalEmployees,
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

  getSelectedDomainIds: (cycleId) => {
    return get().cycleDomainSelections
      .filter((s) => s.cycle_id === cycleId)
      .map((s) => s.domain_id);
  },

  forceSubmitEmployee: async (submissionId) => {
    const now = new Date().toISOString();
    const userId = getCurrentUserId();
    const { error } = await supabase.from('skill_registry_submissions').update({
      status: 'submitted', submitted_at: now, updated_at: now, modified_by: userId, modified_at: now,
    }).eq('id', submissionId);
    if (error) throw error;
  },
}));
