import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStore, getTourStepsForRole, TourStep } from '@/stores/onboardingStore';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Pause } from 'lucide-react';

function getElementRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}

function getTooltipPosition(rect: DOMRect | null, position: string = 'right') {
  if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const pad = 16;
  switch (position) {
    case 'right':
      return { top: `${rect.top + rect.height / 2}px`, left: `${rect.right + pad}px`, transform: 'translateY(-50%)' };
    case 'left':
      return { top: `${rect.top + rect.height / 2}px`, left: `${rect.left - pad}px`, transform: 'translate(-100%, -50%)' };
    case 'bottom':
      return { top: `${rect.bottom + pad}px`, left: `${rect.left + rect.width / 2}px`, transform: 'translateX(-50%)' };
    case 'top':
      return { top: `${rect.top - pad}px`, left: `${rect.left + rect.width / 2}px`, transform: 'translate(-50%, -100%)' };
    default:
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

export default function GuidedTour() {
  const { currentRole } = useAuth();
  const navigate = useNavigate();
  const { tourActive, tourStep, nextStep, prevStep, completeTour, continueLater } = useOnboardingStore();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [animating, setAnimating] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);

  const steps = getTourStepsForRole(currentRole);
  const currentStepData: TourStep | undefined = steps[tourStep];
  const isLast = tourStep >= steps.length - 1;

  const updateTargetRect = useCallback(() => {
    if (!currentStepData?.targetSelector) {
      setTargetRect(null);
      return;
    }
    const rect = getElementRect(currentStepData.targetSelector);
    setTargetRect(rect);
  }, [currentStepData?.targetSelector]);

  // Navigate to route if needed, then highlight
  useEffect(() => {
    if (!tourActive || !currentStepData) return;

    if (currentStepData.targetRoute) {
      navigate(currentStepData.targetRoute);
    }

    // Small delay for DOM to settle
    setAnimating(true);
    const timer = setTimeout(() => {
      updateTargetRect();
      setAnimating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [tourActive, tourStep, currentStepData, navigate, updateTargetRect]);

  // Observe DOM changes to keep rect updated + ESC to close
  useEffect(() => {
    if (!tourActive) return;
    const obs = new MutationObserver(() => updateTargetRect());
    obs.observe(document.body, { childList: true, subtree: true });
    observerRef.current = obs;
    window.addEventListener('resize', updateTargetRect);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') completeTour();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('keydown', onKey);
    };
  }, [tourActive, updateTargetRect, completeTour]);


  if (!tourActive || !currentStepData) return null;

  const pos = getTooltipPosition(targetRect, currentStepData.position);
  const isCentered = !targetRect;

  const handleNext = () => {
    if (isLast) {
      completeTour();
    } else {
      nextStep();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay */}
      <div className="absolute inset-0">
        {targetRect ? (
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <mask id="tour-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={targetRect.left - 6}
                  y={targetRect.top - 6}
                  width={targetRect.width + 12}
                  height={targetRect.height + 12}
                  rx="8"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0" y="0"
              width="100%" height="100%"
              fill="rgba(0,0,0,0.55)"
              mask="url(#tour-mask)"
              className="transition-all duration-300"
            />
          </svg>
        ) : (
          <div className="absolute inset-0 bg-black/55 transition-opacity duration-300" />
        )}
      </div>

      {/* Highlight ring */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-lg pointer-events-none transition-all duration-300 shadow-[0_0_0_4px_hsl(var(--primary)/0.2)]"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className={`absolute z-10 transition-all duration-300 ${animating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
        style={{
          ...pos,
          maxWidth: isCentered ? '420px' : '340px',
          width: 'max-content',
        }}
      >
        <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Step indicator */}
          <div className="px-4 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === tourStep ? 'w-6 bg-primary' : i < tourStep ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">
              {tourStep + 1} / {steps.length}
            </span>
          </div>

          {/* Content */}
          <div className="p-4 pt-3">
            <h3 className="text-sm font-semibold text-card-foreground mb-1.5">
              {currentStepData.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentStepData.description}
            </p>
          </div>

          {/* Actions */}
          <div className="px-4 pb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground gap-1"
                onClick={continueLater}
              >
                <Pause size={10} /> Later
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground gap-1"
                onClick={completeTour}
              >
                <X size={10} /> Skip
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              {tourStep > 0 && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={prevStep}>
                  <ChevronLeft size={12} /> Back
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs gap-1" onClick={handleNext}>
                {isLast ? 'Finish' : 'Next'} {!isLast && <ChevronRight size={12} />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
