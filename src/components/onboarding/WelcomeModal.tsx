import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
import { Sparkles, Target, Zap, ArrowRight, X } from 'lucide-react';

const benefits = [
  { icon: <Target size={20} />, title: 'Understand Real Capabilities', desc: 'Move beyond self-reported skills to validated, evidence-based competency data.' },
  { icon: <Sparkles size={20} />, title: 'Validate with Assessments', desc: 'AI-powered evaluations paired with manager review create a rigorous validation process.' },
  { icon: <Zap size={20} />, title: 'Faster Staffing Decisions', desc: 'Instantly query validated skills to build teams, plan projects, and identify talent gaps.' },
];

export default function WelcomeModal() {
  const { user } = useAuth();
  const { showWelcome, tourActive, startTour, skipTour } = useOnboardingStore();

  if (!showWelcome || tourActive) return null;

  return (
    <Dialog open={true} onOpenChange={() => skipTour()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-0 gap-0">
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-primary via-primary/90 to-accent p-8 pb-6">
          <button
            onClick={skipTour}
            className="absolute top-4 right-4 text-primary-foreground/60 hover:text-primary-foreground transition-colors"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles size={20} className="text-primary-foreground" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-primary-foreground leading-tight">
            Welcome to the Skill Intelligence Platform
          </h2>
          <p className="text-sm text-primary-foreground/80 mt-2 leading-relaxed">
            This platform helps your organization move from self-declared skills to validated skill intelligence through structured assessments.
          </p>
        </div>

        {/* Benefits */}
        <div className="p-6 space-y-4">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {b.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center gap-3">
          <Button onClick={startTour} className="flex-1 gap-2">
            Start Quick Tour <ArrowRight size={14} />
          </Button>
          <Button variant="outline" onClick={skipTour} className="flex-1">
            Skip for Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
