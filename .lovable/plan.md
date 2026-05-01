# Hard-delete Discarded Draft Registries

Currently, discarding a draft registry performs a **soft delete** (sets `deleted_on` / `deleted_by` on `skill_registries`). The row stays in the database, only filtered out by `.is('deleted_on', null)` in queries. The requirement is to **hard-delete** discarded drafts so no trace remains.

## Changes

### 1. `src/stores/skillRegistryStore.ts` — `discardDraft`

Replace the soft-delete UPDATE with a hard DELETE. Also delete child `skill_registry_items` first (no FK cascade is defined in the schema, so we must clean up explicitly to avoid orphans).

```ts
discardDraft: async (registryId: string) => {
  // Safety: only allow deleting drafts
  const reg = get().registries.find(r => r.id === registryId);
  if (!reg || reg.status !== 'draft') {
    throw new Error('Only draft registries can be discarded');
  }

  // 1. Delete child items
  const { error: itemsErr } = await supabase
    .from('skill_registry_items')
    .delete()
    .eq('registry_id', registryId);
  if (itemsErr) {
    console.error('Failed to delete registry items:', itemsErr);
    throw itemsErr;
  }

  // 2. Hard delete the registry (status check enforced again at DB level)
  const { error } = await supabase
    .from('skill_registries')
    .delete()
    .eq('id', registryId)
    .eq('status', 'draft');

  if (error) {
    console.error('Failed to discard draft:', error);
    throw error;
  }

  // 3. Update local cache
  set((state) => {
    const newItems = new Map(state.items);
    newItems.delete(registryId);
    return {
      registries: state.registries.filter((r) => r.id !== registryId),
      items: newItems,
    };
  });
},
```

Notes:
- Status guard prevents accidental hard-delete of submitted/approved registries.
- Items table has no FK cascade in the current schema, so explicit cleanup is required.
- No other tables (`registry_reviews`, `registry_review_items`) reference draft registries — reviews are only created after submission.

### 2. Memory update

Update `mem://features/skill-registry/discard-draft` to record that discarding a draft now performs a **hard delete** of the registry and its items (not soft-delete). Update `mem://index.md` description accordingly.

## Out of Scope

- No schema migration needed; we are just changing the SQL operation issued by the client.
- Soft-delete semantics remain unchanged for submitted registries and all other entities.
- No UI/UX changes — the existing confirmation dialog already warns the user.
