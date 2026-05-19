## Notification panel — better organization + mark-all-read

Improve `src/components/layout/NotificationDropdown.tsx` so all three roles can scan notifications fast and act on what needs attention.

### Common changes (apply regardless of option chosen)

1. **"Mark all as read" button** in the header — only shown when `unread > 0`. Updates all unread rows for the current user/role in one query (`supabase.from('notifications').update({ read: true }).in('id', unreadIds)`), then updates local state.
2. **Type badge** per notification — small colored pill with a human label + icon. Mapping (derived from the 6 existing types in DB):

  | type                   | Label      | Icon           | Tone    |
  | ---------------------- | ---------- | -------------- | ------- |
  | `assessment_assigned`  | Assessment | ClipboardCheck | indigo  |
  | `assessment_reminder`  | Reminder   | BellRing       | amber   |
  | `assessment_completed` | Assessment | CheckCircle2   | emerald |
  | `review_completed`     | Review     | UserCheck      | blue    |
  | `registry_submitted`   | Registry   | FileCheck      | violet  |
  | &nbsp;                 | &nbsp;     | &nbsp;         | &nbsp;  |

3. **Relative timestamps** — "2h ago", "Yesterday", "3 Apr". Hover shows full datetime.
4. **Widen panel** to `w-96` and raise max height to `max-h-[28rem]` to fit the richer rows.
5. **Unread dot** instead of just a background tint — clearer affordance.

### Three organization options to choose from

```text
OPTION A — Grouped by date (recommended default)
┌──────────────────────────────────────────────┐
│ Notifications        Mark all as read  •  3  │
├──────────────────────────────────────────────┤
│ TODAY                                        │
│ • [Assessment] React Basics assigned   2h ago│
│ • [Reminder]   Submit registry by Fri  5h ago│
│ YESTERDAY                                    │
│ • [Review]     Lead approved your reg.       │
│ EARLIER                                      │
│ • [Cycle]      Q2 cycle activated      3 Apr │
└──────────────────────────────────────────────┘
```

Buckets: Today / Yesterday / This Week / Earlier. Familiar (Gmail/Linear pattern). Best when chronology matters most — most users skim newest first.

```text
OPTION B — Grouped by "Needs action" vs "Updates"
┌──────────────────────────────────────────────┐
│ Notifications        Mark all as read  •  3  │
├──────────────────────────────────────────────┤
│ NEEDS YOUR ACTION (2)                        │
│ • [Assessment] React Basics — Start    2h ago│
│ • [Reminder]   Submit registry by Fri  5h ago│
│ UPDATES (4)                                  │
│ • [Review]     Lead approved your reg.   1d  │
│ • [Cycle]      Q2 cycle activated      3 Apr │
└──────────────────────────────────────────────┘
```

Action-required types: `assessment_assigned`, `assessment_reminder`, `registry_submitted` (manager view), `cycle_activated` (admin/employee to act). Informational: `assessment_completed`, `review_completed`. Drives behavior, surfaces what to do next. Best for employees with task overload.

```text
OPTION C — Tabbed by Category with date subgroups inside
┌──────────────────────────────────────────────┐
│ Notifications        Mark all as read  •  3  │
│ [ All ] [ Assessments ] [ Reviews ] [ Cycles]│
├──────────────────────────────────────────────┤
│ TODAY                                        │
│ • [Assessment] React Basics assigned   2h ago│
│ YESTERDAY                                    │
│ • [Assessment] Reminder: Python quiz         │
└──────────────────────────────────────────────┘
```

Tabs filter by category (Assessments / Reviews / Registry / Cycle). Inside each tab, items group by date. Best for admins/managers with high volume across many workflows.

### Recommendation

Default to **Option A** as the base layout, with **Option B's "Needs action" pinned section on top** as a lightweight hybrid — so a typical employee sees a clear "do this" stack at the top, followed by chronological history. Option C tabs can be a follow-up if volume grows.

### Out of scope

- No DB schema changes (existing `notifications` table already has `type`, `read`, `created_at`, `action_link`).
- No new notification types — only relabeling existing ones for display.
- No realtime subscription work; current fetch-on-mount stays.

Pick A, B, C, or the hybrid (A + pinned action section) and I'll implement.

Implement option A only. We will think about implementing option B in future.