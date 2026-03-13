import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types/models";
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
  Shield,
  Users,
  LogOut,
} from "lucide-react";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
  tourId?: string;
}

const sidebarItems: SidebarItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: <LayoutDashboard size={18} />,
    roles: ["admin", "manager", "employee"],
    tourId: "dashboard",
  },
  {
    title: "Skill Analytics",
    href: "/skill-analytics",
    icon: <Shield size={18} />,
    roles: ["admin"],
    tourId: "skill-analytic",
  },
  {
    title: "Organization",
    href: "/organization",
    icon: <Building2 size={18} />,
    roles: ["admin"],
    tourId: "organization",
  },
  {
    title: "Skill Framework",
    href: "/skills",
    icon: <Brain size={18} />,
    roles: ["admin", "manager"],
    tourId: "skills",
  },
  { title: "Domains", href: "/domains", icon: <Network size={18} />, roles: ["admin", "manager"], tourId: "domains" },
  // { title: 'Domain-Skill Map', href: '/domain-skills', icon: <Link2 size={18} />, roles: ['admin', 'manager'], tourId: 'domain-skills' },
  {
    title: "Question Bank",
    href: "/questions",
    icon: <HelpCircle size={18} />,
    roles: ["admin", "manager"],
    tourId: "questions",
  },
  {
    title: "AI Generation",
    href: "/ai-generate",
    icon: <FileText size={18} />,
    roles: ["admin", "manager"],
    tourId: "ai-generate",
  },
  {
    title: "Skill Registry",
    href: "/registry",
    icon: <BarChart3 size={18} />,
    roles: ["admin", "manager", "employee"],
    tourId: "registry",
  },
  {
    title: "Assessments",
    href: "/assessments",
    icon: <ClipboardCheck size={18} />,
    roles: ["admin", "manager", "employee"],
    tourId: "assessments",
  },
  {
    title: "Take Assessment",
    href: "/assessment-exec",
    icon: <Play size={18} />,
    roles: ["employee"],
    tourId: "assessment-exec",
  },
  // { title: 'Reviews', href: '/reviews', icon: <CheckCircle size={18} />, roles: ['manager'], tourId: 'reviews' },
  { title: "Users", href: "/users", icon: <Users size={18} />, roles: ["admin"], tourId: "users" },
  {
    title: "User Guide",
    href: "/guide",
    icon: <BookOpen size={18} />,
    roles: ["admin", "manager", "employee"],
    tourId: "guide",
  },
];

const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  manager: "Manager",
  employee: "Employee",
};

export default function AppSidebar() {
  const { user, currentRole, logout } = useAuth();
  const location = useLocation();

  const filteredItems = sidebarItems.filter((item) => item.roles.includes(currentRole));

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

      {/* Role display */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <p className="text-[10px] uppercase tracking-wider text-sidebar-muted">Role</p>
        <p className="text-xs font-medium text-sidebar-accent-foreground mt-0.5">{roleLabels[currentRole]}</p>
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
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
            {user?.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("") || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-accent-foreground">{user?.full_name}</p>
            <p className="truncate text-[10px] text-sidebar-muted">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
