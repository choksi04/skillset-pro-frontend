import { BookOpen, ChevronRight } from 'lucide-react';

interface GuideSection {
  title: string;
  module: string;
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
