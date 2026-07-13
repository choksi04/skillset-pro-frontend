## Plan

1. **Make self-rating nullable in review data**
   - Update review models so `self_rating` can be missing instead of forcing a value.
   - Remove the current default-to-L3 behavior when no self-rating is found.

2. **Use the latest submitted self-registry only**
   - In both fixed and adaptive assessment submission flows, fetch the employee’s latest submitted registry ratings from the new registry tables.
   - Use those ratings when creating manager review rows.
   - If no submitted registry exists, pass no rating for that skill.

3. **Show “Not submitted” / hyphen instead of L3**
   - Update Team Assessment review UI so the Self Rating column shows:
     - actual submitted rating, e.g. `L4 – Advanced`, when available
     - a `Not submitted` badge or `—` when unavailable
   - Apply the same display rule anywhere the review self-rating row is reused.

4. **Fix adaptive assessment start-level fallback**
   - Keep self-rating-based start level when a submitted registry exists.
   - If no submitted registry exists, do not claim/display self-rating; only use internal fallback behavior where needed to run the assessment.

5. **Verify scope**
   - Cross-check Team Assessments and manager review panels so no UI path shows L3 as a fake self-rating.
   - Confirm existing completed reviews with stored L3 may still show their stored database value unless we separately run a data correction, which is outside this code-only fix.