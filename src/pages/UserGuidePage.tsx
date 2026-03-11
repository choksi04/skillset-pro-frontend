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
  {
    title: 'Skill Framework & Categories',
    description: 'Skills are reusable building blocks organized into categories with tags for easy filtering.',
    icon: <Brain size={16} />,
    steps: [
      'Navigate to Skill Framework from the sidebar.',
      'Create categories first using "Manage Categories" — categories group related skills (e.g. Programming Languages, Frameworks).',
      'Click "Add Skill" to create a new skill with category, name, description, and tags (e.g. frontend, backend, common).',
      'Skills are displayed grouped by category in collapsible accordion sections.',
      'Filter skills by category, tag, or status using the toolbar dropdowns.',
      'Toggle skill status, edit, or soft-delete skills from the action menu.',
      'Delete a category only after removing or reassigning all its skills.',
    ],
  },
  {
    title: 'Domain Management',
    description: 'Domains represent functional areas such as Frontend Engineering or Product Management.',
    icon: <Network size={16} />,
    steps: [
      'Navigate to Domains from the sidebar.',
      'Click "Add Domain" to create a new functional domain.',
      'Go to Domain-Skill Mapping to link skills to domains.',
      'Each skill can belong to multiple domains — skills are reusable.',
    ],
  },
  {
    title: 'Question Bank',
    description: 'Questions are linked to skills and competency levels. The form adapts based on question type.',
    icon: <HelpCircle size={16} />,
    steps: [
      'Navigate to Question Bank from the sidebar.',
      'Click "Add Question" and select a question type: Scenario, Coding, or MCQ.',
      'For Scenario: provide question text and evaluation guidelines.',
      'For MCQ: provide question text, 4 options, and select the correct answer via radio button.',
      'For Coding: provide a problem statement and optional example input/output.',
      'The form dynamically shows/hides fields based on the selected question type.',
      'Use AI Generation to auto-generate questions for any skill and level.',
      'Publish questions to make them available for assessments.',
    ],
  },
  {
    title: 'Assessment Cycles',
    description: 'Assessments are auto-generated when employees submit their skill registry.',
    icon: <ClipboardCheck size={16} />,
    steps: [
      'Assessments appear automatically once an employee submits their Skill Registry.',
      'The system selects published questions matching the employee\'s submitted skills.',
      'View all assessments, their status, and assigned questions in Assessment Management.',
      'Track completion rates and pending reviews from the HR Dashboard.',
    ],
  },
  {
    title: 'HR Dashboard & Reports',
    description: 'View organization-wide analytics, validated skill data, and assessment pipeline tracking.',
    icon: <BarChart3 size={16} />,
    steps: [
      'Navigate to HR Dashboard (requires HR or Admin role).',
      'View the Skill Registry tab for all validated skill entries.',
      'Check the Distribution tab for skill level charts by domain and skill.',
      'Monitor Assessment Tracking for pipeline status.',
      'Export registry data as CSV for external reporting.',
    ],
  },
];

const managerGuide: GuideStep[] = [
  {
    title: 'Review Assessments',
    description: 'After employees complete assessments and AI evaluation runs, reviews appear in your Manager Reviews dashboard.',
    icon: <CheckCircle size={16} />,
    steps: [
      'Navigate to Reviews from the sidebar (requires Manager or Domain Lead role).',
      'Pending reviews show employee name, domain, skill count, AI score, and submission timestamp.',
      'Expand a review to see the skill comparison table.',
    ],
  },
  {
    title: 'Compare Ratings',
    description: 'Each skill shows the employee self-rating alongside the AI-calculated assessment level.',
    icon: <BarChart3 size={16} />,
    steps: [
      'Review the Self Rating column (what the employee claimed).',
      'Compare with the AI Assessment column (score and calculated level).',
      'View detailed AI feedback by clicking "View AI Feedback Details".',
    ],
  },
  {
    title: 'Take Action',
    description: 'For each skill, approve the AI rating, adjust it, or request reassessment.',
    icon: <Shield size={16} />,
    steps: [
      'Click "Approve" to accept the AI-calculated level as-is.',
      'Click "Adjust" to set a different level based on your knowledge.',
      'Click "Reassess" to flag a skill for re-evaluation.',
      'Add per-skill comments for context.',
      'Click "Finalize Review" to generate official registry entries.',
    ],
  },
];

const employeeGuide: GuideStep[] = [
  {
    title: 'Submit Skill Registry',
    description: 'Rate your proficiency in skills grouped by category with progress tracking per section.',
    icon: <BarChart3 size={16} />,
    steps: [
      'Navigate to Skill Registry from the sidebar.',
      'You\'ll see skills grouped by category in collapsible sections (e.g. Frontend Skills, Backend Skills).',
      'Each category header shows a progress bar (e.g. "3/5 rated") so you can track completion.',
      'Use the search bar at the top to filter skills by name or tag.',
      'Hover over the info icon next to a skill name to see its description.',
      'Rate each skill on a 1-5 scale (Basic Awareness to Expert).',
      'Save as draft to continue later — your ratings are preserved.',
      'Submit when all skills are rated — this locks your ratings and triggers assessment generation.',
    ],
  },
  {
    title: 'Take Assessments',
    description: 'Complete your generated assessments to validate your self-assessed skills.',
    icon: <ClipboardCheck size={16} />,
    steps: [
      'Navigate to Take Assessment from the sidebar.',
      'Click "Start Assessment" on any pending assessment.',
      'Answer all questions within the time limit.',
      'Question types include Scenario (free-text), MCQ (select one), and Coding (write code).',
      'Use the question navigator to jump between questions.',
      'Submit when done — AI evaluation runs automatically.',
    ],
  },
  {
    title: 'View Feedback',
    description: 'After submission, review your AI-generated feedback and scores.',
    icon: <Sparkles size={16} />,
    steps: [
      'Click "View Results" on a completed assessment.',
      'See your overall AI score and per-skill breakdown.',
      'Expand individual questions to see dimension-level feedback.',
      'Your validated skill levels will appear after manager review.',
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
