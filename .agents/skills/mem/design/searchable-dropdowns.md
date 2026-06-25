---
name: searchable-dropdowns
description: All dropdowns must be searchable
type: preference
---
All `<Select>` dropdowns across the app must be searchable. Use `SearchableSelect` from `@/components/ui/searchable-select` instead of raw shadcn `Select` for any new or modified dropdown. The shared `FilterBar` already uses SearchableSelect. When editing a file that has a non-searchable `Select`, convert it during the edit.
