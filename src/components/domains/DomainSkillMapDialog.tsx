import { useState } from 'react';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';

interface DomainSkillMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domainId: string;
  domainName: string;
}

export default function DomainSkillMapDialog({ open, onOpenChange, domainId, domainName }: DomainSkillMapDialogProps) {
  const { mappings, addMapping, removeMapping } = useDomainStore();
  const { skills } = useSkillStore();
  const { user } = useAuth();

  const activeSkills = skills.filter((s) => s.status === 'active');
  const currentMappings = mappings.filter((m) => m.domain_id === domainId);
  const mappedSkillIds = new Set(currentMappings.map((m) => m.skill_id));

  const handleToggle = (skillId: string) => {
    if (mappedSkillIds.has(skillId)) {
      const mapping = currentMappings.find((m) => m.skill_id === skillId);
      if (mapping) removeMapping(mapping.id);
    } else {
      addMapping({
        domain_id: domainId,
        skill_id: skillId,
        tenant_id: user?.tenant_id ?? 'tenant-001',
        skill_weight: 1,
      });
    }
  };

  // Group skills by category
  const grouped = activeSkills.reduce<Record<string, typeof activeSkills>>((acc, skill) => {
    (acc[skill.skill_category] ??= []).push(skill);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Skills — {domainName}</DialogTitle>
        </DialogHeader>

        {/* Mapped skills summary */}
        <div className="border border-border rounded-lg p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">
            {currentMappings.length} skill{currentMappings.length !== 1 ? 's' : ''} mapped
          </p>
          <div className="flex flex-wrap gap-1.5">
            {currentMappings.map((m) => {
              const skill = skills.find((s) => s.id === m.skill_id);
              return skill ? (
                <Badge key={m.id} variant="secondary" className="gap-1 text-xs pr-1">
                  {skill.skill_name}
                  <button onClick={() => removeMapping(m.id)} className="ml-0.5 hover:text-destructive transition-colors">
                    <X size={12} />
                  </button>
                </Badge>
              ) : null;
            })}
            {currentMappings.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No skills mapped yet</p>
            )}
          </div>
        </div>

        {/* Skill selection */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {Object.entries(grouped).map(([category, catSkills]) => (
            <div key={category}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{category}</p>
              <div className="space-y-1">
                {catSkills.map((skill) => (
                  <label
                    key={skill.id}
                    className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={mappedSkillIds.has(skill.id)}
                      onCheckedChange={() => handleToggle(skill.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{skill.skill_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{skill.skill_description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
