import { useLocation, Link } from 'react-router-dom';
import { Bell, Search, ChevronRight } from 'lucide-react';
import HelpButton from '@/components/onboarding/HelpButton';

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

  // Handle dynamic routes like /domains/:id
  const basePath = location.pathname.startsWith('/domains/') ? '/domains' : location.pathname;
  const crumb = routeBreadcrumbs[basePath];
  const title = crumb?.title || 'Page';
  const group = crumb?.group;

  // For domain detail pages, add extra breadcrumb
  const isDomainDetail = location.pathname.startsWith('/domains/') && location.pathname !== '/domains';

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
        ) : (
          <span className="font-medium text-card-foreground">{title}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Search size={16} />
        </button>
        <HelpButton />
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative">
          <Bell size={16} />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
        </button>
      </div>
    </header>
  );
}
