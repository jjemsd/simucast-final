# Phase F plan — Axion-style redesign with SimuCast identity

Replaces the Phase E frontend-UI handoff. Backend work already
committed under Phase E (new AI endpoints, random forest, gradient
boosting, `Step.reasoning`, API wrappers) stays and is reused here.

## Decisions locked in

| # | Decision |
|---|---|
| 1 | **Palette**: keep SimuCast orange. Adopt Axion's layout, typography, card/pill primitives, warm off-white background, and semantic info/success/warning/danger colors. |
| 2 | **Workflow locks**: Data always open. Clean unlocks once a dataset exists. Describe/Tests/Advanced/Models/What-if/Report unlock when the user clicks a **"Data ready"** button on the Clean page (logs a `clean_completed` step; rollback re-locks). |
| 3 | **Phase E UI work is absorbed into Phase F.** The Phase E API wrappers land in the new views. The previous PHASE_E_HANDOFF.md is now reference-only for what's already in git. |
| 4 | **Advanced module (F.4)**: ship K-means clustering + PCA only. Survival and time series deferred. |
| 5 | **Variable roles**: one role per column globally (`ignore` / `feature` / `target` / `id`). Stored in `columns_info` next to dtype. Only one `target` allowed. |

---

## Design system translation

Adopt Axion's visual patterns while keeping our brand color.

### Tailwind additions

Add these tokens to `tailwind.config.js` → `theme.extend.colors`:

```js
colors: {
  brand: { /* existing orange scale */ },
  // NEW — semantic surfaces
  surface: {
    page:     '#faf9f5',   // warm off-white (Axion's tertiary bg)
    card:     '#ffffff',
    muted:    '#f5f4ef',   // hover / subtle
  },
  // NEW — status tint pairs
  ink: { info: '#185FA5', success: '#0F6E56', warning: '#854F0B', danger: '#A32D2D' },
  tint: { info: '#E6F1FB', success: '#E1F5EE', warning: '#FAEEDA', danger: '#FCEBEB' },
},
fontSize: {
  // Axion uses 10-14px for most UI; tighten our defaults
  'tiny': ['10px', '14px'],
  'mini': ['11px', '16px'],
}
```

### Primitive components to build

`frontend/src/components/ui/`:

- `Card.jsx` — white card, 0.5px border, 8px radius, configurable padding.
- `Pill.jsx` — rounded 14px pill with active state. Used for test types, model algorithms, category chips.
- `Chip.jsx` — smaller rounded 12px chip for tags/roles.
- `Btn.jsx` — replaces ad-hoc button classes. Variants: `default`, `prim` (filled with `text-primary`), `danger`.
- `Stat.jsx` — small metric block (label + big number).
- `AILabel.jsx` — the sparkle icon + "AI analyst" / "AI suggests" label used inline above AI cards.

Once these land, every view gets replaced to use them. No more bespoke button classNames.

### Color semantics across the app

| Use | Background | Text | Border |
|---|---|---|---|
| Default card | `surface-card` (white) | `gray-900` | `gray-200` |
| Page | `surface-page` (cream) | — | — |
| Info badge | `tint-info` | `ink-info` | — |
| Success badge | `tint-success` | `ink-success` | — |
| Warning badge | `tint-warning` | `ink-warning` | — |
| Danger badge | `tint-danger` | `ink-danger` | — |
| Active pill | `brand-50` | `brand-700` | — |

---

## Backend changes needed

Small — most is already in place.

### 1. Variable roles in `columns_info`

`columns_info` JSON becomes:

```json
{
  "age": {"dtype": "int64", "role": "feature"},
  "customer_id": {"dtype": "object", "role": "id"},
  "churned": {"dtype": "int64", "role": "target"}
}
```

**Migration** (`backend/database.py`, extend `run_migrations()`):
- Iterate all `Dataset` rows.
- If `columns_info` values are strings (old format), rewrite as `{dtype: value, role: default_role(name, idx, total)}`.
- Default roles:
  - Column name contains `id`, `uuid`, `email` → `id`.
  - Last column → `target`.
  - Everything else → `feature`.

**New endpoint**: `PATCH /api/data/<dataset_id>/column-roles`
Body: `{"roles": {"age": "feature", "churned": "target"}}`
Validates at most one `target`; writes back to `columns_info`. No Step is logged (roles are metadata, not transformations).

### 2. "Data ready" gate

New step type `clean_completed`. When user clicks **Mark data ready** on Clean:

- `POST /api/clean/<dataset_id>/mark-ready`
- Logs a `Step(step_type="clean_completed")`.
- `GET /api/projects/<id>` already returns `steps` — the frontend checks `steps.some(s => s.step_type === "clean_completed" && !s.reverted)` to unlock downstream modules.

Rollback works for free since it's a Step.

### 3. Advanced module

New file `backend/services/advanced_service.py` + routes file
`backend/routes/advanced.py`:

- `POST /api/advanced/<dataset_id>/kmeans` body `{features: [...], k: int}`
  - Returns `{labels: [...], cluster_stats: [{label, size, centroid}], inertia, silhouette}`.
  - Logs a `Step(step_type="kmeans")`.
- `POST /api/advanced/<dataset_id>/pca` body `{features: [...], n_components: int}`
  - Returns `{explained_variance_ratio, components, scores_sample}`.
  - Logs a `Step(step_type="pca")`.

Both use `StandardScaler` first (document in the Pipeline card).

### 4. Live What-if prediction

What-if currently calls `/api/whatif/<step_id>/predict` per click. The mockup implies prediction updates continuously as sliders move — need debouncing but no new endpoint. **No backend change**; frontend debounces at 200ms.

---

## Frontend tasks

### F.1 — Shell + design system

Goals: page feels like Axion, still orange.

**New files:**
- `frontend/src/components/ui/{Card,Pill,Chip,Btn,Stat,AILabel}.jsx`

**Edits:**
- `tailwind.config.js` — add `surface`, `ink`, `tint` color tokens. Keep `brand` as-is.
- `src/index.css` — page bg to `#faf9f5`; dark fallback block keeps its coverage.
- `src/layouts/AppShell.jsx` — match Axion header pattern (logo + crumb + auto-saved chip + avatar on the right).
- `src/components/Sidebar.jsx` — narrower (128px default), icons inline with labels, add a progress indicator at the bottom.
- `src/components/IconSidebar.jsx` (workspace) — reskin to match; keep resizable.

Nothing functionally changes. Call this done when Dashboard/Projects/Files all read as one system and the project workspace chrome matches.

### F.2 — Data page + Variable roles

- `backend/database.py` — migration to upgrade `columns_info` format.
- `backend/routes/data.py` — `PATCH /column-roles` endpoint.
- `frontend/src/api/data.js` — `updateColumnRoles(datasetId, roles)` wrapper.
- `frontend/src/views/DataView.jsx` — rewrite around:
  - `CurrentDatasetBar` (persistent, still required for other views) — stays small at the top.
  - **Variables table** (replaces the chip bar): Name · Type · Missing · Role. Role is a clickable `Chip`. Changing it PATCHes the roles.
  - **AI analyst card** at the top (reuses `/api/ai/suggestions?module=data`).
  - Preview table below.
- Downstream: `ModelView`, `TestsView`, `StatsView` read roles instead of asking the user to pick features from scratch.

### F.3 — Clean page (card-based accept/reject)

- `frontend/src/views/CleanView.jsx` — full rewrite.
  - Top: 3-up issue-count row (Missing · Outliers · Type issues).
  - Below: accept/reject cards driven by `/api/ai/suggestions?module=clean`. Each card has a badge (Missing/Outliers/Type/Expand), a title, a one-line why, and [Skip][Apply] buttons.
  - Apply calls the corresponding existing endpoint (`fill_missing`, `remove_outliers`, `convert_type`, or an expand op).
  - **Mark data ready** button at the bottom → `POST /api/clean/<id>/mark-ready`.
- Remove the old module-specific Clean tabs; keep a "Manual tools" disclosure at the bottom for users who want fine control.

### F.4 — Advanced module (new)

- `backend/services/advanced_service.py` — `kmeans()`, `pca()`.
- `backend/routes/advanced.py` — `POST /kmeans`, `POST /pca`.
- `backend/app.py` — register the new blueprint.
- `frontend/src/api/advanced.js` — `runKMeans`, `runPCA`.
- `frontend/src/views/AdvancedView.jsx`:
  - 2×2 grid of method cards: K-means (live), PCA (live), Survival (coming soon), Time series (coming soon). Greyed-out cards are acceptable.
  - K-means detail view: k slider, feature picker, result chart (scatter), cluster stats table.
  - PCA detail view: component slider, scree plot, loadings table.
- Update sidebar to include `Advanced` between `Tests` and `Models`.

### F.5 — Describe + Tests reskin

- `frontend/src/views/StatsView.jsx` → rename visually to **Describe** (keep the route/name internally). Bring in variable picker driven by roles, summary table, and a distribution histogram card.
- `frontend/src/views/TestsView.jsx` — pills for test type, setup card reading roles + a column selector, result card with left-border accent (Axion pattern), 4-up metric row, and AI explanation inset.
- Both views pull their `/api/ai/suggestions?module=stats|tests` and render the chip row above their setup card.

### F.6 — Models (with pipeline card + comparison + roles)

- `frontend/src/views/ModelView.jsx` — full rewrite.
  - Target auto-filled from the role `target` column.
  - Features auto-filled from role `feature` columns.
  - Algorithm pills row: Logistic / Linear / Tree / Forest / GBM (existing endpoints).
  - **Pipeline card** (static rules): "Will standardize numeric features (logistic/linear only), one-hot encode categoricals with drop_first, and split 80/20."
  - Multi-select mode: when 2+ algorithms are picked, train all in parallel and show comparison table (columns = metrics, rows = models, best cell highlighted).
  - Feature importance bars with mini-badges of top values / numeric range next to each feature.

### F.7 — What-if live sliders + scenario compare

- `frontend/src/views/WhatIfView.jsx`:
  - Big probability pill at the top (updates live).
  - Sliders with value labels on the right.
  - Plan/category tiers as Pills.
  - Two scenario cards side-by-side: A = baseline (saved on entry), B = current inputs (updates live). "Reset to baseline" syncs A = B.
- Frontend-only change; debounce prediction calls at 200ms.

### F.8 — Report toggles + narrative

- `frontend/src/views/ReportView.jsx`:
  - Left column: section checkboxes (Executive summary, Data overview, Descriptives, Test results, Model performance, What-if scenarios, Recommendations).
  - Right column: live-rendered preview that reflects current toggles.
  - Buttons: Export PDF / Word / Share link (existing endpoints).
- Narrative comes from `POST /api/ai/report-narrative` (new) — takes dataset + toggled sections, returns prose for each.

---

## Order of operations

```
F.1 (shell)  →  F.2 (Data + roles)  →  F.3 (Clean cards)
                              └────────→  F.6 (Models)   [uses roles]
                              └────────→  F.5 (Describe + Tests)   [uses roles]
                                           └────────→  F.4 (Advanced)
                                                         └────────→  F.7 (What-if)
                                                                       └────────→  F.8 (Report)
```

F.1–F.3 must land in order (roles underpin every downstream view). F.4–F.8 can happen in any order after F.3.

---

## Testing checklist

- [ ] Sidebar shows 8 items with icons + labels + progress indicator.
- [ ] Data page: change a column's role chip from Feature to Ignore — downstream Models view loses it automatically.
- [ ] Clean page: Apply a suggestion card; it greys out with an "Applied" badge. Re-open project — card is gone because the issue is fixed.
- [ ] Clean page: "Mark data ready" unlocks Describe/Tests/Advanced/Models/What-if/Report. Rollback the `clean_completed` step re-locks them.
- [ ] Advanced: k-means returns labeled scatter; PCA returns scree plot.
- [ ] Models: multi-select two algorithms → comparison table shows; best cell per column highlighted.
- [ ] What-if sliders update prediction <300ms after drag stops.
- [ ] Report preview updates live as section toggles flip.
- [ ] Dark mode still works (existing `html.dark` fallbacks cover most of it; new primitives need `dark:` variants baked in).

---

## What's already in git that F reuses

- `GET /api/data/<id>/profile` — column stats for hover popovers and AI prompts.
- `GET /api/ai/suggestions?dataset_id=X&module=Y` — per-module suggestions, drives the accept/reject cards.
- `POST /api/ai/explain-step` + `Step.reasoning` — per-step "why" in Timeline.
- `POST /api/ai/suggest-column-name` — for feature-engineering name suggestions.
- `POST /api/ai/suggest-model-features` — superseded by variable roles but keep it for the "Recommended roles" button on the Data page (F.2 can offer "Let AI set roles" as a one-click action).
- `POST /api/models/<id>/forest` and `/gbm` — wired into F.6.
- Frontend API wrappers in `api/ai.js` and `api/models.js`.

---

## Files to create

```
frontend/src/components/ui/Card.jsx
frontend/src/components/ui/Pill.jsx
frontend/src/components/ui/Chip.jsx
frontend/src/components/ui/Btn.jsx
frontend/src/components/ui/Stat.jsx
frontend/src/components/ui/AILabel.jsx
frontend/src/views/AdvancedView.jsx
frontend/src/api/advanced.js
backend/services/advanced_service.py
backend/routes/advanced.py
```

## Files to rewrite

```
frontend/src/views/DataView.jsx
frontend/src/views/CleanView.jsx
frontend/src/views/StatsView.jsx       (renamed Describe visually)
frontend/src/views/TestsView.jsx
frontend/src/views/ModelView.jsx
frontend/src/views/WhatIfView.jsx
frontend/src/views/ReportView.jsx
frontend/src/components/Sidebar.jsx
frontend/src/layouts/AppShell.jsx
frontend/src/components/IconSidebar.jsx
```

## Files to edit (small)

```
frontend/tailwind.config.js    — add surface/ink/tint tokens
frontend/src/index.css         — page bg + dark fallbacks for new tokens
frontend/src/api/data.js       — updateColumnRoles wrapper
backend/database.py            — columns_info migration
backend/models.py              — columns_info accessor helpers (optional)
backend/routes/data.py         — PATCH /column-roles
backend/routes/clean.py        — POST /mark-ready
backend/routes/ai.py           — POST /report-narrative (F.8)
backend/app.py                 — register advanced blueprint
```
