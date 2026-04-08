import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types/models";
import { useTheme } from "@/hooks/useTheme";
import SetupProgress from "./SetupProgress";
import {
  Brain,
  Network,
  Users,
  HelpCircle,
  Settings2,
  ClipboardCheck,
  BarChart3,
  BookOpen,
  LogOut,
  Moon,
  Sun,
  LayoutDashboard,
  Database,
  FileText,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

const sidebarGroups: SidebarGroup[] = [
  {
    label: "Insights",
    items: [
      { title: "Dashboard", href: "/", icon: <LayoutDashboard size={18} />, roles: ["admin", "manager", "employee"] },
      { title: "All Registries", href: "/all-registries", icon: <Database size={18} />, roles: ["admin"] },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        title: "My Registry",
        href: "/skill-registry",
        icon: <BarChart3 size={18} />,
        roles: ["admin", "manager", "employee"],
      },
      { title: "Team Registry", href: "/team-registry", icon: <Users size={18} />, roles: ["admin", "manager"] },
      {
        title: "My Assessments",
        href: "/assessments",
        icon: <ClipboardCheck size={18} />,
        roles: ["admin", "manager", "employee"],
      },
      {
        title: "Team Assessments",
        href: "/team-assessments",
        icon: <FileText size={18} />,
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Skill Library", href: "/skill-library", icon: <Brain size={18} />, roles: ["admin", "manager"] },
      { title: "Domains", href: "/domains", icon: <Network size={18} />, roles: ["admin", "manager"] },
      { title: "Question Bank", href: "/questions", icon: <HelpCircle size={18} />, roles: ["admin", "manager"] },
      {
        title: "Assessment Config",
        href: "/assessment-config",
        icon: <SlidersHorizontal size={18} />,
        roles: ["admin"],
      },
      { title: "Review Cycles", href: "/review-cycles", icon: <RefreshCw size={18} />, roles: ["admin"] },
      { title: "Users", href: "/users", icon: <Users size={18} />, roles: ["admin"] },
    ],
  },
  {
    label: "Support",
    items: [
      {
        title: "Help & Tutorial",
        href: "/help",
        icon: <BookOpen size={18} />,
        roles: ["admin", "manager", "employee"],
      },
    ],
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
  const { theme, toggleTheme } = useTheme();

  const visibleGroups = sidebarGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(currentRole)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <Brain size={16} className="text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-sidebar-accent-foreground leading-none">SIAP</h1>
          <p className="text-[10px] text-sidebar-muted leading-none mt-0.5">Skill Intelligence Platform</p>
        </div>
      </div>

      {/* Role */}
      <div className="px-5 py-2.5 border-b border-sidebar-border">
        <p className="text-[10px] uppercase tracking-wider text-sidebar-muted">Role</p>
        <p className="text-xs font-medium text-sidebar-accent-foreground mt-0.5">{roleLabels[currentRole]}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleGroups.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <div className="mx-4 my-2 border-t border-sidebar-border" />}
            <div className="px-5 pt-2 pb-1">
              <span className="text-[10px] uppercase tracking-wider text-sidebar-muted font-medium">{group.label}</span>
            </div>
            <div className="px-2 space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
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
            </div>

            {/* Setup progress under Settings group for admin */}
            {group.label === "Settings" && currentRole === "admin" && <SetupProgress />}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border">
        {/* Theme toggle */}
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] text-sidebar-muted">Theme</span>
          <button
            onClick={toggleTheme}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>

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
      </div>
    </aside>
  );
}
