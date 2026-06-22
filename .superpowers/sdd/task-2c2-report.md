# Task 2C2 Report — Workspace-management, tag, and member hooks

## Files Modified

- `frontend/src/lib/api.js` — added 8 new exported hooks
- `frontend/src/lib/__tests__/api.test.jsx` — extended with 24 new tests (16 new imports)

## Hooks Added

| Hook | Method | URL | Invalidates |
|------|--------|-----|-------------|
| `useRenameWorkspace()` | PUT | `/workspaces/:id` | `['workspaces']` |
| `useDeleteWorkspace()` | DELETE | `/workspaces/:id` | `['workspaces']` |
| `useTags(wsId)` | GET | `/workspaces/:id/tags` | query key `['tags', wsId]`, disabled when null/undefined |
| `useCreateTag(wsId)` | POST | `/workspaces/:id/tags` | `['tags', wsId]` |
| `useDeleteTag(wsId)` | DELETE | `/workspaces/:id/tags/:tagId` | `['tags', wsId]` |
| `useWorkspaceMembers(wsId)` | GET | `/workspaces/:id/members` | query key `['members', wsId]`, disabled when null/undefined |
| `useAddMember(wsId)` | POST | `/workspaces/:id/members` | `['members', wsId]`, errors propagate |
| `useRemoveMember(wsId)` | DELETE | `/workspaces/:id/members/:userId` | `['members', wsId]` |

## Test Output

```
Test Files  17 passed (17)
     Tests  231 passed (231)  (53 in api.test.jsx, 24 newly added)
  Duration  2.58s
```

## Build Output

```
vite v5.4.21 building for production...
✓ 119 modules transformed.
dist/index.html                   2.07 kB │ gzip:   0.93 kB
dist/assets/index-Czd-Rbmj.css   25.34 kB │ gzip:   5.13 kB
dist/assets/index-BiLQq-q3.js   313.33 kB │ gzip: 101.05 kB
✓ built in 773ms
```

## Concerns

None. All hooks follow the established pattern. `useAddMember` intentionally lets errors propagate without catching them (the mutation's `isError`/`error` state is available to the UI for the 404 "no such user" case). Color is excluded from the POST body when not provided (matches `useCreateProject` pattern).
