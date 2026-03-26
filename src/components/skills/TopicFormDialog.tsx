import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useSkillStore, SkillTopic } from '@/stores/skillStore';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const topicSchema = z.object({
  name: z.string().trim().min(1, 'Topic name is required').max(100),
  description: z.string().trim().max(300).optional(),
});

interface TopicFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillId: string;
  tenantId: string;
  editTopic?: SkillTopic | null;
  existingTopics: SkillTopic[];
}

export default function TopicFormDialog({
  open, onOpenChange, skillId, tenantId, editTopic, existingTopics,
}: TopicFormDialogProps) {
  const { addTopic, updateTopic } = useSkillStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editTopic?.name ?? '');
      setDescription(editTopic?.description ?? '');
      setErrors({});
      setSubmitting(false);
    }
  }, [open, editTopic]);

  const handleSubmit = async () => {
    const result = topicSchema.safeParse({ name, description });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        if (e.path[0]) fieldErrors[e.path[0] as string] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }

    const isDuplicate = existingTopics.some(
      (t) => t.name.toLowerCase() === result.data.name.toLowerCase() && t.id !== editTopic?.id
    );
    if (isDuplicate) {
      setErrors({ name: 'A topic with this name already exists for this skill.' });
      return;
    }

    setSubmitting(true);
    try {
      if (editTopic) {
        await updateTopic(editTopic.id, { name: result.data.name, description: result.data.description || '' });
      } else {
        await addTopic({
          skill_id: skillId,
          tenant_id: tenantId,
          name: result.data.name,
          description: result.data.description || '',
          status: 'active',
        });
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
          <SheetTitle>{editTopic ? 'Edit Topic' : 'Add Topic'}</SheetTitle>
          <SheetDescription>
            {editTopic ? 'Update topic details.' : 'Add a new topic to this skill.'}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic-name">Topic Name</Label>
            <Input
              id="topic-name"
              placeholder="e.g. State Management, REST APIs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={submitting}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="topic-desc">Description (optional)</Label>
            <Textarea
              id="topic-desc"
              placeholder="What this topic covers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={3}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/300</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              {editTopic ? 'Save Changes' : 'Add Topic'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
