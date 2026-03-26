import { useLocation, Link } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import HelpButton from '@/components/onboarding/HelpButton';
import NotificationDropdown from '@/components/layout/NotificationDropdown';
import { useSkillStore } from '@/stores/skillStore';

interface BreadcrumbEntry {
  group: string;
  title: string;
}

const routeBreadcrumbs: Record<string, BreadcrumbEntry> = {
  '/': { group: 'Insights', title: 'Dashboard' },
  '/all-registries': { group: 'Insights', title: 'All Registries' },
  '/skill-registry': { group: 'Operations', title: 'Skill Registry' },
  '/assessments': { group: 'Operations', title: 'Assessments' },
  '/skill-library': { group: 'Settings', title: 'Skill Library' },
  '/domains': { group: 'Settings', title: 'Domains' },
  '/users': { group: 'Settings', title: 'Users' },
  '/questions': { group: 'Settings', title: 'Question Bank' },
  '/question-settings': { group: 'Settings', title: 'Question Settings' },
  '/review-cycles': { group: 'Settings', title: 'Review Cycles' },
  '/help': { group: 'Support', title: 'Help & Tutorial' },
  '/ai-generate': { group: 'Settings', title: 'AI Question Generation' },
};

export default function PageHeader() {
  const location = useLocation();
  const { categories } = useSkillStore();

  // Handle dynamic routes
  let basePath = location.pathname;
  if (basePath.startsWith('/domains/')) basePath = '/domains';
  else if (basePath.startsWith('/skill-library/')) basePath = '/skill-library';

  const crumb = routeBreadcrumbs[basePath];
  const title = crumb?.title || 'Page';
  const group = crumb?.group;

  // Domain detail breadcrumb
  const isDomainDetail = location.pathname.startsWith('/domains/') && location.pathname !== '/domains';

  // Skill Library category detail breadcrumb
  const isCategoryDetail = location.pathname.startsWith('/skill-library/') && location.pathname !== '/skill-library';
  const categoryId = isCategoryDetail ? location.pathname.split('/skill-library/')[1] : null;
  const category = categoryId ? categories.find((c) => c.id === categoryId) : null;

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
            <Link to="/domains" className="text-muted-foreground hover:text-foreground transition-colors">
              Domains
            </Link>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="font-medium text-card-foreground">Domain Detail</span>
          </>
        ) : isCategoryDetail ? (
          <>
            <Link to="/skill-library" className="text-muted-foreground hover:text-foreground transition-colors">
              Skill Library
            </Link>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="font-medium text-card-foreground">{category?.name || 'Category'}</span>
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
