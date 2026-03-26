import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HelpCircle, Play, BookOpen, Video, MessageCircle } from 'lucide-react';

export default function HelpButton() {
  const navigate = useNavigate();
  const { restartTour } = useOnboardingStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <HelpCircle size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem className="gap-2 text-xs cursor-pointer" onClick={restartTour}>
          <Play size={14} /> Restart Product Tour
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-xs cursor-pointer" onClick={() => navigate('/help')}>
          <BookOpen size={14} /> Open User Guide
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 text-xs cursor-pointer text-muted-foreground" disabled>
          <Video size={14} /> Watch Quick Demo
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-xs cursor-pointer text-muted-foreground" disabled>
          <MessageCircle size={14} /> Contact Admin
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
