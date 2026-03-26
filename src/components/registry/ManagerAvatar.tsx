import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

export interface ReviewerInfo {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
}

export function ManagerAvatar({ reviewer }: { reviewer: ReviewerInfo | null }) {
  if (!reviewer) return <span className="text-xs text-muted-foreground">—</span>;
  const initials = reviewer.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="focus:outline-none">
          <Avatar className="h-7 w-7 cursor-pointer">
            {reviewer.avatar_url ? <AvatarImage src={reviewer.avatar_url} alt={reviewer.name} /> : null}
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64" side="top">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {reviewer.avatar_url ? <AvatarImage src={reviewer.avatar_url} alt={reviewer.name} /> : null}
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{reviewer.name}</p>
            <p className="text-xs text-muted-foreground">{reviewer.email}</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
