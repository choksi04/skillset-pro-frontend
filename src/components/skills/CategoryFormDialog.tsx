import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useSkillStore, SkillCategory } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(300).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCategory?: SkillCategory | null;
}

export default function CategoryFormDialog({ open, onOpenChange, editCategory }: Props) {
  const { addCategory, updateCategory } = useSkillStore();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(editCategory?.name ?? '');
      setDescription(editCategory?.description ?? '');
      setErrors({});
    }
  }, [open, editCategory]);

  const handleSubmit = () => {
    const result = schema.safeParse({ name, description });
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
      setErrors(fe);
      return;
    }
    if (editCategory) {
      updateCategory(editCategory.id, { name: result.data.name, description: result.data.description || '' });
    } else {
      addCategory({ tenant_id: user?.tenant_id ?? 'tenant-001', name: result.data.name, description: result.data.description || '', status: 'active' });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Category Name</Label>
            <Input placeholder="e.g. Programming Languages" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Optional description..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editCategory ? 'Save' : 'Create'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
