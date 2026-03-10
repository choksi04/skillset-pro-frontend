import { useState, useMemo, useCallback } from 'react';
import { useRegistryStore, RatingLevel, SkillSelfRating, ratingLabels } from '@/stores/registryStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useAuth } from '@/contexts/AuthContext';
import RatingSlider from '@/components/registry/RatingSlider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { CheckCircle, Lock, ClipboardCheck, AlertTriangle, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function SkillRegistryPage() {
  const { user, currentRole } = useAuth();
  const { submissions, assignments, currentCycle, getSubmission, createOrUpdateDraft, submitRegistry, markAssessmentGenerated } = useRegistryStore();
  const { addAssessment } = useAssessmentStore();
  const { domains, mappings } = useDomainStore();
  const { skills } = useSkillStore();
  const { questions } = useQuestionStore();

  const isEmployee = currentRole === 'employee';
  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  // Get employee's assigned domain
  const employeeAssignment = assignments.find((a) => a.employee_id === employeeId);
  const assignedDomain = employeeAssignment ? domains.find((d) => d.id === employeeAssignment.domain_id) : null;

  // Get skills mapped to this domain
  const domainSkillIds = useMemo(() => {
    if (!assignedDomain) return [];
    return mappings.filter((m) => m.domain_id === assignedDomain.id).map((m) => m.skill_id);
  }, [assignedDomain, mappings]);

  const domainSkills = useMemo(
    () => skills.filter((s) => domainSkillIds.includes(s.id) && s.status === 'active'),
    [skills, domainSkillIds]
  );

  // Get current submission
  const submission = getSubmission(employeeId, currentCycle);
  const isLocked = submission?.status === 'submitted' || submission?.status === 'assessment_generated';

  // Local rating state
  const [ratings, setRatings] = useState<Record<string, RatingLevel>>(() => {
    if (submission?.ratings) {
      const map: Record<string, RatingLevel> = {};
      submission.ratings.forEach((r) => { map[r.skill_id] = r.rating; });
      return map;
    }
    return {};
  });

  const [confirmOpen, setConfirmOpen] = useState(false);

  const allRated = domainSkills.length > 0 && domainSkills.every((s) => ratings[s.id] != null);

  const handleRatingChange = useCallback((skillId: string, rating: RatingLevel) => {
    if (isLocked) return;
    setRatings((prev) => ({ ...prev, [skillId]: rating }));
  }, [isLocked]);

  const handleSaveDraft = () => {
    if (!assignedDomain || isLocked) return;
    const ratingsList: SkillSelfRating[] = Object.entries(ratings).map(([skill_id, rating]) => ({ skill_id, rating }));
    createOrUpdateDraft(employeeId, tenantId, assignedDomain.id, ratingsList);
    toast.success('Draft saved successfully');
  };

  const handleSubmit = () => {
    if (!allRated) {
      toast.error('Please rate all skills before submitting');
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSubmit = () => {
    if (!assignedDomain) return;

    // Save final ratings
    const ratingsList: SkillSelfRating[] = Object.entries(ratings).map(([skill_id, rating]) => ({ skill_id, rating }));
    createOrUpdateDraft(employeeId, tenantId, assignedDomain.id, ratingsList);

    // Get the submission and lock it
    const sub = getSubmission(employeeId, currentCycle);
    if (sub) {
      submitRegistry(sub.id);

      // Auto-generate assessment
      const skillIds = ratingsList.map((r) => r.skill_id);
      const publishedQuestions = questions.filter(
        (q) => skillIds.includes(q.skill_id) && q.status === 'published'
      );

      addAssessment({
        tenant_id: tenantId,
        employee_id: employeeId,
        submission_id: sub.id,
        domain_id: assignedDomain.id,
        ratings: ratingsList,
        publishedQuestions,
      });

      markAssessmentGenerated(sub.id);
    }

    setConfirmOpen(false);
    toast.success('Skill registry submitted! Assessment has been generated.');
  };

  // Admin/HR/Manager view — show all submissions
  if (!isEmployee) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          View all employee skill registry submissions across the organization.
        </p>

        {submissions.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">No submissions yet.</div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => {
              const emp = sub.employee_id;
              const domain = domains.find((d) => d.id === sub.domain_id);
              return (
                <div key={sub.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">Employee: {emp}</p>
                      <p className="text-xs text-muted-foreground">
                        {domain?.name ?? 'Unknown domain'} · Cycle: {sub.cycle}
                      </p>
                    </div>
                    <Badge className={`text-xs ${
                      sub.status === 'assessment_generated'
                        ? 'bg-success/15 text-success border-success/20'
                        : sub.status === 'submitted'
                        ? 'bg-info/15 text-info border-info/20'
                        : 'bg-warning/15 text-warning border-warning/20'
                    }`}>
                      {sub.status === 'assessment_generated' ? 'Assessment Generated' : sub.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sub.ratings.map((r) => {
                      const skill = skills.find((s) => s.id === r.skill_id);
                      return (
                        <div key={r.skill_id} className="rounded-md bg-muted px-2.5 py-1">
                          <span className="text-xs text-foreground">{skill?.skill_name ?? 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">L{r.rating}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Employee view
  if (!assignedDomain) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle size={32} className="text-warning mb-3" />
        <h2 className="text-lg font-semibold text-foreground mb-1">No Domain Assigned</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          You have not been assigned to a domain yet. Please contact your manager or HR to get assigned to a domain before submitting your skill registry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Skill Self-Assessment</h2>
            <p className="text-sm text-muted-foreground">
              Domain: <span className="font-medium text-foreground">{assignedDomain.name}</span> · Cycle: <span className="font-medium text-foreground">{currentCycle}</span>
            </p>
          </div>
          {isLocked && (
            <Badge className="bg-success/15 text-success border-success/20 gap-1 text-xs">
              <Lock size={12} /> Submitted
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isLocked
            ? 'Your skill registry has been submitted and locked for this cycle. An assessment has been generated.'
            : `Rate your proficiency for each skill below (${domainSkills.length} skills). You can save as draft and return later. Once submitted, ratings are locked and an assessment is automatically generated.`
          }
        </p>
      </div>

      {/* Rating legend */}
      {!isLocked && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Rating Scale</p>
          <div className="grid grid-cols-5 gap-2">
            {([1, 2, 3, 4, 5] as RatingLevel[]).map((l) => (
              <div key={l} className="text-center">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">L{l}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{ratingLabels[l]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {domainSkills.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No skills are mapped to your domain yet. Please contact your domain lead.
        </div>
      ) : (
        <div className="space-y-3">
          {domainSkills.map((skill) => (
            <div key={skill.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{skill.skill_name}</p>
                  <p className="text-xs text-muted-foreground">{skill.skill_description}</p>
                </div>
                <Badge variant="secondary" className="text-xs font-normal shrink-0 ml-3">{skill.skill_category}</Badge>
              </div>
              <RatingSlider
                value={ratings[skill.id] ?? null}
                onChange={(rating) => handleRatingChange(skill.id, rating)}
                disabled={isLocked}
              />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {!isLocked && domainSkills.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            {Object.keys(ratings).length}/{domainSkills.length} skills rated
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!allRated} className="gap-1.5">
              <Send size={14} /> Submit & Generate Assessment
            </Button>
          </div>
        </div>
      )}

      {/* Locked state info */}
      {isLocked && (
        <div className="rounded-xl border border-success/20 bg-success/5 p-4 flex items-start gap-3">
          <CheckCircle size={18} className="text-success mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Submission Complete</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your self-assessment has been locked and an assessment has been automatically generated.
              Navigate to "Take Assessment" to complete your skill validation.
            </p>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Submission</DialogTitle>
            <DialogDescription>
              Once submitted, your skill ratings will be locked for this cycle ({currentCycle}) and an assessment will be automatically generated. You will not be able to change your ratings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 my-2">
            {Object.entries(ratings).map(([skillId, rating]) => {
              const skill = skills.find((s) => s.id === skillId);
              return (
                <div key={skillId} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5">
                  <span className="text-sm text-foreground">{skill?.skill_name}</span>
                  <span className="text-xs text-muted-foreground">Level {rating} — {ratingLabels[rating]}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmSubmit} className="gap-1.5">
              <Lock size={14} /> Confirm & Lock
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
