import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useSkillStore, Skill } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';

const skillSchema = z.object({
  skill_name: z.string().trim().min(1, 'Skill name is required').max(100),
  skill_description: z.string().trim().min(1, 'Description is required').max(500),
  skill_category: z.string().min(1, 'Category is required'),
});

// Derive tag suggestions from existing skills in the database instead of hardcoding

interface SkillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSkill?: Skill | null;
}

export default function SkillFormDialog({ open, onOpenChange, editSkill }: SkillFormDialogProps) {
  const { categories, skills, addSkill, updateSkill } = useSkillStore();
  const { user } = useAuth();
  const activeCategories = categories.filter((c) => c.status === 'active');

  // Derive suggested tags from all existing skills in the database
  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    skills.forEach((s) => (s.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [skills]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState<'active' | 'disabled'>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(editSkill?.skill_name ?? '');
      setDescription(editSkill?.skill_description ?? '');
      setCategory(editSkill?.skill_category ?? '');
      setTags(editSkill?.tags ?? []);
      setStatus(editSkill?.status ?? 'active');
      setTagInput('');
      setErrors({});
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

  const handleSubmit = () => {
    const result = skillSchema.safeParse({ skill_name: name, skill_description: description, skill_category: category });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }

    if (editSkill) {
      updateSkill(editSkill.id, {
        skill_name: result.data.skill_name, skill_description: result.data.skill_description,
        skill_category: result.data.skill_category, tags, status,
      });
    } else {
      addSkill({
        tenant_id: user?.tenant_id ?? 'tenant-001',
        skill_name: result.data.skill_name, skill_description: result.data.skill_description,
        skill_category: result.data.skill_category, tags, status,
      });
    }
    onOpenChange(false);
  };

  const unusedSuggestions = SUGGESTED_TAGS.filter((t) => !tags.includes(t));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editSkill ? 'Edit Skill' : 'Create New Skill'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {activeCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.skill_category && <p className="text-xs text-destructive">{errors.skill_category}</p>}
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="skill-name">Skill Name</Label>
            <Input id="skill-name" placeholder="e.g. React, System Design" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            {errors.skill_name && <p className="text-xs text-destructive">{errors.skill_name}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="skill-desc">Description</Label>
            <Textarea id="skill-desc" placeholder="Describe what this skill covers..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
            <div className="flex justify-between">
              {errors.skill_description && <p className="text-xs text-destructive">{errors.skill_description}</p>}
              <p className="text-xs text-muted-foreground ml-auto">{description.length}/500</p>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive"><X size={12} /></button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="Type a tag and press Enter..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
            />
            {unusedSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {unusedSuggestions.map((s) => (
                  <button key={s} onClick={() => addTag(s)} className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'disabled')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editSkill ? 'Save Changes' : 'Create Skill'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
