# CollaborList V2 — Phase 5: Structured Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Read the roadmap first, then design spec §5 + §8. Steps `- [ ]`. **Branch: `v2-phase5-fields`** off `main`.

**Goal:** Lightweight typed custom fields per list (number/text/date/status/person) with values per item, two starter presets ("Budget tracker", "Guest list"), inline rendering in the List view + detail drawer, and footer roll-ups (Σ total / Σ paid / remaining; confirmed headcount) — so wedding budget + guest headcount are trackable without a spreadsheet.

**Architecture:** Approach A. Schema already exists (migration 007: `field_defs(list_id,key,type,label,config jsonb,position)` UNIQUE(list_id,key); `item_fields(item_id,key,type,value jsonb)` UNIQUE(item_id,key)). NO new migration. New real-router `routes/fields.js` (testable via supertest) for field-def CRUD + presets + per-item value upsert. Items' read endpoints enriched with a `fields` map. Roll-ups computed on the frontend from item field values. New socket event `field-updated`.

**Tech Stack:** Express + pg (additive); React 18 + Vite, React Query, @dnd-kit (n/a here), Vitest. The new shell is now the app at `/`.

## Global Constraints (every task inherits)
- ADDITIVE only; no migration. cross-list-move + all suites green. Build backend test image before backend tests (`docker compose --profile test build backend-test`); integration via `jest.integration.config.js` (globalSetup migrates).
- Permissions: field-def CRUD requires list **edit** (owner or list_shares edit); reading fields requires list **view**; item field value upsert requires item **edit** (reuse `services/itemAccess.js` getItemAccess). Mirror the established list/item permission SQL.
- Field types EXACTLY: `number | text | date | status | person`. Status options live in the field def's `config.options` (array of labels). Person = a workspace member user_id.
- Query keys: `['fieldDefs', listId]`; item field values come embedded in the item payload (`item.fields` = `{ [key]: value }`), refreshed via `['items', listId]` / `['projectItems']`.
- Event names ONLY from `realtime/events.js` (BE) / `lib/events.js` (FE); add `FIELD_UPDATED: 'field-updated'`.
- ui/ primitives + design tokens, no hardcoded hex. String()/Number() coercion. Dates via `lib/dates.js`.
- NO `Co-Authored-By`. Report files under `.superpowers/sdd/` are gitignored — implementers must NOT git-commit them. Live app = the new shell (no separate v2.html anymore).

## Presets (exact)
- **Budget tracker:** field defs (on the list) — `cost` (number, label "Cost", config `{unit:'$'}`), `payment` (status, label "Payment", config `{options:['Estimated','Booked','Paid']}`). Footer roll-up: Σ cost (total), Σ cost where payment='Paid' (paid), remaining = total − paid.
- **Guest list:** field defs — `party_size` (number, label "Party size"), `rsvp` (status, label "RSVP", config `{options:['Invited','Yes','No','Maybe']}`). Footer roll-up: total invited = Σ party_size (all), confirmed headcount = Σ party_size where rsvp='Yes'.

## Tasks

### Backend
1. **fieldService + itemFieldService + routes/fields.js + items enrichment + FIELD_UPDATED.**
   - `backend/realtime/events.js`: add `FIELD_UPDATED: 'field-updated'`.
   - `backend/services/fieldService.js`: `listDefs(pool, listId)`; `createDef(pool, listId, {key,type,label,config,position})` (validate type ∈ the 5; UNIQUE(list_id,key) → upsert or 409); `updateDef(pool, defId, fields)`; `removeDef(pool, defId)`; `applyPreset(pool, listId, presetName)` (creates the preset's defs idempotently; presetName ∈ 'budget'|'guests'); `getListAccess(pool, listId, userId)` → {found,isOwner,canView,canEdit} (mirror getItemAccess but for a list).
   - `backend/services/itemFieldService.js`: `setValue(pool, itemId, {key,type,value})` (UPSERT into item_fields ON CONFLICT(item_id,key) DO UPDATE); `removeValue(pool,itemId,key)`; `fieldsForItem(pool,itemId)` → `{key:value}` map.
   - `backend/routes/fields.js` factory `(authenticateToken, sanitize, emit) => router` mounted at `/api`:
     - `GET /api/lists/:listId/field-defs` (view) → listDefs.
     - `POST /api/lists/:listId/field-defs` (edit) → createDef; emit FIELD_UPDATED to list room.
     - `PUT /api/field-defs/:id` (edit, via the def's list) → updateDef; emit.
     - `DELETE /api/field-defs/:id` (edit) → removeDef; emit.
     - `POST /api/lists/:listId/field-presets` body `{preset}` (edit) → applyPreset; emit.
     - `PUT /api/items/:id/fields` body `{key,type,value}` (item edit via getItemAccess) → setValue; emit FIELD_UPDATED to the item's list room with `{listId,itemId}`. (null/empty value → removeValue.)
   - Enrich `GET /api/lists/:listId/items` (inline server.js) AND `GET /api/projects/:id/items` (routes/projects.js) so each item also carries `fields` = a `{key:value}` object (correlated json_object_agg over item_fields, default `{}`).
   - Mount fields router in server.js with `{ list: emitListUpdate }`.
   - **Tests:** real-router integration (`backend/__tests__/fields.integration.test.js`): create defs / list defs (view vs edit authz, 403); apply 'budget' + 'guests' presets create the right defs (idempotent on re-apply); set an item field value (upsert + overwrite); items endpoints return `fields` map; non-edit user setting a value → 403. Run integration twice.

### Frontend
2. **Hooks + events mirror + socket handler.** `lib/events.js`: add `FIELD_UPDATED`. `lib/api.js`: `useFieldDefs(listId)` (GET, key `['fieldDefs',listId]`), `useCreateFieldDef(listId)`, `useUpdateFieldDef(listId)`, `useDeleteFieldDef(listId)`, `useApplyFieldPreset(listId)` (POST field-presets), `useSetItemField(listId)` (PUT /items/:id/fields {key,type,value}; invalidate `['items',listId]`+`['projectItems']`). `lib/socket.js`: handle `FIELD_UPDATED` → invalidate `['items',payload.listId]`, `['projectItems']`, and `['fieldDefs',payload.listId]`. Tests.
3. **FieldsManager** (`features/fields/FieldsManager.jsx`) — a sheet/panel (opened from a "Fields" button in the list ViewContainer header) to: list current field defs, add a def (key+type+label, and options for status), delete a def, and two one-click preset buttons ("Budget tracker", "Guest list"). Uses the hooks. Tests.
4. **Field inputs in ItemDetailDrawer** — render each `useFieldDefs(listId)` def as a typed input bound to `item.fields?.[def.key]`: number→number input, text→text, date→date (via lib/dates), status→SegmentedControl/select over `config.options`, person→member select (from useWorkspaceMembers). Change → `useSetItemField(listId).mutate({itemId, key, type, value})`. A "Fields" section in the drawer. Tests.
5. **Inline field cells + footer roll-ups in ListViewLens.** Show a compact cell per field def on each row (read-only summary of `item.fields[key]`). A footer (`features/fields/FieldRollups.jsx`) computing, over the list's items: for each number field, Σ; PLUS preset-aware roll-ups — if defs include `cost`+`payment`: Σ cost (total), Σ cost where payment='Paid', remaining; if `party_size`+`rsvp`: Σ party_size (invited), Σ party_size where rsvp='Yes' (confirmed). Render the footer under the list lens (pass `fieldDefs` + items in). Tests (rollup math pure-tested + rendered). (Board card field metadata optional — only if quick.)
6. **Playwright E2E** (live, against `/`): on a list, open Fields → apply "Budget tracker"; open two items, set cost + payment; verify the footer shows total/paid/remaining correctly. Apply "Guest list" on another list; set party_size + rsvp; verify confirmed headcount. Fix any runtime bugs. Screenshot.

## Self-Review checklist
- Schema reused (no migration); additive endpoints; cross-list-move + suites green.
- Presets create exactly the specified defs (idempotent); roll-up math correct (total/paid/remaining; confirmed headcount).
- Field-def CRUD = list edit; value upsert = item edit; read = view (403s tested).
- FIELD_UPDATED catalogued + emitted + handled (live refresh). Dates via lib/dates. No hardcoded hex. No Co-Authored-By.
- E2E verifies budget + guest presets end-to-end.

## Hand-off
After Phase 5: whole-branch final review → merge to main → rebuild → update roadmap + memory. Then Phase 6 (PWA + Web Push), Phase 7 (attachments/automations, optional).
