import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useCompetencyLevelStore, getLevelColorClass } from '@/stores/competencyLevelStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronDown, ChevronRight, Play, Shield, Users, User,
  Brain, Network, HelpCircle, ClipboardCheck, BarChart3, CheckCircle, Sparkles,
  SlidersHorizontal, RefreshCw, Database, FileText, Bell, Layers, Award,
  LayoutDashboard, Crown, Gauge,
} from 'lucide-react';

interface GuideStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  steps: string[];
}

const platformOverview: GuideStep[] = [
  {
    title: 'Platform Overview',
    description: 'The Skill Intelligence & Assessment Platform (SIAP) transforms self-declared skills into validated, evidence-based capability profiles through structured assessments and manager reviews.',
    icon: <Sparkles size={16} />,
    steps: [
      'Employees submit self-assessed skill ratings via the Skill Registry — available anytime, with full version history.',
      'Admins design Assessment Templates (adaptive or fixed) that define how skills are tested.',
      'Admins create assessments from a template and assign them to employees.',
      'Adaptive assessments step questions up or down in difficulty based on the employee\'s answers — the achieved level per skill is the highest level answered correctly.',
      'AI evaluates open-ended (scenario / coding) answers across multiple dimensions; MCQs are scored deterministically.',
      'Managers review the achieved level per skill and Approve, Adjust, or request a Reassessment.',
      'Approved levels become the validated registry, visible across the organization in All Registries.',
    ],
  },
];

const navigationGuide: GuideStep[] = [
  {
    title: 'Navigation Structure',
    description: 'The sidebar is organized into four sections for intuitive workflow.',
    icon: <Network size={16} />,
    steps: [
      'Insights — Dashboard and All Registries for monitoring and analytics.',
      'Operations — Skill Registry and Assessments for day-to-day workflow.',
      'Settings — Skill Library, Domains, Users, Question Bank, Assessment Templates, and Assessment Config for platform configuration.',
      'Support — Help & Tutorial for guidance.',
      'Employees see a simplified view with only Operations, Insights, and Support.',
      'Managers see Operations, Settings (limited), and Insights.',
      'Admins see all sections with full access.',
    ],
  },
];

const setupFlowGuide: GuideStep[] = [
  {
    title: 'Setup Flow (Admin)',
    description: 'Follow these steps in order to configure the platform for your organization.',
    icon: <CheckCircle size={16} />,
    steps: [
      'Step 1: Create Skills — Go to Skill Library and add skills organized by categories (with optional Topics for sharper AI questions).',
      'Step 2: Create Domains — Go to Domains and create functional areas (e.g. Frontend Engineering); assign a Domain Lead and managers.',
      'Step 3: Map Skills to Domains — From the Domain detail view, link relevant skills to each domain.',
      'Step 4: Add Questions — Use Question Bank or AI Generation to create MCQ, Coding, and Scenario questions for each skill and competency level.',
      'Step 5: Configure Competency Levels & scoring under Settings → Assessment Config (5-level framework, score ranges, question limits per level).',
      'Step 6: Create an Assessment Template (adaptive or fixed) under Settings → Assessment Templates and pick the skills to be assessed.',
      'Step 7: Create an assessment from a template and assign it to employees from the Assessment Templates page.',
      'Track your progress via the Setup Progress indicator in the sidebar.',
    ],
  },
];

const dashboardOverview: GuideStep[] = [
  {
    title: 'Dashboard Overview',
    description: 'The Dashboard is your role-aware home — it adapts to show the metrics, alerts, and shortcuts that matter to you.',
    icon: <LayoutDashboard size={16} />,
    steps: [
      'Admins, Managers, and Employees each see a different layout — admins get org-wide analytics, managers see team-scoped data, employees see their own progress.',
      'Two persistent banners may appear at the top: "SIAP is in Beta" (early-stage product notice) and "Experimental dashboard" (widgets and metrics may evolve). Dismiss them with the X — they reappear in a new session.',
      'Admins also see a Setup Progress bar (in the sidebar) and a Quick-Start Checklist until the platform is fully configured.',
      'No data entry happens on the dashboard. Every widget is read-only and reflects the current state of your skills, registries, assessments, and reviews.',
      'Data refreshes when the page loads — return to the Dashboard to see the latest numbers.',
    ],
  },
];

const adminGuide: GuideStep[] = [
  {
    title: 'Skill Library',
    description: 'Skills follow a Category → Skill → Topic hierarchy. Categories group skills, and topics optionally refine skill coverage for better AI question generation.',
    icon: <Brain size={16} />,
    steps: [
      'Navigate to Settings > Skill Library from the sidebar.',
      'Create categories first using "Create Category" — these are top-level groupings (e.g. Frontend, Backend).',
      'Click a category row to open it and view its skills.',
      'Inside a category, click "Add Skill" to create a skill with name, description, and tags.',
      'Click a skill row to open the detail drawer and manage optional Topics.',
      'Topics help the AI generate better, more targeted questions — they do not affect scoring.',
      'Use search and filters to find categories, skills, or topics quickly.',
      'Categories cannot be deleted if they contain skills. Skills cannot be deleted if mapped to domains, used in questions, or used in registry.',
    ],
  },
  {
    title: 'Domain Management',
    description: 'Domains represent functional areas such as Frontend Engineering or Product Management.',
    icon: <Network size={16} />,
    steps: [
      'Navigate to Settings > Domains from the sidebar.',
      'Click "Add Domain" to create a new functional domain.',
      'Click a domain to view details and manage skill mappings.',
      'Each skill can belong to multiple domains — skills are reusable.',
    ],
  },
  {
    title: 'Question Bank',
    description: 'Create and manage assessment questions linked to skills, topics, and competency levels. Supports MCQ (single & multi answer), Coding, and Scenario types.',
    icon: <HelpCircle size={16} />,
    steps: [
      'Navigate to Settings > Question Bank from the sidebar.',
      'Click "Add Question" to author manually — pick type (Single/Multi MCQ, Coding, Scenario), skill, topic (optional), and competency level.',
      'For MCQs, mark the correct option(s); MCQs are scored deterministically without AI evaluation guidelines.',
      'For Coding & Scenario questions, provide an evaluation guideline so the AI knows how to grade open-ended answers.',
      'Expand "Generate Questions with AI" to bulk-generate — preview each draft, edit inline, then save accepted ones.',
      'Filters and sorting (latest first) help locate questions quickly; the Coverage Gaps banner flags skill+level combos with too few published questions.',
      'Use quick actions (View, Edit, Duplicate, Publish, Disable, Delete) from the row actions menu.',
      'Publish questions to make them available for assessment generation. Disabled or draft questions are skipped.',
    ],
  },
  {
    title: 'Assessment Templates',
    description: 'Reusable blueprints that define how an assessment is generated and delivered.',
    icon: <FileText size={16} />,
    steps: [
      'Navigate to Settings > Assessment Templates and click "Create Template".',
      'Choose a Type — Adaptive (questions step up/down by level based on answers) or Fixed (static question set).',
      'For Adaptive: select a Domain, set Skills per Assessment, Questions per Skill, allowed Question Types, and Skill Selection Mode (Manual is required; Top-N auto-pick is "Coming Soon").',
      'For Fixed: pick the exact questions and order; toggle shuffle for questions and options.',
      'Set Duration (minutes), Max Attempts (enables re-attempts when > 1), and a clear Name & Description.',
      'Save as Draft while iterating; switch Status to Active to make it available for assignment.',
      'Use the Assignments sheet on a template to assign it to one or many employees — assigned assessments appear in their Assessments list.',
      'Templates can be edited, duplicated, or soft-deleted.',
    ],
  },
  {
    title: 'Assessment Configuration',
    description: 'Configure the 5-level competency framework, score ranges, and per-level question generation limits. Levels and labels are read dynamically from the database — never hardcoded.',
    icon: <SlidersHorizontal size={16} />,
    steps: [
      'Navigate to Settings > Assessment Config.',
      'Edit the 5 competency levels (L1 Beginner → L5 Expert): name, description, and score range (min–max).',
      'Ensure ranges are contiguous and L5 ends at 100 — gaps cause incorrect level resolution.',
      'Configure Question Limits per level — minimum number of published questions per skill+level required to build an assessment.',
      'Configure generation caps — maximum questions per skill+level included when an assessment is built.',
      'Scoring rules update dynamically to reflect your configured score ranges.',
    ],
  },
  {
    title: 'Notifications',
    description: 'Stay informed about registry submissions, assessment activity, and pending reviews.',
    icon: <Bell size={16} />,
    steps: [
      'Open the bell icon in the global header to see recent activity.',
      'Notifications cover: registry submissions, assessment generation, submission, AI evaluation completion, and pending reviews.',
      'Automated reminders are sent to managers for overdue reviews and to employees for pending assessments.',
      'Click a notification to jump directly to the related item.',
    ],
  },
  {
    title: 'All Registries',
    description: 'View organization-wide skill data from submitted registry versions.',
    icon: <Database size={16} />,
    steps: [
      'Navigate to Insights > All Registries.',
      'Toggle between My Registry and Team / All Registry views.',
      'Data is based on the latest submitted version per employee — earlier versions remain in version history.',
      'Filter by domain or search by skill/employee. Trend indicators show movement between versions.',
      'Export registry data as CSV for external reporting.',
    ],
  },
  {
    title: 'Admin Dashboard Widgets',
    description: 'Org-wide analytics for admins. The top filter bar (Domain, Manager, Skill Category) scopes every widget below.',
    icon: <LayoutDashboard size={16} />,
    steps: [
      'Filters bar — Domain, Manager, and Skill Category. Filters apply to every widget on the page; click "Clear" to reset.',
      'KPI: Workforce Coverage — % of employees with at least one approved validated skill. Source: users + approved entries in the validated registry.',
      'KPI: Throughput (30d) — assessments submitted in the last 30 days, with a delta vs the prior 30-day window. Source: assessment_attempts.submitted_at.',
      'KPI: Avg Validated Level — mean approved level across the org (or filtered scope). Source: latest approved registry entries.',
      'KPI: Self vs Validated Gap — average difference between employee self-rating and the manager-validated level. A bias indicator: positive = over-rating, negative = under-rating.',
      'My Attention — actionable counts that need admin follow-up: pending reviews stuck on inactive managers, employees with no domain, domains missing skills/questions/templates.',
      'Domain Readiness — per-domain progress bar across the four setup checks (skills mapped, questions published, templates active, employees ready). Helps spot domains that are not assessment-ready.',
      'Top 5 Skill Strengths — skills with the highest average approved level. Useful for identifying organizational expertise.',
      'Top 5 Skill Gaps — skills with the lowest average approved level. Drives upskilling and hiring decisions.',
      'Self-Rating Bias by Domain — average self-vs-validated delta per domain. Highlights teams that consistently over- or under-rate themselves.',
      'Manager Activity — per-manager review throughput, pending review counts, and average turnaround. Helps spot bottlenecks in the review pipeline.',
      'Skill Heatmap — Domain × Category matrix of average validated level. Click a cell to drill into the underlying skills and employees.',
      'Data input: none directly. Widgets are derived live from registries, assessments, reviews, users, and domains. To improve numbers, complete the Setup Flow and have employees/managers progress through their workflows.',
    ],
  },
];

const managerGuide: GuideStep[] = [
  {
    title: 'Team Registry',
    description: 'View your team members\' skill registry submissions, current versions, and full history.',
    icon: <Users size={16} />,
    steps: [
      'Navigate to Operations > Team Registry from the sidebar.',
      'See each team member\'s current version, total versions, and trend indicators (▲ improvement, ▼ regression).',
      'Click an employee to view their skill self-scores grouped by category, plus the full version history table.',
      'Domain-scoped: you see only employees in domains you manage. Admins see across all domains.',
      'Click Export CSV (Managers and Admins) to download every registry matching your current search and filters — one row per employee and skill, with self rating, manager score, status, completion and average.',
      'You will be notified when a team member submits a new registry version.',
    ],
  },
  {
    title: 'Review Workflow',
    description: 'After employees complete assessments and AI evaluation runs, reviews appear in your Reviews queue.',
    icon: <RefreshCw size={16} />,
    steps: [
      'Navigate to Operations > Reviews from the sidebar to see all pending and completed reviews.',
      'Open an assessment from Team Assessments — the inline Manager Review Panel is shown alongside the per-question results.',
      'Each skill row shows: Self-Rating, Achieved Level (from the assessment), and your action.',
      'Self-approval is blocked — you cannot review your own assessment.',
    ],
  },
  {
    title: 'Approve, Adjust, or Reassess',
    description: 'For each skill you have three explicit actions to finalize the verified level.',
    icon: <Shield size={16} />,
    steps: [
      'Approve — accept the achieved level as the verified level. One click.',
      'Adjust — set a different verified level (up or down). A justification comment is required.',
      'Reassess — request a fresh attempt; the employee is re-issued the assessment for that skill.',
      'Add optional per-skill comments to provide feedback to the employee.',
      'Click "Finalize Review" when every skill has an action — the verified levels are written to the validated registry.',
    ],
  },
  {
    title: 'Manager Dashboard Widgets',
    description: 'Team-scoped overview for managers. All metrics are limited to employees in domains you manage.',
    icon: <LayoutDashboard size={16} />,
    steps: [
      'KPI: Team Size — number of active employees across the domains you manage.',
      'KPI: Pending My Review — assessments waiting for your action. Click through to jump straight into the Reviews queue.',
      'KPI: Team Avg Validated Level — mean approved level across your team. A quick read on overall team capability.',
      'KPI: Reassessments Open — outstanding reassessment requests you have raised that are not yet completed.',
      'Team Skill Matrix — Skill × Employee grid of validated levels. Empty cells mean the skill has not been validated yet for that employee.',
      'Review Queue — shortcut list of pending reviews. Each row links to the assessment with its inline review panel.',
      'Stuck Employees — team members blocked or inactive: missing domain, no recent registry submission, overdue assessment, or open reassessment.',
      'Data input: none directly. Numbers update as your team submits registries, completes assessments, and you finalize reviews.',
    ],
  },
  {
    title: 'Skill Library Management',
    description: 'Managers have full access to the Skill Library and can shape the catalog used across the organization.',
    icon: <Shield size={16} />,
    steps: [
      'Create, edit, disable, or delete Skill Categories.',
      'Add new Skills under any category, edit details, manage tags, and toggle status.',
      'Add, edit, or remove Topics within any skill to refine AI question generation.',
      'Open scope: not restricted to your domain — you can curate library entries used by other domains too.',
      'Safety rules still apply: items in active use (mapped to domains, used in questions) cannot be deleted.',
    ],
  },
  {
    title: 'Domain Lead Powers',
    description: 'When you are set as the Domain Lead of a domain, you gain edit rights on that specific domain.',
    icon: <Crown size={16} />,
    steps: [
      'Edit the domain name, description, and status.',
      'Assign or change the Domain Lead — when you reassign to someone else, you immediately lose edit rights.',
      'Add or remove users from your domain (pick from existing users — only Admins can create new accounts).',
      'Map or unmap skills to your domain via Manage Skills.',
      'You cannot create or delete domains — that remains Admin-only.',
      'Note: when an Admin assigns an Employee as Domain Lead, that user is automatically promoted to the Manager role.',
    ],
  },
];

const employeeGuide: GuideStep[] = [
  {
    title: 'My Skill Registry',
    description: 'Self-assess your skills at any time. Each submission creates a new version for historical tracking.',
    icon: <BarChart3 size={16} />,
    steps: [
      'Navigate to Operations > My Registry from the sidebar.',
      'You must be assigned to a Domain for skills to appear — contact your admin if your registry is empty.',
      'The Skill Registry is always available — submit anytime.',
      'Click "Start Self Review" to create your first version, or "Create New Version" to update.',
      'Skills are grouped by category — rate each on the configured competency scale (e.g. L1 Beginner → L5 Expert).',
      'Your previous version ratings are shown inline for reference (e.g. "Last version: L3").',
      'Optionally add comments per skill to explain your experience.',
      'Drafts auto-save every 2 seconds — look for the "Saving..." / "Saved" indicator.',
      'Submit when all skills are rated — a confirmation dialog shows your ratings summary.',
      'Submitted versions are locked and visible to your manager. You can always create a new version.',
      'Version history is shown in a table below the current registry.',
    ],
  },
  {
    title: 'Taking an Assessment',
    description: 'Complete your generated assessments to validate your self-assessed skills.',
    icon: <ClipboardCheck size={16} />,
    steps: [
      'Navigate to Operations > Assessments and click "Start" on any pending assessment — or jump directly from your Registry.',
      'The exam interface shows a sidebar with question status (answered / unanswered / current), a timer, and direct navigation between questions.',
      'For Adaptive assessments, the next question\'s difficulty adapts to your previous answers — get a level right and you may advance; get it wrong and you stay at the current level.',
      'Answer types vary: Single/Multi-choice MCQs, short Coding snippets, or Scenario responses.',
      'You can revisit any question before submitting (subject to the exam rules).',
      'Submit when done — MCQs score instantly, open-ended answers are evaluated by AI in the background.',
    ],
  },
  {
    title: 'Your Result',
    description: 'After submission, the Assessment Detail page shows a clean, level-based result summary.',
    icon: <Award size={16} />,
    steps: [
      'Open the Assessment from your list to see the Result Summary card.',
      'The summary shows your Achieved Level (e.g. "L3 - Intermediate"), Verified Level (after manager review), and counts of attempted / correct / wrong questions.',
      'A skill-wise breakdown lists the level you reached for each skill assessed.',
      'No percentages or numeric "AI Scores" — the result is expressed purely as a competency level.',
      'Per-question details below show your answer, the correct answer (for MCQs), and AI feedback (for open-ended answers).',
      'Once your manager reviews, the Verified Level appears alongside the Achieved Level — this is what gets written to your validated registry.',
    ],
  },
  {
    title: 'My Dashboard Widgets',
    description: 'Your personal home — progress, pending tasks, and what to do next.',
    icon: <LayoutDashboard size={16} />,
    steps: [
      'KPI: My Registry — current registry state (Draft, Incomplete, Review Pending, or Approved). Click through to open My Registry.',
      'KPI: Skills Assessed — number of skills you have completed an assessment for at least once.',
      'KPI: My Avg Level — your average validated (manager-approved) level across all your skills.',
      'KPI: Open Tasks — combined count of pending assessments and any draft registry waiting for submission.',
      'My Skill Snapshot — your skills grouped by category, showing self-rating vs validated level side by side. Highlights where your perception differs from validated capability.',
      'What\'s next — suggested next actions tailored to your state (e.g. submit your registry, start a pending assessment, review feedback).',
      'Data input: none directly. Numbers update automatically as you submit your registry, take assessments, and your manager completes reviews.',
    ],
  },
];

function GuideSectionCard({ step, defaultOpen = false }: { step: GuideStep; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{step.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-card-foreground">{step.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.description}</p>
        </div>
        {open ? <ChevronDown size={16} className="text-muted-foreground shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{step.description}</p>
          <ol className="space-y-2">
            {step.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold mt-0.5">{i + 1}</span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function CompetencyLevelsCard() {
  const { levels, initialized, loading, fetchLevels } = useCompetencyLevelStore();
  useEffect(() => {
    if (!initialized && !loading) fetchLevels();
  }, [initialized, loading, fetchLevels]);

  const active = levels.filter(l => l.status === 'active').sort((a, b) => a.level - b.level);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Gauge size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-card-foreground">Competency Levels (L1 – L5)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every skill — self-rating, assessment achieved level, and manager-verified level — uses this 5-level scale.
          </p>
        </div>
      </div>
      <div className="p-4">
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Loading competency levels…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-16">Level</th>
                  <th className="text-left px-3 py-2 font-medium">Label</th>
                  <th className="text-left px-3 py-2 font-medium w-28">Score Range</th>
                  <th className="text-left px-3 py-2 font-medium">What it means</th>
                </tr>
              </thead>
              <tbody>
                {active.map((l) => (
                  <tr key={l.id} className="border-t border-border align-top">
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center justify-center h-6 min-w-[2rem] px-2 rounded-md text-[11px] font-semibold ${getLevelColorClass(l.level)}`}>
                        L{l.level}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-foreground font-medium">{l.label}</td>
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                      {l.score_range_min} – {l.score_range_max}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground leading-relaxed">
                      {l.description || <span className="italic">No description</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3 italic">
          Levels and score ranges are configured by admins under Settings → Assessment Config and read live from the database.
        </p>
      </div>
    </div>
  );
}

export default function UserGuidePage() {
  const { currentRole } = useAuth();
  const { restartTour } = useOnboardingStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Help & Tutorial</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive guide for every role — learn how to use the platform effectively.
            The in-app tour is a quick, role-aware walkthrough of the sidebar menu; this User Guide is the source of truth for detailed step-by-step instructions. Press <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px]">Esc</kbd> at any time to exit the tour.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={restartTour}>
          <Play size={12} /> Restart Tour
        </Button>
      </div>


      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-primary" /> How the Platform Works
        </h3>
        <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
          {['Self-Assessment', 'Assigned Assessment', 'AI Evaluation', 'Manager Review', 'Validated Registry'].map((step, i, arr) => (
            <span key={i} className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] bg-card">{step}</Badge>
              {i < arr.length - 1 && <ChevronRight size={12} className="text-muted-foreground" />}
            </span>
          ))}
        </div>
      </div>

      <CompetencyLevelsCard />

      <div className="space-y-3">
        {platformOverview.map((s) => <GuideSectionCard key={s.title} step={s} defaultOpen />)}
        {navigationGuide.map((s) => <GuideSectionCard key={s.title} step={s} />)}
        {dashboardOverview.map((s) => <GuideSectionCard key={s.title} step={s} />)}
        {currentRole === 'admin' && setupFlowGuide.map((s) => <GuideSectionCard key={s.title} step={s} />)}
      </div>

      <Tabs defaultValue={currentRole === 'admin' ? 'admin' : currentRole === 'manager' ? 'manager' : 'employee'}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="admin" className="gap-1.5 text-xs"><Shield size={12} /> Admin / HR Guide</TabsTrigger>
          <TabsTrigger value="manager" className="gap-1.5 text-xs"><Users size={12} /> Manager Guide</TabsTrigger>
          <TabsTrigger value="employee" className="gap-1.5 text-xs"><User size={12} /> Employee Guide</TabsTrigger>
        </TabsList>
        <TabsContent value="admin" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground">Set up the skill framework, manage domains, create questions, and monitor organization-wide analytics.</p>
          {adminGuide.map((s) => <GuideSectionCard key={s.title} step={s} />)}
        </TabsContent>
        <TabsContent value="manager" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground">Review team skill registries, evaluate AI assessments, and approve final skill levels.</p>
          {managerGuide.map((s) => <GuideSectionCard key={s.title} step={s} />)}
        </TabsContent>
        <TabsContent value="employee" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground">Submit your skill self-assessment anytime, take generated assessments, and view feedback.</p>
          {employeeGuide.map((s) => <GuideSectionCard key={s.title} step={s} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
