import { useAuth } from '@/contexts/AuthContext';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useRegistryStore } from '@/stores/registryStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useCycleStore } from '@/stores/cycleStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import QuickStartChecklist from '@/components/onboarding/QuickStartChecklist';
import {
  Users, Brain, ClipboardCheck, TrendingUp, AlertCircle, Network,
  BarChart3, Clock, CheckCircle, FileText, Send, Eye, Play, Timer,
} from 'lucide-react';
import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { format, parseISO, differenceInDays } from 'date-fns';

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        </div>
        <p className="mt-2 text-2xl font-semibold text-card-foreground">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ──────────────── ADMIN DASHBOARD ──────────────── */
function AdminDashboard() {
  const { skills } = useSkillStore();
  const { domains } = useDomainStore();
  const { questions } = useQuestionStore();
  const { assessments } = useAssessmentStore();
  const { attempts } = useAttemptStore();
  const { reviews, officialEntries } = useReviewStore();
  const { activeCycle, getDaysRemaining, fetchCycles } = useCycleStore();
  const navigate = useNavigate();

  useEffect(() => { fetchCycles(); }, [fetchCycles]);

  const pendingReviews = reviews.filter((r) => r.status === 'pending').length;
  const completedAssessments = attempts.filter((a) => a.status === 'submitted' || a.status === 'evaluated').length;
  const activeAssessments = assessments.filter((a) => a.status === 'pending' || a.status === 'in_progress').length;
  const daysRemaining = getDaysRemaining();

  return (
    <>
      {/* Active Cycle Banner */}
      {activeCycle && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2"><Play size={16} className="text-success" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">{activeCycle.name}</p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(activeCycle.start_date), 'MMM d')} – {format(parseISO(activeCycle.end_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {daysRemaining !== null && (
              <span className={`text-sm font-semibold flex items-center gap-1 ${daysRemaining <= 3 ? 'text-destructive' : daysRemaining <= 7 ? 'text-warning' : 'text-foreground'}`}>
                <Timer size={14} /> {daysRemaining > 0 ? `${daysRemaining}d left` : 'Ending'}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate('/review-cycles')} className="text-xs">Manage</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Brain size={20} />} label="Skills Tracked" value={skills.length} sub={`${new Set(skills.map((s) => s.skill_category)).size} categories`} />
        <StatCard icon={<Network size={20} />} label="Domains" value={domains.length} />
        <StatCard icon={<ClipboardCheck size={20} />} label="Active Assessments" value={activeAssessments} sub={`${completedAssessments} completed`} />
        <StatCard icon={<TrendingUp size={20} />} label="Registry Entries" value={officialEntries.length} sub={`${pendingReviews} reviews pending`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">Recent Activity</h3>
              <div className="space-y-3">
                {completedAssessments > 0 && (
                  <ActivityItem text={`${completedAssessments} assessment(s) completed`} time="Recent" />
                )}
                {pendingReviews > 0 && (
                  <ActivityItem text={`${pendingReviews} manager review(s) pending`} time="Action needed" />
                )}
                {officialEntries.length > 0 && (
                  <ActivityItem text={`${officialEntries.length} official registry entries recorded`} time="All time" />
                )}
                {completedAssessments === 0 && pendingReviews === 0 && officialEntries.length === 0 && (
                  <p className="text-xs text-muted-foreground">No recent activity. Complete the setup steps to get started.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">Action Items</h3>
              <div className="space-y-2">
                {skills.length === 0 && <ActionItem text="Add skills to the Skill Library" priority="high" />}
                {domains.length === 0 && <ActionItem text="Create functional domains" priority="high" />}
                {questions.length === 0 && <ActionItem text="Generate or add questions" priority="medium" />}
                {!activeCycle && <ActionItem text="Create and activate a review cycle" priority="high" />}
                {pendingReviews > 0 && <ActionItem text={`Review ${pendingReviews} pending assessment(s)`} priority="high" />}
                {skills.length > 0 && domains.length > 0 && questions.length > 0 && activeCycle && pendingReviews === 0 && (
                  <p className="text-xs text-muted-foreground">All caught up! No pending actions.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <QuickStartChecklist />
        </div>
      </div>
    </>
  );
}

/* ──────────────── MANAGER DASHBOARD ──────────────── */
function ManagerDashboard() {
  const { user } = useAuth();
  const { assessments } = useAssessmentStore();
  const { attempts } = useAttemptStore();
  const { reviews } = useReviewStore();
  const navigate = useNavigate();

  const pendingReviews = reviews.filter((r) => r.status === 'pending').length;
  const completedReviews = reviews.filter((r) => r.status === 'completed').length;
  const teamAssessments = assessments.length;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={<ClipboardCheck size={20} />} label="Team Assessments" value={teamAssessments} />
        <StatCard icon={<Clock size={20} />} label="Pending Reviews" value={pendingReviews} sub="Awaiting your action" />
        <StatCard icon={<CheckCircle size={20} />} label="Completed Reviews" value={completedReviews} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">Action Items</h3>
              <div className="space-y-2">
                {pendingReviews > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="text-destructive" />
                      <span className="text-sm text-foreground">{pendingReviews} assessment review(s) pending</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/review-cycles')} className="text-xs">
                      Review Now
                    </Button>
                  </div>
                )}
                {pendingReviews === 0 && (
                  <p className="text-xs text-muted-foreground">No pending reviews. All caught up!</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <QuickStartChecklist />
        </div>
      </div>
    </>
  );
}

/* ──────────────── EMPLOYEE DASHBOARD ──────────────── */
function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { submissions } = useRegistryStore();
  const { assessments } = useAssessmentStore();
  const { attempts } = useAttemptStore();

  const employeeId = user?.id ?? '';
  const mySubmission = submissions.find((s) => s.employee_id === employeeId);
  const myAssessments = assessments.filter((a) => a.employee_id === employeeId);
  const myAttempts = attempts.filter((a) => a.employee_id === employeeId);
  const pendingAssessment = myAssessments.find((a) => {
    const attempt = myAttempts.find((at) => at.assessment_id === a.id);
    return !attempt || attempt.status === 'in_progress';
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Send size={20} />}
          label="Registry Status"
          value={mySubmission ? (mySubmission.status === 'submitted' ? 'Submitted' : 'Draft') : 'Not Started'}
        />
        <StatCard icon={<ClipboardCheck size={20} />} label="Assessments" value={myAssessments.length} />
        <StatCard
          icon={<BarChart3 size={20} />}
          label="Completed"
          value={myAttempts.filter((a) => a.status === 'submitted' || a.status === 'evaluated').length}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">Pending Actions</h3>
              <div className="space-y-2">
                {!mySubmission && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="text-destructive" />
                      <span className="text-sm text-foreground">Submit your skill registry</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/skill-registry')} className="text-xs">
                      Start Now
                    </Button>
                  </div>
                )}
                {pendingAssessment && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-warning" />
                      <span className="text-sm text-foreground">Assessment pending</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/assessments')} className="text-xs">
                      Take Assessment
                    </Button>
                  </div>
                )}
                {mySubmission && !pendingAssessment && (
                  <p className="text-xs text-muted-foreground">No pending actions. Check back later for results!</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <QuickStartChecklist />
        </div>
      </div>
    </>
  );
}

/* ──────────────── Shared components ──────────────── */
function ActivityItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{text}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

function ActionItem({ text, priority }: { text: string; priority: 'high' | 'medium' | 'low' }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
      <AlertCircle size={14} className={
        priority === 'high' ? 'text-destructive' :
        priority === 'medium' ? 'text-warning' : 'text-muted-foreground'
      } />
      <span className="text-sm text-foreground">{text}</span>
    </div>
  );
}

/* ──────────────── MAIN ──────────────── */
export default function DashboardPage() {
  const { currentRole, user } = useAuth();
  const { fetchSkills } = useSkillStore();
  const { fetchDomains } = useDomainStore();
  const { fetchQuestions } = useQuestionStore();
  const { fetchAssessments } = useAssessmentStore();
  const { fetchAttempts } = useAttemptStore();
  const { fetchRegistry } = useRegistryStore();
  const { fetchReviews } = useReviewStore();
  const { fetchCycles } = useCycleStore();

  useEffect(() => {
    fetchSkills();
    fetchDomains();
    fetchQuestions();
    fetchAssessments();
    fetchAttempts();
    fetchRegistry();
    fetchReviews();
    fetchCycles();
  }, [fetchSkills, fetchDomains, fetchQuestions, fetchAssessments, fetchAttempts, fetchRegistry, fetchReviews, fetchCycles]);

  return (
    <div className="space-y-6" data-tour="dashboard">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {currentRole === 'admin' && 'Overview of your skill intelligence platform.'}
          {currentRole === 'manager' && 'Your team assessments and reviews at a glance.'}
          {currentRole === 'employee' && 'Your skill journey and pending actions.'}
        </p>
      </div>

      {currentRole === 'admin' && <AdminDashboard />}
      {currentRole === 'manager' && <ManagerDashboard />}
      {currentRole === 'employee' && <EmployeeDashboard />}
    </div>
  );
}
