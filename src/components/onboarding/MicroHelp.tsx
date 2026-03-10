import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface MicroHelpProps {
  text: string;
  children?: React.ReactNode;
}

export default function MicroHelp({ text, children }: MicroHelpProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children ?? (
          <span className="inline-flex cursor-help">
            <Info size={12} className="text-muted-foreground hover:text-foreground transition-colors" />
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
