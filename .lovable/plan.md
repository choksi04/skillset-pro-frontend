

# Comprehensive System Fix & Enhancement Plan

## ✅ Phase 1: Critical Bugs & Data Freshness — COMPLETED

### 1A. ✅ Remove Hard-Caching from all stores
All 8 Zustand stores now always re-fetch from DB (removed `initialized` early-return guards).

### 1B. ✅ Fix MCQ Scoring Bug
Rewrote `evaluateMCQ` to parse `correctIndex` from `question_text` JSON. Falls back to `evaluation_guidelines` regex. Converts user letter (A-D) to index for comparison.

### 1C. ✅ Hide Expected Output in Coding Questions
Removed "Expected Output" section from `AssessmentExecPage.tsx` coding question display.

### 1D. ✅ Fix Domain Skill Re-mapping Bug
Resolved by Phase 1A — store now always refreshes from DB including soft-deleted mappings.

### 1E. ✅ Multi-Select Publish for Questions
Added `bulkPublish` to `questionStore.ts`, checkbox selection column + bulk "Publish Selected" action bar to `QuestionBankPage.tsx`.

### 1F. ✅ Improved AI Scoring Accuracy
Updated evaluate-assessment edge function with more detailed scoring rubric, step-by-step reasoning requirements, and stricter scoring guide.

---

## Phase 2: Rename `question_settings` → `competency_levels` Table

### 2A. Database Migration
- Rename table `question_settings` to `competency_levels`

### 2B. Code Updates
- Rename `QuestionSetting` type to `CompetencyLevel` across all stores
- Update all Supabase queries from `.from('question_settings')` to `.from('competency_levels')`
- Update all imports across files that reference `QuestionSetting` or `fetchSettings`

### 2C. Scan and Remove Hardcoded Values
- Fallback competency maps in `assessmentStore.ts`
- `ratingLabels` and `ratingDescriptions` in `registryStore.ts`
- `scoreToLevel` thresholds in `attemptStore.ts`
- Deprecated `competencyLevels` and `competencyLabels` exports in `questionStore.ts`

---

## Phase 3: Assessment Config & Predictable Question Selection

### 3A. New `assessment_config` Table
### 3B. Assessment Config Admin UI
### 3C. Rewrite Question Selection Logic (exact level match, per-type min/max)
### 3D. Pre-Validation Before Cycle Activation
### 3E. Improve AI Scoring Accuracy

---

## Phase 4: Review Cycle Prerequisites, Flexibility & Manual Overrides

### 4A. Review Cycle Activation Prerequisites Checklist
### 4B. Domain Selection for Cycle Activation
### 4C. Dynamic Employee Eligibility
### 4D. Manual Override Capabilities
