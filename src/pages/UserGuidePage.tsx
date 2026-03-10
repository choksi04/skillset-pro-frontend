import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronDown, ChevronRight, Play, Shield, Users, User,
  Brain, Network, HelpCircle, ClipboardCheck, BarChart3, CheckCircle, Sparkles,
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
      'Employees submit self-assessed skill ratings via the Skill Registry.',
      'The system automatically generates tailored assessments based on self-ratings.',
      'AI evaluates answers across multiple dimensions (concept understanding, technical correctness, practicality, clarity).',
      'Managers review AI evaluations, compare with self-ratings, and approve final skill levels.',
      'Official validated skill entries are recorded in the final Skill Registry.',
    ],
  },
];

const adminGuide: GuideStep[] = [
  { title: 'Skill Framework', description: 'Skills are reusable building blocks representing capabilities like React, System Design, or Communication.', icon: <Brain size={16} />, steps: ['Navigate to Skill Framework from the sidebar.', 'Click "Add Skill" to create a new skill with name, description, and category.', 'Skills are organized by categories (Technology, Core Engineering, Architecture, PMO, Soft Skills).', 'Toggle skill status between active and disabled as needed.'] },
  { title: 'Domain Management', description: 'Domains represent functional areas such as Frontend Engineering or Product Management.', icon: <Network size={16} />, steps: ['Navigate to Domains from the sidebar.', 'Click "Add Domain" to create a new functional domain.', 'Go to Domain-Skill Mapping to link skills to domains.', 'Each skill can belong to multiple domains — skills are reusable.'] },
  { title: 'Question Bank', description: 'Questions are linked to skills and competency levels. They form the basis of assessments.', icon: <HelpCircle size={16} />, steps: ['Navigate to Question Bank from the sidebar.', 'Create questions manually with skill, competency level, type, and evaluation guidelines.', 'Use AI Generation to auto-generate questions for any skill and level.', 'Publish questions to make them available for assessments.'] },
  { title: 'Assessment Cycles', description: 'Assessments are auto-generated when employees submit their skill registry.', icon: <ClipboardCheck size={16} />, steps: ['Assessments appear automatically once an employee submits their Skill Registry.', 'View all assessments, their status, and assigned questions in Assessment Management.', 'Track completion rates and pending reviews from the HR Dashboard.'] },
  { title: 'HR Dashboard & Reports', description: 'View organization-wide analytics, validated skill data, and assessment pipeline tracking.', icon: <BarChart3 size={16} />, steps: ['Navigate to HR Dashboard (requires HR or Admin role).', 'View the Skill Registry tab for all validated skill entries.', 'Check the Distribution tab for skill level charts by domain and skill.', 'Monitor Assessment Tracking for pipeline status.', 'Export registry data as CSV for external reporting.'] },
];

const managerGuide: GuideStep[] = [
  { title: 'Review Assessments', description: 'After employees complete assessments and AI evaluation runs, reviews appear in your Manager Reviews dashboard.', icon: <CheckCircle size={16} />, steps: ['Navigate to Reviews from the sidebar (requires Manager or Domain Lead role).', 'Pending reviews show employee name, domain, skill count, and AI score.', 'Expand a review to see the skill comparison table.'] },
  { title: 'Compare Ratings', description: 'Each skill shows the employee self-rating alongside the AI-calculated assessment level.', icon: <BarChart3 size={16} />, steps: ['Review the Self Rating column (what the employee claimed).', 'Compare with the AI Assessment column (score and calculated level).', 'View detailed AI feedback by clicking "View AI Feedback Details".'] },
  { title: 'Take Action', description: 'For each skill, approve the AI rating, adjust it, or request reassessment.', icon: <Shield size={16} />, steps: ['Click "Approve" to accept the AI-calculated level as-is.', 'Click "Adjust" to set a different level based on your knowledge.', 'Click "Reassess" to flag a skill for re-evaluation.', 'Add per-skill comments for context.', 'Click "Finalize Review" to generate official registry entries.'] },
];

const employeeGuide: GuideStep[] = [
  { title: 'Submit Skill Registry', description: 'Start the validation process by rating your proficiency in skills assigned to your domain.', icon: <BarChart3 size={16} />, steps: ['Navigate to Skill Registry from the sidebar.', 'You\'ll see skills mapped to your assigned domain.', 'Rate each skill on a 1-5 scale (Basic Awareness to Expert).', 'Save as draft or submit when ready — submitted ratings trigger assessment generation.'] },
  { title: 'Take Assessments', description: 'Complete your generated assessments to validate your self-assessed skills.', icon: <ClipboardCheck size={16} />, steps: ['Navigate to Take Assessment from the sidebar.', 'Click "Start Assessment" on any pending assessment.', 'Answer all questions within the time limit.', 'Use the question navigator to jump between questions.', 'Submit when done — AI evaluation runs automatically.'] },
  { title: 'View Feedback', description: 'After submission, review your AI-generated feedback and scores.', icon: <Sparkles size={16} />, steps: ['Click "View Results" on a completed assessment.', 'See your overall AI score and per-skill breakdown.', 'Expand individual questions to see dimension-level feedback.', 'Your validated skill levels will appear after manager review.'] },
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

export default function UserGuidePage() {
  const { currentRole } = useAuth();
  const { restartTour } = useOnboardingStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Comprehensive guide for every role — learn how to use the platform effectively.</p>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={restartTour}>
          <Play size={12} /> Restart Tour
        </Button>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-primary" /> How the Platform Works
        </h2>
        <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
          {['Self-Assessment', 'Auto-Generated Assessment', 'AI Evaluation', 'Manager Review', 'Validated Registry'].map((step, i, arr) => (
            <span key={i} className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] bg-card">{step}</Badge>
              {i < arr.length - 1 && <ChevronRight size={12} className="text-muted-foreground" />}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {platformOverview.map((s) => <GuideSectionCard key={s.title} step={s} defaultOpen />)}
      </div>

      <Tabs defaultValue={currentRole === 'admin' || currentRole === 'hr' ? 'admin' : currentRole === 'manager' || currentRole === 'domain_lead' ? 'manager' : 'employee'}>
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
          <p className="text-xs text-muted-foreground">Review AI-evaluated assessments, compare ratings, and approve final skill levels.</p>
          {managerGuide.map((s) => <GuideSectionCard key={s.title} step={s} />)}
        </TabsContent>
        <TabsContent value="employee" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground">Submit your skill self-assessment, take generated assessments, and view feedback.</p>
          {employeeGuide.map((s) => <GuideSectionCard key={s.title} step={s} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
  description: string;
  steps: string[];
  roles: string[];
  status: 'scaffolded' | 'implemented' | 'planned';
}

const guideSections: GuideSection[] = [
  {
    title: 'Dashboard Overview',
    module: 'Dashboard',
    description: 'The main dashboard provides a high-level overview of skill intelligence metrics, recent activity, and action items based on your role.',
    steps: ['Log in to the platform', 'View stat cards for key metrics', 'Check recent activity feed', 'Review action items requiring attention'],
    roles: ['Admin', 'HR', 'Manager', 'Domain Lead', 'Employee'],
    status: 'implemented',
  },
  {
    title: 'Organization Setup',
    module: 'Organization Setup',
    description: 'Configure your organization\'s structure including departments, teams, and basic settings.',
    steps: ['Navigate to Organization from the sidebar', 'Enter organization details', 'Add departments and teams', 'Configure tenant settings'],
    roles: ['Admin', 'HR'],
    status: 'scaffolded',
  },
  {
    title: 'Skill Framework Management',
    module: 'Skill Framework',
    description: 'Manage reusable skills as independent entities with categories. Skills can be mapped to multiple domains. Admins can create, edit, disable skills and assign categories (Technology, Core Engineering, Architecture, PMO, Soft Skills). Includes search, filtering by category/status, and stat cards.',
    steps: [
      'Navigate to Skill Framework from the sidebar',
      'View skill stats (total, active, disabled, categories)',
      'Click "Add Skill" to create a new skill',
      'Enter skill name, description, and select a category',
      'Use search bar or category/status filters to find skills',
      'Click the pencil icon to edit a skill',
      'Click the toggle icon to disable/enable a skill',
      'Use the category chips at the bottom to quick-filter by category',
    ],
    roles: ['Admin (full CRUD)', 'HR (full CRUD)', 'Manager (view only)', 'Domain Lead (view only)'],
    status: 'implemented',
  },
  {
    title: 'Domain Management',
    module: 'Domains',
    description: 'Create and manage functional domains (e.g. Frontend Engineering, Backend Engineering, QA, Product Management). Domains do not own skills — instead, skills are linked via the Domain-Skill Mapping. Admins can create, edit, and disable domains.',
    steps: [
      'Navigate to Domains from the sidebar',
      'View domain stats (total, active, mappings, avg skills/domain)',
      'Click "Add Domain" to create a new domain',
      'Enter domain name and description',
      'Click the link icon to manage skill mappings for a domain',
      'Click the pencil icon to edit a domain',
      'Click the toggle icon to disable/enable a domain',
    ],
    roles: ['Admin (full CRUD)', 'HR (full CRUD)', 'Manager (view only)', 'Domain Lead (view only)'],
    status: 'implemented',
  },
  {
    title: 'Domain-Skill Mapping',
    module: 'Domain-Skill Mapping',
    description: 'Map reusable skills to domains using a many-to-many relationship (DomainSkillMap). Skills can appear in multiple domains. The mapping overview page shows all domain-skill relationships as cards. Manage mappings from the Domains page via the link icon.',
    steps: [
      'Go to Domains page and click the link icon on a domain',
      'In the dialog, check/uncheck skills to map or remove them',
      'Skills are grouped by category for easy browsing',
      'Mapped skills appear as badges with an X to quick-remove',
      'View the Domain-Skill Map page for a read-only overview of all mappings',
    ],
    roles: ['Admin (manage mappings)', 'HR (manage mappings)', 'Manager (view only)', 'Domain Lead (view only)'],
    status: 'implemented',
  },
  {
    title: 'Question Bank Management',
    module: 'Question Bank',
    description: 'Full CRUD for assessment questions. Questions belong to skills and competency levels (Beginner/Intermediate/Advanced/Expert). Supports three question types: Scenario, Coding, and MCQ. Questions include evaluation guidelines for assessors. Expandable card UI with filtering by skill, level, type, and status. Admin can create, edit, publish, and disable questions.',
    steps: [
      'Navigate to Question Bank from the sidebar',
      'View stats (total, published, draft, AI-generated)',
      'Use filters to search by skill, level, type, or status',
      'Click "Add Question" to create manually',
      'Fill in skill, competency level, type, question text, and evaluation guidelines',
      'Click a question card to expand and see full details',
      'Use Edit, Publish, or Disable buttons on expanded cards',
      'Draft questions must be published before they appear in assessments',
    ],
    roles: ['Admin (full CRUD + publish)', 'HR (full CRUD + publish)', 'Manager (view only)', 'Domain Lead (view only)'],
    status: 'implemented',
  },
  {
    title: 'AI Question Generation',
    module: 'AI Generation',
    description: 'Generate assessment questions using AI (currently template-based; connects to real AI providers via Lovable Cloud). Accepts skill, competency level, question type, number of questions, and organization context to generate relevant scenario-based questions. All generated questions go into "Draft" status and require admin review before publishing.',
    steps: [
      'Navigate to AI Generation from the sidebar',
      'Select target skill, competency level, and question type',
      'Enter organization context (e.g., "builds internal back-office portals")',
      'Choose number of questions (1-10)',
      'Click "Generate Questions"',
      'Review generated questions — check/uncheck to accept or reject each',
      'Click "Save as Draft" to add accepted questions to Question Bank',
      'Navigate to Question Bank to publish approved drafts',
    ],
    roles: ['Admin (generate + review)', 'HR (generate + review)'],
    status: 'implemented',
  },
  {
    title: 'Assessment Management (Auto-Generated)',
    module: 'Assessments',
    description: 'Assessments are automatically generated when employees submit their skill registry. For each claimed skill, questions are selected from the bank at the employee\'s self-rated level, one level below, and optionally two levels below (e.g., claiming Level 4 pulls questions from Intermediate, Advanced levels). Questions are randomly selected and grouped by skill.',
    steps: [
      'Employee submits skill self-assessment from Skill Registry page',
      'System auto-generates assessment with questions matching claimed levels',
      'View generated assessments on the Assessments page',
      'See question breakdown grouped by skill with competency level tags',
      'If no questions match, a message prompts adding more to the Question Bank',
    ],
    roles: ['Admin/HR/Manager (view all assessments)', 'Employee (view own assessments)'],
    status: 'implemented',
  },
  {
    title: 'Taking Assessments',
    module: 'Assessment Execution',
    description: 'Timed assessment interface for employees. Supports three question types: MCQ (radio buttons), Scenario (text area), and Coding (monospaced text area). Features countdown timer, question navigation grid, answer tracking, and auto-submit on timeout. Submission triggers AI evaluation which scores each answer and provides feedback.',
    steps: [
      'Navigate to "Take Assessment" from the sidebar (Employee role)',
      'View list of assigned assessments with skill and duration info',
      'Click "Start Assessment" to begin the timed session',
      'Use question navigator (left panel) to jump between questions',
      'For MCQ: select one option from the radio buttons',
      'For Scenario/Coding: type your answer in the text area',
      'Green indicators show answered questions in the navigator',
      'Click Previous/Next to navigate sequentially',
      'Click "Submit" when done — confirms if questions are unanswered',
      'Assessment auto-submits when timer runs out',
      'AI evaluation runs automatically and shows scores on completion',
    ],
    roles: ['Employee (take assessments)'],
    status: 'implemented',
  },
  {
    title: 'AI Answer Evaluation',
    module: 'AI Evaluation',
    description: 'When an employee submits an assessment, AI automatically evaluates each answer across 4 structured dimensions: Concept Understanding, Technical Correctness, Solution Practicality, and Clarity. Each dimension receives an individual score (0-100) with a specific comment. MCQ answers are scored as correct/incorrect. The overall score is the average of all question scores. Results include per-question feedback and confidence levels.',
    steps: [
      'Employee completes and submits an assessment',
      'AI evaluation runs automatically on submission',
      'Each answer is scored on 4 dimensions (0-100 each)',
      'Overall score is computed as the average',
      'Structured feedback is generated per question',
      'Click "View Results" on a completed assessment to see full breakdown',
      'See dimension averages in the summary chart',
      'Expand individual questions to view answer, feedback, and dimension scores',
      'Results are marked "Pending Manager Review" for final approval',
    ],
    roles: ['Employee (view own results)', 'Admin/HR/Manager (view in reviews)'],
    status: 'implemented',
  },
  {
    title: 'Manager Review Workflow',
    module: 'Reviews',
    description: 'Review AI-evaluated assessment results, adjust scores, and approve validations.',
    steps: ['View pending reviews', 'Examine AI evaluation and scores', 'Adjust scores if needed', 'Add comments', 'Approve or request revision'],
    roles: ['Manager', 'Domain Lead'],
    status: 'scaffolded',
  },
  {
    title: 'Skill Registry — Employee Self-Assessment',
    module: 'Skill Registry',
    description: 'Employees see skills assigned to their domain and submit self-ratings (Level 1: Basic Awareness → Level 5: Expert). Submissions are locked per cycle after submission, and an assessment is auto-generated. Admin/HR/Manager view shows all submissions across the organization.',
    steps: [
      'Switch to Employee role to see self-assessment view',
      'View skills mapped to your assigned domain',
      'Rate each skill using the 5-level rating scale',
      'Click "Save Draft" to save progress without locking',
      'Click "Submit & Generate Assessment" when all skills are rated',
      'Review ratings in the confirmation dialog',
      'Click "Confirm & Lock" — ratings are locked and assessment is generated',
      'Navigate to "Take Assessment" to complete skill validation',
    ],
    roles: ['Employee (self-assess + submit)', 'Admin/HR/Manager (view all submissions)'],
    status: 'implemented',
  },
  {
    title: 'HR Dashboard',
    module: 'HR Dashboard',
    description: 'Organization-wide analytics on skill coverage, gaps, and workforce capabilities.',
    steps: ['View organization skill coverage', 'Identify skill gaps', 'Review department comparisons', 'Export reports'],
    roles: ['Admin', 'HR'],
    status: 'scaffolded',
  },
];

const statusColors: Record<string, string> = {
  implemented: 'bg-success/10 text-success',
  scaffolded: 'bg-info/10 text-info',
  planned: 'bg-muted text-muted-foreground',
};

export default function UserGuidePage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={20} className="text-primary" />
          <h2 className="text-2xl font-semibold text-foreground">User Guide</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Comprehensive guide for all SIAP platform features. This documentation is automatically
          synchronized with implemented features.
        </p>
      </div>

      {/* Legend */}
      <div className="flex gap-3">
        {['implemented', 'scaffolded', 'planned'].map((status) => (
          <span key={status} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status]}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {guideSections.map((section) => (
          <details key={section.module} className="group rounded-xl border border-border bg-card overflow-hidden">
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <ChevronRight size={16} className="text-muted-foreground transition-transform group-open:rotate-90" />
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">{section.title}</h3>
                  <p className="text-xs text-muted-foreground">{section.module}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusColors[section.status]}`}>
                {section.status}
              </span>
            </summary>
            <div className="border-t border-border px-5 py-4 space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Description</h4>
                <p className="text-sm text-foreground">{section.description}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Steps</h4>
                <ol className="list-decimal list-inside space-y-1">
                  {section.steps.map((step, i) => (
                    <li key={i} className="text-sm text-foreground">{step}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Roles</h4>
                <div className="flex flex-wrap gap-1.5">
                  {section.roles.map((role) => (
                    <span key={role} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Screenshots</h4>
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                  📷 Screenshot placeholder — will be added when feature is fully implemented
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
