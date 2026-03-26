import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useSkillStore, Skill } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import SearchableSelect from '@/components/ui/searchable-select';
import { X, Loader2 } from 'lucide-react';

const skillSchema = z.object({
  skill_name: z.string().trim().min(1, 'Skill name is required').max(100),
  skill_description: z.string().trim().min(1, 'Description is required').max(500),
});

interface SkillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSkill?: Skill | null;
  categoryName?: string;
  onCreated?: (skillId: string) => void;
}

export default function SkillFormDialog({ open, onOpenChange, editSkill, categoryName, onCreated }: SkillFormDialogProps) {
  const { addSkill, updateSkill } = useSkillStore();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState<'active' | 'disabled'>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editSkill?.skill_name ?? '');
      setDescription(editSkill?.skill_description ?? '');
      setTags(editSkill?.tags ?? []);
      setStatus(editSkill?.status ?? 'active');
      setTagInput('');
      setErrors({});
      setSubmitting(false);
    }
  }, [open, editSkill]);

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSubmit = async () => {
    const result = skillSchema.safeParse({ skill_name: name, skill_description: description });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }

    const resolvedCategory = categoryName || editSkill?.skill_category || '';
    setSubmitting(true);
    try {
      if (editSkill) {
        await updateSkill(editSkill.id, {
          skill_name: result.data.skill_name, skill_description: result.data.skill_description,
          skill_category: resolvedCategory, tags, status,
        });
      } else {
        const newId = await addSkill({
          tenant_id: user?.tenant_id ?? 'tenant-001',
          skill_name: result.data.skill_name, skill_description: result.data.skill_description,
          skill_category: resolvedCategory, tags, status,
        });
        if (newId && onCreated) onCreated(newId);
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'disabled', label: 'Disabled' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editSkill ? 'Edit Skill' : 'Create New Skill'}</SheetTitle>
          <SheetDescription>
            {editSkill ? 'Update skill details.' : 'Add a new skill to this category.'}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          {categoryName && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <p className="text-sm text-muted-foreground">{categoryName}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="skill-name">Skill Name</Label>
            <Input id="skill-name" placeholder="e.g. React, System Design" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} disabled={submitting} />
            {errors.skill_name && <p className="text-xs text-destructive">{errors.skill_name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-desc">Description</Label>
            <Textarea id="skill-desc" placeholder="Describe what this skill covers..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} disabled={submitting} />
            <div className="flex justify-between">
              {errors.skill_description && <p className="text-xs text-destructive">{errors.skill_description}</p>}
              <p className="text-xs text-muted-foreground ml-auto">{description.length}/500</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive" disabled={submitting}><X size={12} /></button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="Type a tag and press Enter..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <SearchableSelect
              options={statusOptions}
              value={status}
              onValueChange={(v) => setStatus(v as 'active' | 'disabled')}
              placeholder="Select status"
              className="w-full h-9 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              {editSkill ? 'Save Changes' : 'Create Skill'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
