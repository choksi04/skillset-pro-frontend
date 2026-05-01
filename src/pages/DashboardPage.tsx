import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ArrowRight,
  ClipboardList,
  ClipboardCheck,
  Users,
  Brain,
  Network,
  FileQuestion,
  LayoutTemplate,
  BarChart3,
  BookOpen,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@/types/models";

interface ModuleLink {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  roles: UserRole[];
}

const MODULES: ModuleLink[] = [
  {
    title: "Skill Registry",
    description: "Self-rate your skills and track your validated registry over time.",
    to: "/skill-registry",
    icon: ClipboardList,
    roles: ["admin", "manager", "employee"],
  },
  {
    title: "My Assessments",
    description: "Take pending assessments and review evaluated results.",
    to: "/assessments",
    icon: ClipboardCheck,
    roles: ["admin", "manager", "employee"],
  },
  {
    title: "Team Registry",
    description: "Review and approve skill registries submitted by your team.",
    to: "/team-registry",
    icon: Users,
    roles: ["admin", "manager"],
  },
  {
    title: "Team Assessments",
    description: "Monitor assessments assigned across your team.",
    to: "/team-assessments",
    icon: ClipboardCheck,
    roles: ["admin", "manager"],
  },
  {
    title: "Manager Reviews",
    description: "Approve, adjust, or request reassessment for completed evaluations.",
    to: "/manager-reviews",
    icon: ShieldCheck,
    roles: ["admin", "manager"],
  },
  {
    title: "Skill Library",
    description: "Manage skill categories, skills, and topics across the organization.",
    to: "/skill-library",
    icon: Brain,
    roles: ["admin", "manager"],
  },
  {
    title: "Domains",
    description: "Configure functional domains and map skills to them.",
    to: "/domains",
    icon: Network,
    roles: ["admin", "manager"],
  },
  {
    title: "Question Bank",
    description: "Author and curate AI-assisted questions linked to skills.",
    to: "/questions",
    icon: FileQuestion,
    roles: ["admin", "manager"],
  },
  {
    title: "Assessment Templates",
    description: "Build reusable templates and assign them to employees.",
    to: "/assessment-templates",
    icon: LayoutTemplate,
    roles: ["admin", "manager"],
  },
  {
    title: "All Registries",
    description: "Organization-wide view of skill registries and analytics.",
    to: "/all-registries",
    icon: BarChart3,
    roles: ["admin"],
  },
];

function ModuleCard({ module, onOpen }: { module: ModuleLink; onOpen: (to: string) => void }) {
  const Icon = module.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(module.to)}
      className="group text-left"
    >
      <Card className="h-full transition hover:border-primary/40 hover:shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-card-foreground">{module.title}</h3>
                <ArrowRight
                  size={14}
                  className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {module.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export default function DashboardPage() {
  const { currentRole, user } = useAuth();
  const navigate = useNavigate();

  const visibleModules = useMemo(
    () => MODULES.filter((m) => m.roles.includes(currentRole)),
    [currentRole],
  );

  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div className="space-y-8" data-tour="dashboard">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Welcome back{firstName ? `, ${firstName}` : ""}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your skill intelligence workspace.
        </p>
      </div>

      {/* Coming Soon hero */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-card-foreground">
                  Dashboard — Coming Soon
                </h3>
                <Badge variant="secondary" className="text-[11px]">
                  In design
                </Badge>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                We're crafting a focused dashboard with the insights that matter most —
                skill coverage, assessment progress, and review activity at a glance.
                In the meantime, the platform is fully usable. Jump into any of the
                modules below to get started, or open the{" "}
                <button
                  type="button"
                  onClick={() => navigate("/help")}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  User Guide
                </button>{" "}
                to learn more.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available modules */}
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Explore what's available today
            </h3>
            <p className="text-xs text-muted-foreground">
              Curated for your role · {currentRole}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((m) => (
            <ModuleCard key={m.to} module={m} onOpen={navigate} />
          ))}
        </div>
      </div>

      {/* Footer help line */}
      <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
        <BookOpen size={14} />
        <span>
          Need a tour of the platform?{" "}
          <button
            type="button"
            onClick={() => navigate("/help")}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Open the User Guide
          </button>
        </span>
      </div>
    </div>
  );
}
