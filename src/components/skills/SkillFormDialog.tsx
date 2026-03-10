import { useState } from 'react';
import { z } from 'zod';
import { useSkillStore, Skill } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const skillSchema = z.object({
  skill_name: z.string().trim().min(1, 'Skill name is required').max(100, 'Max 100 characters'),
  skill_description: z.string().trim().min(1, 'Description is required').max(500, 'Max 500 characters'),
  skill_category: z.string().min(1, 'Category is required'),
});

interface SkillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSkill?: Skill | null;
}

export default function SkillFormDialog({ open, onOpenChange, editSkill }: SkillFormDialogProps) {
  const { categories, addSkill, updateSkill } = useSkillStore();
  const { user } = useAuth();

  const [name, setName] = useState(editSkill?.skill_name ?? '');
  const [description, setDescription] = useState(editSkill?.skill_description ?? '');
  const [category, setCategory] = useState(editSkill?.skill_category ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens with new data
  const resetForm = () => {
    setName(editSkill?.skill_name ?? '');
    setDescription(editSkill?.skill_description ?? '');
    setCategory(editSkill?.skill_category ?? '');
    setErrors({});
  };

  const handleSubmit = () => {
    const result = skillSchema.safeParse({
      skill_name: name,
      skill_description: description,
      skill_category: category,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        if (e.path[0]) fieldErrors[e.path[0] as string] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (editSkill) {
      updateSkill(editSkill.id, {
        skill_name: result.data.skill_name,
        skill_description: result.data.skill_description,
        skill_category: result.data.skill_category,
      });
    } else {
      addSkill({
        tenant_id: user?.tenant_id ?? 'tenant-001',
        skill_name: result.data.skill_name,
        skill_description: result.data.skill_description,
        skill_category: result.data.skill_category,
        status: 'active',
      });
    }

    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editSkill ? 'Edit Skill' : 'Create New Skill'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="skill-name">Skill Name</Label>
            <Input
              id="skill-name"
              placeholder="e.g. React, System Design"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
            {errors.skill_name && <p className="text-xs text-destructive">{errors.skill_name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-desc">Description</Label>
            <Textarea
              id="skill-desc"
              placeholder="Describe what this skill covers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <div className="flex justify-between">
              {errors.skill_description && <p className="text-xs text-destructive">{errors.skill_description}</p>}
              <p className="text-xs text-muted-foreground ml-auto">{description.length}/500</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.skill_category && <p className="text-xs text-destructive">{errors.skill_category}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editSkill ? 'Save Changes' : 'Create Skill'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
