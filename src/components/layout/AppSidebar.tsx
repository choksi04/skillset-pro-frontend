import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/models';
import {
  Building2,
  LayoutDashboard,
  Brain,
  Network,
  Link2,
  HelpCircle,
  FileText,
  Play,
  CheckCircle,
  ClipboardCheck,
  BarChart3,
  BookOpen,
  ChevronDown,
  Shield,
} from 'lucide-react';

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
  tourId?: string;
}

const sidebarItems: SidebarItem[] = [
  { title: 'Dashboard', href: '/', icon: <LayoutDashboard size={18} />, roles: ['admin', 'hr', 'manager', 'domain_lead', 'employee'], tourId: 'dashboard' },
  { title: 'Organization', href: '/organization', icon: <Building2 size={18} />, roles: ['admin', 'hr'], tourId: 'organization' },
  { title: 'Skill Framework', href: '/skills', icon: <Brain size={18} />, roles: ['admin', 'hr', 'manager', 'domain_lead'], tourId: 'skills' },
  { title: 'Domains', href: '/domains', icon: <Network size={18} />, roles: ['admin', 'hr', 'manager', 'domain_lead'], tourId: 'domains' },
  { title: 'Domain-Skill Map', href: '/domain-skills', icon: <Link2 size={18} />, roles: ['admin', 'hr', 'manager', 'domain_lead'], tourId: 'domain-skills' },
  { title: 'Question Bank', href: '/questions', icon: <HelpCircle size={18} />, roles: ['admin', 'hr', 'manager', 'domain_lead'], tourId: 'questions' },
  { title: 'AI Generation', href: '/ai-generate', icon: <FileText size={18} />, roles: ['admin', 'hr', 'manager', 'domain_lead'], tourId: 'ai-generate' },
  { title: 'Assessments', href: '/assessments', icon: <ClipboardCheck size={18} />, roles: ['admin', 'hr', 'manager', 'domain_lead', 'employee'], tourId: 'assessments' },
  { title: 'Take Assessment', href: '/assessment-exec', icon: <Play size={18} />, roles: ['employee'], tourId: 'assessment-exec' },
  { title: 'Reviews', href: '/reviews', icon: <CheckCircle size={18} />, roles: ['manager', 'domain_lead'], tourId: 'reviews' },
  { title: 'Skill Registry', href: '/registry', icon: <BarChart3 size={18} />, roles: ['admin', 'hr', 'manager', 'domain_lead', 'employee'], tourId: 'registry' },
  { title: 'HR Dashboard', href: '/hr-dashboard', icon: <Shield size={18} />, roles: ['admin', 'hr'], tourId: 'hr-dashboard' },
  { title: 'User Guide', href: '/guide', icon: <BookOpen size={18} />, roles: ['admin', 'hr', 'manager', 'domain_lead', 'employee'], tourId: 'guide' },
];

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrator',
  hr: 'HR Manager',
  manager: 'Manager',
  domain_lead: 'Domain Lead',
  employee: 'Employee',
};

export default function AppSidebar() {
  const { user, currentRole, setCurrentRole } = useAuth();
  const location = useLocation();

  const filteredItems = sidebarItems.filter((item) => item.roles.includes(currentRole));

  const allRoles: UserRole[] = ['admin', 'hr', 'manager', 'domain_lead', 'employee'];

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <Brain size={18} className="text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-sidebar-accent-foreground">SIAP</h1>
          <p className="text-[10px] text-sidebar-muted leading-none">Skill Intelligence Platform</p>
        </div>
      </div>

      {/* Role Switcher */}
      <div className="px-3 py-3 border-b border-sidebar-border">
        <label className="text-[10px] uppercase tracking-wider text-sidebar-muted px-2 mb-1 block">
          Viewing as
        </label>
        <select
          value={currentRole}
          onChange={(e) => setCurrentRole(e.target.value as UserRole)}
          className="w-full rounded-md bg-sidebar-accent text-sidebar-accent-foreground text-xs px-2 py-1.5 border border-sidebar-border focus:outline-none focus:ring-1 focus:ring-sidebar-ring"
        >
          {allRoles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {filteredItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            data-tour={item.tourId}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`
            }
          >
            {item.icon}
            {item.title}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
            {user?.full_name?.split(' ').map((n) => n[0]).join('') || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-accent-foreground">{user?.full_name}</p>
            <p className="truncate text-[10px] text-sidebar-muted">{user?.organization_name}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
