import { DashboardNotice } from '@/components/dashboard/shared/DashboardNotice';
import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div data-tour="dashboard" className="space-y-4">
      <DashboardNotice />
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md border-border bg-card text-card-foreground shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Construction size={32} />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Dashboard is currently under construction
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                All other features are functional. Use the menu to navigate to Skill Registry,
                Assessments, Skill Library, Domains, and more.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
