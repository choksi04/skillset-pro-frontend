import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, Users, Brain, ClipboardCheck, TrendingUp, AlertCircle } from 'lucide-react';
import QuickStartChecklist from '@/components/onboarding/QuickStartChecklist';

const statCards = [
  { label: 'Total Employees', value: '248', icon: <Users size={20} />, change: '+12 this month' },
  { label: 'Skills Tracked', value: '86', icon: <Brain size={20} />, change: '14 categories' },
  { label: 'Assessments Active', value: '12', icon: <ClipboardCheck size={20} />, change: '5 pending review' },
  { label: 'Registry Coverage', value: '72%', icon: <TrendingUp size={20} />, change: '+8% vs last quarter' },
];

export default function DashboardPage() {
  const { currentRole, user } = useAuth();

  return (
    <div className="space-y-6" data-tour="dashboard">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Welcome back, {user?.full_name?.split(' ')[0]}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Here's an overview of your skill intelligence platform
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {stat.icon}
              </div>
            </div>
            <p className="mt-2 text-2xl font-semibold text-card-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Recent Activity</h3>
          <div className="space-y-3">
            {[
              { text: 'Assessment "React Advanced" completed by 8 employees', time: '2h ago' },
              { text: 'New skill "Cloud Architecture" added to framework', time: '5h ago' },
              { text: 'Manager review pending for 3 assessments', time: '1d ago' },
            ].map((activity, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{activity.text}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Action Items</h3>
          <div className="space-y-3">
            {[
              { text: 'Review pending assessment results', priority: 'high' },
              { text: 'Map new skills to Engineering domain', priority: 'medium' },
              { text: 'Generate questions for Python skill', priority: 'low' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                <AlertCircle size={14} className={
                  item.priority === 'high' ? 'text-destructive' :
                  item.priority === 'medium' ? 'text-warning' : 'text-muted-foreground'
                } />
                <span className="text-sm text-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
