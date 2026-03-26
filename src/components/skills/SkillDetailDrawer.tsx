import { useEffect, useState } from 'react';
import { useSkillStore, Skill, SkillTopic } from '@/stores/skillStore';
import TopicFormDialog from '@/components/skills/TopicFormDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Tag, BookOpen, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SkillDetailDrawerProps {
  skill: Skill | null;
  onClose: () => void;
  isAdmin: boolean;
}

export default function SkillDetailDrawer({ skill, onClose, isAdmin }: SkillDetailDrawerProps) {
  const { topics, fetchTopicsForSkill, deleteTopic } = useSkillStore();
  const { user } = useAuth();
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<SkillTopic | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<SkillTopic | null>(null);

  useEffect(() => {
    if (skill) {
      setLoadingTopics(true);
      fetchTopicsForSkill(skill.id).finally(() => setLoadingTopics(false));
    }
  }, [skill, fetchTopicsForSkill]);

  const skillTopics = skill ? (topics[skill.id] || []) : [];

  const handleAddTopic = () => { setEditingTopic(null); setTopicDialogOpen(true); };
  const handleEditTopic = (topic: SkillTopic) => { setEditingTopic(topic); setTopicDialogOpen(true); };

  const confirmDeleteTopic = async () => {
    if (!deleteTopicTarget || !skill) return;
    await deleteTopic(deleteTopicTarget.id, skill.id);
    setDeleteTopicTarget(null);
  };

  return (
    <>
      <Sheet open={!!skill} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {skill && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-lg">{skill.skill_name}</SheetTitle>
                {skill.skill_description && (
                  <SheetDescription className="text-sm">{skill.skill_description}</SheetDescription>
                )}
              </SheetHeader>

              {/* Tags */}
              {skill.tags && skill.tags.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs font-normal">
                        <Tag size={10} className="mr-1" />{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                <Badge
                  variant={skill.status === 'active' ? 'default' : 'outline'}
                  className={`text-xs ${skill.status === 'active' ? 'bg-success/15 text-success border-success/20' : ''}`}
                >
                  {skill.status}
                </Badge>
              </div>

              {/* Topics Section */}
              <div className="border-t border-border pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} className="text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Topics</h3>
                    <Badge variant="outline" className="text-[10px] ml-1">{skillTopics.length}</Badge>
                  </div>
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={handleAddTopic} className="gap-1 h-7 text-xs">
                      <Plus size={12} /> Add Topic
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-3">
                  Topics help refine skill coverage and improve AI question generation.
                </p>

                {loadingTopics ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                ) : skillTopics.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <BookOpen size={20} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">No topics added yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {skillTopics.map((topic) => (
                      <div key={topic.id} className="relative rounded-lg border border-border p-3 bg-card hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{topic.name}</p>
                            {topic.description ? (
                              <p
                                className="text-xs text-muted-foreground mt-1 line-clamp-2"
                                title={topic.description}
                              >
                                {topic.description}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1 italic">No description</p>
                            )}
                          </div>
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0">
                                  <MoreHorizontal size={12} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditTopic(topic)}>
                                  <Pencil size={12} className="mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteTopicTarget(topic)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 size={12} className="mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {skill && (
        <TopicFormDialog
          open={topicDialogOpen}
          onOpenChange={setTopicDialogOpen}
          skillId={skill.id}
          tenantId={user?.tenant_id ?? 'tenant-001'}
          editTopic={editingTopic}
          existingTopics={skillTopics}
        />
      )}

      {/* Delete Topic Confirmation */}
      <AlertDialog open={!!deleteTopicTarget} onOpenChange={(open) => { if (!open) setDeleteTopicTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">"{deleteTopicTarget?.name}"</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTopic} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
