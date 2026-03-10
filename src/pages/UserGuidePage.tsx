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
    description: 'Create and manage business domains, assign domain leads, and organize functional areas.',
    steps: ['Navigate to Domains', 'Create a new domain', 'Assign a domain lead', 'Add description and configuration'],
    roles: ['Admin', 'HR'],
    status: 'scaffolded',
  },
  {
    title: 'Domain-Skill Mapping',
    module: 'Domain-Skill Mapping',
    description: 'Map skills to domains, set required proficiency levels, and mark mandatory skills.',
    steps: ['Select a domain', 'Browse available skills', 'Map skills to the domain', 'Set required proficiency level', 'Mark skills as mandatory or optional'],
    roles: ['Admin', 'HR', 'Manager', 'Domain Lead'],
    status: 'scaffolded',
  },
  {
    title: 'Question Bank Management',
    module: 'Question Bank',
    description: 'Create and manage assessment questions across different skills, types, and difficulty levels.',
    steps: ['Go to Question Bank', 'Create new questions (MCQ, short answer, scenario-based)', 'Assign skill and difficulty level', 'Add correct answers and rubrics', 'Review and activate questions'],
    roles: ['Admin', 'HR', 'Manager', 'Domain Lead'],
    status: 'scaffolded',
  },
  {
    title: 'AI Question Generation',
    module: 'AI Generation',
    description: 'Use AI to automatically generate assessment questions based on skill definitions.',
    steps: ['Select target skill', 'Choose question type and difficulty', 'Configure generation parameters', 'Generate questions via AI', 'Review and approve generated questions'],
    roles: ['Admin', 'HR', 'Manager', 'Domain Lead'],
    status: 'scaffolded',
  },
  {
    title: 'Assessment Management',
    module: 'Assessments',
    description: 'Create assessments by selecting skills, questions, and configuring assessment parameters.',
    steps: ['Create new assessment', 'Select domain and skills', 'Choose questions from bank', 'Set duration and parameters', 'Publish assessment'],
    roles: ['Admin', 'HR', 'Manager', 'Domain Lead'],
    status: 'scaffolded',
  },
  {
    title: 'Taking Assessments',
    module: 'Assessment Execution',
    description: 'Complete assigned skill assessments with timed questions.',
    steps: ['View assigned assessments', 'Start assessment', 'Answer questions within time limit', 'Submit assessment for evaluation'],
    roles: ['Employee'],
    status: 'scaffolded',
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
    title: 'Skill Registry',
    module: 'Skill Registry',
    description: 'View validated employee skill profiles with proficiency levels and history.',
    steps: ['Browse employee skill profiles', 'View proficiency levels per skill', 'Check assessment history', 'Export skill data'],
    roles: ['Admin', 'HR', 'Manager', 'Domain Lead', 'Employee'],
    status: 'scaffolded',
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
