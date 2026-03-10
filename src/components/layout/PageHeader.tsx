import { useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import HelpButton from '@/components/onboarding/HelpButton';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/organization': 'Organization Setup',
  '/skills': 'Skill Framework',
  '/domains': 'Domain Management',
  '/domain-skills': 'Domain-Skill Mapping',
  '/questions': 'Question Bank',
  '/ai-generate': 'AI Question Generation',
  '/assessments': 'Assessment Management',
  '/assessment-exec': 'Take Assessment',
  '/reviews': 'Manager Reviews',
  '/registry': 'Skill Registry',
  '/hr-dashboard': 'HR Dashboard',
  '/guide': 'User Guide',
};

export default function PageHeader() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Page';

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <h1 className="text-lg font-semibold text-card-foreground">{title}</h1>
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
