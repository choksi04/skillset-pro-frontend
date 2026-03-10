import { Construction } from 'lucide-react';

interface PagePlaceholderProps {
  title: string;
  description: string;
  module: string;
}

export default function PagePlaceholder({ title, description, module }: PagePlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
        <Construction size={28} className="text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center mb-4">{description}</p>
      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        Module: {module}
      </span>
    </div>
  );
}
