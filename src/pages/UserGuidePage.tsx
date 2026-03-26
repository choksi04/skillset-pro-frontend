import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronDown, ChevronRight, Play, Shield, Users, User,
  Brain, Network, HelpCircle, ClipboardCheck, BarChart3, CheckCircle, Sparkles,
  SlidersHorizontal, RefreshCw, Database,
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
      'Official validated skill entries are recorded in the All Registries view.',
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
      'Settings — Skill Library, Domains, Users, Questions, and Review Cycles for platform configuration.',
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
      'Step 1: Create Skills — Go to Skill Library and add skills organized by categories.',
      'Step 2: Create Domains — Go to Domains and create functional areas (e.g. Frontend Engineering).',
      'Step 3: Map Skills to Domains — From Domain detail view, link relevant skills to each domain.',
      'Step 4: Add Questions — Go to Question Bank or use AI Generation to create assessment questions for each skill and level.',
      'Step 5: Start Cycle — Employees can now submit their Skill Registry, triggering the assessment pipeline.',
      'Track your progress via the Setup Progress indicator in the sidebar Settings section.',
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
    description: 'Create and manage assessment questions linked to skills, topics, and competency levels. Supports manual creation and AI generation.',
    icon: <HelpCircle size={16} />,
    steps: [
      'Navigate to Settings > Question Bank from the sidebar.',
      'Click "Add Question" to open the creation form — select a question type (Scenario, MCQ, or Coding) and the form adapts dynamically.',
      'Optionally link questions to a Topic under the selected Skill for better targeting.',
      'Expand "Generate Questions with AI" to auto-generate questions for any skill, topic, and level with organizational context.',
      'Review AI-generated questions, accept or reject each, then save accepted ones as drafts.',
      'Monitor the "Question Coverage Gaps" indicator to identify skills lacking minimum questions per level.',
      'Use quick actions (View, Edit, Duplicate, Publish, Disable, Delete) from the actions menu on each question row.',
      'Publish questions to make them available for assessments. Only unused questions can be deleted.',
    ],
  },
  {
    title: 'Question Settings',
    description: 'Configure competency levels, score ranges, and minimum question requirements.',
    icon: <SlidersHorizontal size={16} />,
    steps: [
      'Navigate to Settings > Question Settings.',
      'View and edit the 5 competency levels (L1–L5) — click the pencil icon on any level card.',
      'Configure score ranges (e.g. 0–39 for L1) and minimum questions per skill+level.',
      'Understand the 3 question types and how they are evaluated.',
      'Review scoring rules that dynamically reflect your configured score ranges.',
    ],
  },
  {
    title: 'All Registries',
    description: 'View organization-wide validated skill data and export for reporting.',
    icon: <Database size={16} />,
    steps: [
      'Navigate to Insights > All Registries.',
      'Filter by domain or search by skill/employee.',
      'Export registry data as CSV for external reporting.',
    ],
  },
];

const managerGuide: GuideStep[] = [
  {
    title: 'Review Cycles',
    description: 'After employees complete assessments and AI evaluation runs, reviews appear in Review Cycles.',
    icon: <RefreshCw size={16} />,
    steps: [
      'Navigate to Settings > Review Cycles from the sidebar.',
      'Pending reviews show employee name, domain, skill count, and AI score.',
      'Expand a review to see the skill comparison table.',
    ],
  },
  {
    title: 'Compare & Approve',
    description: 'Each skill shows the employee self-rating alongside the AI-calculated assessment level.',
    icon: <Shield size={16} />,
    steps: [
      'Review the Self Rating vs AI Assessment columns.',
      'Click "Approve" to accept the AI-calculated level.',
      'Click "Adjust" to set a different level based on your knowledge.',
      'Click "Reassess" to flag a skill for re-evaluation.',
      'Add per-skill comments and click "Finalize Review" when done.',
    ],
  },
];

const employeeGuide: GuideStep[] = [
  {
    title: 'My Skill Registry',
    description: 'Self-assess your skills during an active review cycle. Your ratings drive the assessment pipeline.',
    icon: <BarChart3 size={16} />,
    steps: [
      'Navigate to Operations > My Registry from the sidebar.',
      'The Active Cycle Card shows your current status and a dynamic action button.',
      'Click the CTA to start or continue your self-review.',
      'Skills are grouped by category — rate each on a 1–5 scale (Basic Awareness to Expert).',
      'Your previous cycle rating is shown inline for reference (e.g. "Last cycle: L3").',
      'Optionally add comments per skill to explain your experience.',
      'Drafts auto-save every 2 seconds — look for the "Saving..." / "Saved" indicator.',
      'Submit when all skills are rated — this locks your ratings and generates an assessment.',
      'Past registries are shown in a table below for historical reference.',
    ],
  },
  {
    title: 'Assessments',
    description: 'Complete your generated assessments to validate your self-assessed skills.',
    icon: <ClipboardCheck size={16} />,
    steps: [
      'Navigate to Operations > Assessments from the sidebar.',
      'Click "Start" on any pending assessment.',
      'Answer all questions within the time limit.',
      'Submit when done — AI evaluation runs automatically.',
      'View results and feedback once evaluation is complete.',
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
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Help & Tutorial</h2>
          <p className="text-sm text-muted-foreground mt-1">Comprehensive guide for every role — learn how to use the platform effectively.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={restartTour}>
          <Play size={12} /> Restart Tour
        </Button>
      </div>

      {/* Platform flow */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-primary" /> How the Platform Works
        </h3>
        <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
          {['Self-Assessment', 'Auto-Generated Assessment', 'AI Evaluation', 'Manager Review', 'Validated Registry'].map((step, i, arr) => (
            <span key={i} className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] bg-card">{step}</Badge>
              {i < arr.length - 1 && <ChevronRight size={12} className="text-muted-foreground" />}
            </span>
          ))}
        </div>
      </div>

      {/* Overview + Navigation + Setup */}
      <div className="space-y-3">
        {platformOverview.map((s) => <GuideSectionCard key={s.title} step={s} defaultOpen />)}
        {navigationGuide.map((s) => <GuideSectionCard key={s.title} step={s} />)}
        {currentRole === 'admin' && setupFlowGuide.map((s) => <GuideSectionCard key={s.title} step={s} />)}
      </div>

      {/* Role-specific guides */}
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
