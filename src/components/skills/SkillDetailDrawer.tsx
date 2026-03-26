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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

  useEffect(() => {
    if (skill) {
      setLoadingTopics(true);
      fetchTopicsForSkill(skill.id).finally(() => setLoadingTopics(false));
    }
  }, [skill, fetchTopicsForSkill]);

  const skillTopics = skill ? (topics[skill.id] || []) : [];

  const handleAddTopic = () => { setEditingTopic(null); setTopicDialogOpen(true); };
  const handleEditTopic = (topic: SkillTopic) => { setEditingTopic(topic); setTopicDialogOpen(true); };

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
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    ))}
                  </div>
                ) : skillTopics.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <BookOpen size={20} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">No topics added yet.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Topic Name</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Description</TableHead>
                          {isAdmin && <TableHead className="w-[50px]" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {skillTopics.map((topic) => (
                          <TableRow key={topic.id}>
                            <TableCell className="text-sm font-medium">{topic.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell line-clamp-1">
                              {topic.description || '—'}
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                      <MoreHorizontal size={12} />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditTopic(topic)}>
                                      <Pencil size={12} className="mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => deleteTopic(topic.id, skill.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 size={12} className="mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
    </>
  );
}
