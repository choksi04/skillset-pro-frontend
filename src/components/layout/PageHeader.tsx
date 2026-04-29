import { useLocation, Link } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import HelpButton from '@/components/onboarding/HelpButton';
import NotificationDropdown from '@/components/layout/NotificationDropdown';
import { useSkillStore } from '@/stores/skillStore';
import { usePageTitleStore } from '@/stores/pageTitleStore';

interface BreadcrumbEntry {
  group: string;
  title: string;
}

const routeBreadcrumbs: Record<string, BreadcrumbEntry> = {
  '/': { group: 'Insights', title: 'Dashboard' },
  '/all-registries': { group: 'Insights', title: 'All Registries' },
  '/skill-registry': { group: 'Operations', title: 'My Registry' },
  '/team-registry': { group: 'Operations', title: 'Team Registry' },
  '/assessments': { group: 'Operations', title: 'My Assessments' },
  '/team-assessments': { group: 'Operations', title: 'Team Assessments' },
  '/skill-library': { group: 'Settings', title: 'Skill Library' },
  '/domains': { group: 'Settings', title: 'Domains' },
  '/users': { group: 'Settings', title: 'Users' },
  '/questions': { group: 'Settings', title: 'Question Bank' },
  '/assessment-config': { group: 'Settings', title: 'Assessment Configuration' },
  '/assessment-templates': { group: 'Settings', title: 'Assessment Templates' },
  '/manager-reviews': { group: 'Operations', title: 'Manager Reviews' },
  '/ai-generate': { group: 'Settings', title: 'AI Question Generation' },
  '/help': { group: 'Support', title: 'Help & Tutorial' },
};

export default function PageHeader() {
  const location = useLocation();
  const { categories } = useSkillStore();

  // Handle dynamic routes
  let basePath = location.pathname;
  if (basePath.startsWith('/domains/')) basePath = '/domains';
  else if (basePath.startsWith('/skill-library/')) basePath = '/skill-library';
  else if (basePath.startsWith('/skill-registry/')) basePath = '/skill-registry';
  else if (basePath.startsWith('/team-registry/')) basePath = '/team-registry';
  else if (basePath.startsWith('/assessments/')) basePath = '/assessments';
  else if (basePath.startsWith('/team-assessments/')) basePath = '/team-assessments';
  else if (basePath.startsWith('/assessment-templates/')) basePath = '/assessment-templates';

  const crumb = routeBreadcrumbs[basePath];
  const title = crumb?.title || 'Page';
  const group = crumb?.group;

  const overrideTitle = usePageTitleStore((s) => s.title);

  // Domain detail breadcrumb
  const isDomainDetail = location.pathname.startsWith('/domains/') && location.pathname !== '/domains';

  // Skill Library category detail breadcrumb
  const isCategoryDetail = location.pathname.startsWith('/skill-library/') && location.pathname !== '/skill-library';
  const categoryId = isCategoryDetail ? location.pathname.split('/skill-library/')[1] : null;
  const category = categoryId ? categories.find((c) => c.id === categoryId) : null;

  // Registry detail breadcrumbs
  const isSkillRegistryDetail = location.pathname.startsWith('/skill-registry/') && location.pathname !== '/skill-registry';
  const isTeamRegistryDetail = location.pathname.startsWith('/team-registry/') && location.pathname !== '/team-registry';
  const isAssessmentDetail = location.pathname.startsWith('/assessments/') && location.pathname !== '/assessments';
  const isTeamAssessmentDetail = location.pathname.startsWith('/team-assessments/') && location.pathname !== '/team-assessments';
  const isTemplateDetail = location.pathname.startsWith('/assessment-templates/') && location.pathname !== '/assessment-templates';
  const templatePathSeg = isTemplateDetail ? location.pathname.split('/assessment-templates/')[1] : null;
  const isNewTemplate = templatePathSeg === 'new';
  const templateDetailTitle = overrideTitle || (isNewTemplate ? 'New Assessment Template' : 'Edit Template');

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-1.5 text-sm">
        {group && (
          <>
            <span className="text-muted-foreground">{group}</span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </>
        )}
        {isDomainDetail ? (
          <>
            <Link to="/domains" className="text-muted-foreground hover:text-foreground transition-colors">Domains</Link>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="font-medium text-card-foreground">Domain Detail</span>
          </>
        ) : isCategoryDetail ? (
          <>
            <Link to="/skill-library" className="text-muted-foreground hover:text-foreground transition-colors">Skill Library</Link>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="font-medium text-card-foreground">{category?.name || 'Category'}</span>
          </>
        ) : isSkillRegistryDetail ? (
          <>
            <Link to="/skill-registry" className="text-muted-foreground hover:text-foreground transition-colors">My Registry</Link>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="font-medium text-card-foreground">Detail</span>
          </>
        ) : isTeamRegistryDetail ? (
          <>
            <Link to="/team-registry" className="text-muted-foreground hover:text-foreground transition-colors">Team Registry</Link>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="font-medium text-card-foreground">Detail</span>
          </>
        ) : isAssessmentDetail ? (
          <>
            <Link to="/assessments" className="text-muted-foreground hover:text-foreground transition-colors">My Assessments</Link>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="font-medium text-card-foreground">Detail</span>
          </>
        ) : isTeamAssessmentDetail ? (
          <>
            <Link to="/team-assessments" className="text-muted-foreground hover:text-foreground transition-colors">Team Assessments</Link>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="font-medium text-card-foreground">Detail</span>
          </>
        ) : (
          <span className="font-medium text-card-foreground">{title}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Search size={16} />
        </button>
        <HelpButton />
        <NotificationDropdown />
      </div>
    </header>
  );
}
