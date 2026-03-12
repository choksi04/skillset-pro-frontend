import { useState } from 'react';
import { z } from 'zod';
import { useDomainStore, Domain } from '@/stores/domainStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const domainSchema = z.object({
  name: z.string().trim().min(1, 'Domain name is required').max(100, 'Max 100 characters'),
  description: z.string().trim().min(1, 'Description is required').max(500, 'Max 500 characters'),
});

interface DomainFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDomain?: Domain | null;
}

export default function DomainFormDialog({ open, onOpenChange, editDomain }: DomainFormDialogProps) {
  const { addDomain, updateDomain } = useDomainStore();
  const { user } = useAuth();

  const [name, setName] = useState(editDomain?.name ?? '');
  const [description, setDescription] = useState(editDomain?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setName(editDomain?.name ?? '');
    setDescription(editDomain?.description ?? '');
    setErrors({});
  };

  const handleSubmit = () => {
    const result = domainSchema.safeParse({ name, description });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    if (editDomain) {
      updateDomain(editDomain.id, { name: result.data.name, description: result.data.description });
    } else {
      addDomain({ tenant_id: user?.tenant_id ?? 'tenant-001', name: result.data.name, description: result.data.description, status: 'active', domain_lead_id: null });
    }
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editDomain ? 'Edit Domain' : 'Create New Domain'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="domain-name">Domain Name</Label>
            <Input id="domain-name" placeholder="e.g. Frontend Engineering" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="domain-desc">Description</Label>
            <Textarea id="domain-desc" placeholder="Describe this domain..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
            <div className="flex justify-between">
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              <p className="text-xs text-muted-foreground ml-auto">{description.length}/500</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit}>{editDomain ? 'Save Changes' : 'Create Domain'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
