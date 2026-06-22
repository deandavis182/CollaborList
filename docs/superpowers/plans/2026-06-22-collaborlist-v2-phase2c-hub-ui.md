# CollaborList V2 — Phase 2C: Hub UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Read the roadmap first: `docs/superpowers/plans/2026-06-22-collaborlist-v2-roadmap.md`. Steps use `- [ ]`. Branch: `v2-phase2-frontend`.

**Goal:** Build the hub management UI (workspaces, projects, tags, membership) on the Phase 2B shell, consuming the Phase 2A REST APIs, so a user can navigate and manage their hub structure in the new app — running ALONGSIDE the existing app (reachable via a separate `/v2.html` entry), NOT replacing it.

**Architecture:** Approach A + design system. Extend `frontend/src/lib/api.js` with the remaining React Query hooks, build feature UI under `frontend/src/features/`, render it through the 2B `AppLayout`/`Sidebar`/router. All token-styled via the 2B `ui/` primitives.

**Tech Stack:** React 18, Vite 5, Tailwind (tokens), react-router-dom v6, @tanstack/react-query v5, zustand; Vitest + Testing Library.

## IMPORTANT scope decision — parity flip is DEFERRED
The roadmap originally called 2C the "parity-flip point." That is revised: the new shell still has NO list/item editing (that's Phase 3 collaboration + Phase 4 views). Flipping `main.jsx` now would ship an app that can't edit items. **Therefore: do NOT touch `frontend/src/main.jsx` or `frontend/index.html`. Instead add a second Vite entry `frontend/v2.html` → `main-v2.jsx`** so the new hub is previewable at `/v2.html` without disturbing the live app. The real parity flip happens after Phase 4 (tracked in the roadmap).

## Global Constraints
- Live app untouched: `main.jsx`, `index.html`, `RealtimeApp.jsx` unchanged.
- Every task TDD (Vitest + Testing Library), mock api hooks (`vi.mock('../../lib/api')`) so no network.
- Token-styled via `ui/` primitives; no hardcoded colors.
- React Query keys consistent with 2B: `['workspaces']`, `['projects', workspaceId]`, plus new `['projectLists', projectId]`, `['tags', workspaceId]`, `['members', workspaceId]`.
- NO `Co-Authored-By` trailer. `cd frontend && npm test` green + `npm run build` succeeds after every task.

## File Structure
- `frontend/src/lib/api.js` (extend) — add hooks: `useRenameWorkspace`, `useDeleteWorkspace`, `useWorkspaceMembers`, `useAddMember`, `useRemoveMember`, `useUpdateProject`, `useDeleteProject`, `useProjectLists(projectId)`, `useTags(workspaceId)`, `useCreateTag`, `useDeleteTag`. (Endpoints all exist from Phase 2A.)
- `frontend/src/features/workspaces/` — `WorkspaceSwitcher.jsx`, `WorkspaceSettings.jsx` (rename/delete), `CreateWorkspaceDialog.jsx`.
- `frontend/src/features/projects/` — `ProjectList.jsx` (tree in sidebar), `ProjectView.jsx` (a project's lists), `CreateProjectDialog.jsx`, `ProjectSettings.jsx` (color/wedding_date/archive/delete).
- `frontend/src/features/tags/` — `TagManager.jsx`.
- `frontend/src/features/members/` — `MemberManager.jsx` (list/add-by-email/remove).
- `frontend/src/app/routes.jsx` (extend) — real views replacing placeholders.
- `frontend/v2.html` + `frontend/vite.config.js` (modify) — second entry for the new shell.

## Tasks (each TDD with bite-sized steps; expand on execution)

1. **api.js hooks — projects & project-lists.** Add `useUpdateProject`, `useDeleteProject`, `useProjectLists(projectId)` (GET /api/projects/:id/lists, key `['projectLists', projectId]`). Tests with mocked apiClient.
2. **api.js hooks — workspace mgmt, tags, members.** Add `useRenameWorkspace` (PUT /api/workspaces/:id), `useDeleteWorkspace` (DELETE), `useTags`/`useCreateTag`/`useDeleteTag` (/:id/tags), `useWorkspaceMembers`/`useAddMember`/`useRemoveMember` (/:id/members). Optimistic where it makes sense; invalidate the right keys. Tests.
3. **Second Vite entry `/v2.html`.** Add `frontend/v2.html` (mirrors index.html but loads `/src/main-v2.jsx`) and configure Vite `build.rollupOptions.input` to include both `index.html` (live) and `v2.html` (new). Verify `npm run build` emits both; live `index.html`/`main.jsx` unchanged. Test/build check.
4. **Workspace switcher + create.** `WorkspaceSwitcher` (dropdown listing workspaces, active = store `currentWorkspaceId`, switch sets it) + `CreateWorkspaceDialog` (uses `useCreateWorkspace`, a `Sheet`/dialog with a `Field`+`Button`). Wire into `Sidebar`. Tests: renders workspaces, create calls hook, switch updates store.
5. **Projects tree + create + project view.** `ProjectList` in the sidebar under the current workspace (from `useProjects`), each links to `/w/:wsId/p/:projectId`; `CreateProjectDialog` (`useCreateProject`); `ProjectView` renders the project's lists via `useProjectLists` (read-only list cards — item editing stays in the old app for now; link out or show a note). Tests.
6. **Project settings.** `ProjectSettings` (rename, color picker, `wedding_date` via `Field` date input, archive toggle, delete) using `useUpdateProject`/`useDeleteProject`. The `wedding_date` is what Phase 4's countdown will use. Tests.
7. **Tag manager + member manager.** `TagManager` (list/create/delete tags for current workspace) and `MemberManager` (list members, add by email with role select, remove; handle the 404 "no user with that email" from the API gracefully). Tests.
8. **Wire routes + apply carried-over 2B minors.** Replace route placeholders with real views (Home = workspace overview; project route = ProjectView; settings routes/dialogs reachable). Apply the 2B checkpoint minors: `SegmentedControl` aria-label passthrough, `Card` color-mix → tailwind opacity fallback, `Sheet` focus-trap. Tests + final build.

## Self-Review checklist
- Live app untouched (main.jsx/index.html/RealtimeApp.jsx unchanged); new shell only at /v2.html.
- All 2A endpoints consumed via typed hooks with consistent query keys.
- Every task TDD; no network in tests.
- Parity flip NOT performed (deferred to post-Phase-4 per roadmap).

## Hand-off
After 2C: run the Phase 2 whole-branch final review over `v2-phase2-frontend`, then merge to main. Phase 3 (collaboration) + Phase 4 (views) add item management to the new shell; the parity flip of `main.jsx` happens once that lands. Update the roadmap's "parity-flip point" note accordingly.
