# CollaborList V2 — Phase 2B: Frontend Shell + Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Read the roadmap first: `docs/superpowers/plans/2026-06-22-collaborlist-v2-roadmap.md`. Steps use `- [ ]` checkboxes.

**Goal:** Stand up the new frontend foundation — routing, a design system (tokens + primitives), server-state + real-time data layer, and a responsive app shell — WITHOUT replacing the live `RealtimeApp.jsx`. The new shell mounts at a separate dev route/entry so the existing app keeps working until Phase 2C reaches parity and flips `main.jsx`.

**Architecture:** Approach A + design-system discipline. Add React Router, `@tanstack/react-query` (server state with optimistic mutations), Zustand (ephemeral UI/real-time state), and a Vitest + Testing Library setup (none exists today). Build `ui/` (tokens + primitives), `lib/` (api/socket/store), and `app/` (shell + routes). Consumes the Phase 2A APIs (`/api/workspaces`, `/api/projects`, etc.).

**Tech Stack:** React 18.2, Vite 5, Tailwind 3.4, react-router-dom 6, @tanstack/react-query 5, zustand 4, socket.io-client 4.6, axios 1.6; Vitest + @testing-library/react + jsdom for tests.

## Global Constraints
- **Do NOT modify `RealtimeApp.jsx` or change what `main.jsx` renders.** The live app must keep working byte-for-byte. The new shell is reached via a separate entry (e.g. a `?v2=1` guard in `main.jsx` that is OFF by default, or a separate `main-v2.jsx` + a dev-only route) — the parity flip is Phase 2C, not here.
- **Frontend tests:** add `vitest` + `@testing-library/react` + `jsdom`; `npm test` in `frontend/` runs them. Every component/hook task is TDD.
- **No backend changes** in this phase.
- **Commit messages:** NO `Co-Authored-By` trailer.
- **Design direction:** use the `frontend-design` skill for the token palette/typography so the UI is distinctive (not default Tailwind blue). Tokens live once in `tailwind.config.js` + CSS variables; light/dark via a `data-theme` attribute or `dark:` class strategy.
- **Auth reuse:** the new `lib/api.js` reads the same `localStorage` `token` the current app uses, and sets the `Authorization` header — so a user logged into the old app is logged into the new shell.

## File Structure
- `frontend/vitest.config.js`, `frontend/src/test/setup.js` (new) — test infra.
- `frontend/src/ui/tokens.css` + `tailwind.config.js` (modify) — design tokens (palette, type scale, spacing, radius, motion), light/dark.
- `frontend/src/ui/` (new) — `Button.jsx`, `Card.jsx`, `Chip.jsx`, `Avatar.jsx`, `Sheet.jsx`, `Field.jsx`, `SegmentedControl.jsx`, `Toast.jsx`, `index.js`.
- `frontend/src/lib/` (new) — `api.js` (axios instance + React Query hooks for workspaces/projects), `socket.js` (socket client + cache-patch handlers), `store.js` (Zustand: current workspace/project, UI flags, presence placeholder).
- `frontend/src/app/` (new) — `AppLayout.jsx` (responsive: desktop sidebar + main + drawer; mobile bottom-tab), `Sidebar.jsx`, `BottomTabBar.jsx`, `routes.jsx` (router config), `providers.jsx` (QueryClientProvider + router + theme).
- `frontend/src/main-v2.jsx` (new) — alternate entry mounting the new shell (NOT wired into index.html; used by a dev route or a guarded toggle). 
- `frontend/package.json` (modify) — add deps + `test` script.

## Tasks (summary — each is TDD with bite-sized steps; expand on execution)

> Each task: write failing test → run (`cd frontend && npm test`) → implement → run → commit. Mirror the Phase 2A rigor. The first task establishes the test runner, so its "test" is that the runner executes a trivial passing spec.

1. **Frontend test infra + deps.** Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`; add `react-router-dom`, `@tanstack/react-query`, `zustand`. Create `vitest.config.js` (jsdom env, setup file) + `src/test/setup.js` (jest-dom matchers). Add `"test": "vitest run"` + `"test:watch": "vitest"` to package.json. Prove it runs with one trivial spec. Confirm `npm run build` still succeeds.
2. **Design tokens.** Define the palette/type/spacing/radius/motion tokens as CSS variables in `ui/tokens.css` (light + dark) and extend `tailwind.config.js` to consume them. Import `tokens.css` from the new entry only. Snapshot/DOM test that a `data-theme="dark"` toggle changes a token-driven class. (Use `frontend-design` skill for the actual values.)
3. **UI primitives (part 1): `Button`, `Card`, `Chip`, `Avatar`.** Each a small, prop-driven, token-styled component with a Testing Library test (renders, variant classes, click handler). Export from `ui/index.js`.
4. **UI primitives (part 2): `Sheet`/`Drawer`, `Field`, `SegmentedControl`, `Toast`.** Same rigor. `Sheet` handles desktop side-drawer vs mobile full-screen via a prop. `SegmentedControl` is the view-switcher used in Phase 4.
5. **Data layer — `lib/api.js`.** Axios instance with the `Authorization` header from `localStorage.token`; React Query hooks: `useWorkspaces`, `useCreateWorkspace`, `useProjects(workspaceId)`, `useCreateProject`, with optimistic mutation + rollback (port the temp-id pattern from RealtimeApp into `onMutate`/`onError`). Test with a mocked axios/`QueryClientProvider`.
6. **Data layer — `lib/store.js` + `lib/socket.js`.** Zustand store for `currentWorkspaceId`/`currentProjectId`/UI flags/presence map. `socket.js` connects with the JWT and patches the React Query cache on `list-*`/`workspace-*` events (no refetch). Unit-test the store; test socket handlers patch the cache given a mock event.
7. **App shell — `AppLayout` + `Sidebar` + `BottomTabBar` + `providers`.** Responsive layout (desktop 3-zone, mobile bottom tabs) built from primitives; renders workspace/project nav from `useWorkspaces`/`useProjects` (data wiring; the rich hub UX is Phase 2C). Tests: renders sidebar on desktop width, bottom bar on mobile width (matchMedia mock), shows workspaces from a mocked hook.
8. **Router + alternate entry.** `routes.jsx` with `/w/:workspace/p/:project` routes rendering placeholders inside `AppLayout`; `main-v2.jsx` mounts `providers` + router. Verify `npm run build` builds both entries (or that `main-v2` is reachable via a dev toggle) and the LIVE `main.jsx`/`RealtimeApp` is unchanged. Test: navigating to a workspace route renders the shell with that route's param.

## Self-Review checklist (run after writing detailed steps)
- Live app untouched (main.jsx unchanged; RealtimeApp.jsx untouched).
- Every task has a real failing-then-passing test; test infra task comes first.
- Tokens defined once; primitives consume tokens, not hardcoded colors.
- api.js reuses the existing localStorage token (no separate auth).
- No backend changes.

## Hand-off to Phase 2C
2C ("Hub UI") builds the workspace switcher, projects tree, lists-under-projects, tag UI, and membership UI on this shell, then performs the parity flip of `main.jsx` to the new entry once feature parity with `RealtimeApp.jsx` is verified.
