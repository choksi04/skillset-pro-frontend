import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useSkillStore, SkillCategory } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(300).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCategory?: SkillCategory | null;
  onCreated?: (categoryId: string) => void;
}

export default function CategoryFormDialog({ open, onOpenChange, editCategory, onCreated }: Props) {
  const { addCategory, updateCategory } = useSkillStore();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editCategory?.name ?? '');
      setDescription(editCategory?.description ?? '');
      setErrors({});
      setSubmitting(false);
    }
  }, [open, editCategory]);

  const handleSubmit = async () => {
    const result = schema.safeParse({ name, description });
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      if (editCategory) {
        await updateCategory(editCategory.id, { name: result.data.name, description: result.data.description || '' });
      } else {
        const newId = await addCategory({ tenant_id: user?.tenant_id ?? 'tenant-001', name: result.data.name, description: result.data.description || '', status: 'active' });
        if (newId && onCreated) onCreated(newId);
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editCategory ? 'Edit Category' : 'Create Category'}</SheetTitle>
          <SheetDescription>
            {editCategory ? 'Update category details.' : 'Add a new skill category to organize your skills.'}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label>Category Name</Label>
            <Input placeholder="e.g. Programming Languages" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} disabled={submitting} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Optional description..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} disabled={submitting} />
            <p className="text-xs text-muted-foreground text-right">{description.length}/300</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              {editCategory ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
