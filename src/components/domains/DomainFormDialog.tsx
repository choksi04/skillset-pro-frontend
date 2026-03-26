import { useState } from 'react';
import { z } from 'zod';
import { useDomainStore, Domain } from '@/stores/domainStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const domainSchema = z.object({
  name: z.string().trim().min(1, 'Domain name is required').max(100, 'Max 100 characters'),
  description: z.string().trim().min(1, 'Description is required').max(500, 'Max 500 characters'),
});

interface DomainFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDomain?: Domain | null;
  onCreated?: (domainId: string) => void;
}

export default function DomainFormDialog({ open, onOpenChange, editDomain, onCreated }: DomainFormDialogProps) {
  const { addDomain, updateDomain } = useDomainStore();
  const { user } = useAuth();

  const [name, setName] = useState(editDomain?.name ?? '');
  const [description, setDescription] = useState(editDomain?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName(editDomain?.name ?? '');
    setDescription(editDomain?.description ?? '');
    setErrors({});
  };

  const handleSubmit = async () => {
    const result = domainSchema.safeParse({ name, description });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      if (editDomain) {
        await updateDomain(editDomain.id, { name: result.data.name, description: result.data.description });
      } else {
        const newId = await addDomain({
          tenant_id: user?.tenant_id ?? 'tenant-001',
          name: result.data.name,
          description: result.data.description,
          status: 'active',
          domain_lead_id: null,
        });
        if (newId && onCreated) onCreated(newId);
      }
      onOpenChange(false);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editDomain ? 'Edit Domain' : 'Create New Domain'}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="domain-name">Domain Name</Label>
            <Input id="domain-name" placeholder="e.g. Frontend Engineering" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} disabled={submitting} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="domain-desc">Description</Label>
            <Textarea id="domain-desc" placeholder="Describe this domain..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} disabled={submitting} />
            <div className="flex justify-between">
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              <p className="text-xs text-muted-foreground ml-auto">{description.length}/500</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              {editDomain ? 'Save Changes' : 'Create Domain'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
