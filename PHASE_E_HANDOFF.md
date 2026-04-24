# Phase E handoff

> **Superseded by [`PHASE_F_PLAN.md`](./PHASE_F_PLAN.md) for the
> frontend UI.** The backend endpoints and API wrappers listed below
> are already committed on branch `claude/deploy-to-production-0kQw7`
> and are reused by Phase F. The frontend task list here
> (`CurrentDatasetBar`, `AISuggestions` panels in each view, Timeline
> reasoning, etc.) is absorbed into Phase F's view rewrites — use
> the Phase F plan as the single source of truth going forward.

Backend + frontend API wrappers are landed on branch
`claude/deploy-to-production-0kQw7`. Frontend UI was originally
planned here but now lives in Phase F.

## Source: panelist feedback (verbatim)

> I think we need to change the UI, workflow to make everything cohesive.
>
> * After data cleaning, the data should be visible again (if possible,
>   on the data page, just merge it into the data page)
>   - the cleaned data should be exportable
>
> * On the AI assistant if possible, the explanations. Auto generate on
>   what can be done with the data on the data page.
>
> * Merged Columns — become unnamed, so if possible they can be named
>   anyway, could be using ai assistant too.
>
> * In expanded data, the same thing as need to be visible on the data.
>   Every time there are changes it reflects in the preview.
>
> * Stats page and T-tests, if so recommend based on the data what can
>   be done via ai assistant or anyway.
>
> * Model, also, I think they want here is the step by step that the
>   models will do?
>   - it needs to be transparent about what needs to be done with the
>     data like if standardization is needed or whatever then explain
>     (via AI maybe hahahaha)
>   - just add more models, and if multiple models are recommended,
>     the evaluated metrics can be compared
>   - the idea of select all in the selection of features hahahaha
>   - The feature importance, the contents of the columns are included
>
> • there are reasonings at every step, and the user is informed about
>   what happened/is happening

### How each bullet maps to the task plan below

The "What lands" column is the full intended scope per ask. ✅ marks
pieces already shipped in the backend + API-wrapper commit on this
branch; unmarked rows are the frontend UI work laid out in E.1–E.6.

| Panel ask | What lands |
|---|---|
| Cleaned data visible after cleaning / merged into the Data page | `CurrentDatasetBar` mounted in every view. Export button lives there too, so "current dataset export" works from any tab. Clean tab doesn't need its own preview — it gets the shared one. (E.1, E.3) |
| AI auto-explains on the Data page | New `AISuggestions` component (module-aware). Replaces "open chat → ask" with "here's what to try, one click to apply". ✅ backend `GET /api/ai/suggestions?dataset_id=X&module=Y` already shipped. (E.2, E.3) |
| Merged columns get a real name | Merge/compute flow prompts for a name. Add a ✦ **Suggest name** button that asks Claude for a snake_case label based on the source columns + operation. ✅ backend `POST /api/ai/suggest-column-name` already shipped. (E.4) |
| Expand preview reflects changes | Same fix as Clean — shared preview via `CurrentDatasetBar`. Expand operations already push steps to the Timeline (existing); after Phase E those steps also get AI reasoning. (E.3, E.6) |
| Stats / Tests AI recommendations | `AISuggestions` on those views produces concrete recommendations ("run a t-test on income grouped by gender"). Each suggestion carries an optional `action` + `params` — clicking Apply prefills the target form. (E.2, E.3) |
| Model step-by-step transparency | **Before training**: a Pipeline preview card — "will standardize `age`/`income`, one-hot encode `gender`, then fit …" (static rules, no AI needed). **During**: per-model progress ticks. **After**: existing AI interpret endpoint explains results. (E.5) |
| More models + comparison | ✅ Random forest + gradient boosting shipped server-side (auto-dispatch classifier vs regressor). Frontend work: allow multi-select in the training form; when >1 model is picked, show a comparison table (accuracy / precision / recall / F1 / ROC-AUC for classification; R² / RMSE / MAE for regression; one row per model, best-in-column highlighted). (E.5) |
| "Select all" for features | Checkbox + "exclude target column" toggle, plus a ✦ **Select recommended** button driven by ✅ `POST /api/ai/suggest-model-features` (already shipped). (E.5) |
| Feature importance with column contents | Next to each bar, a small badge: top 3 values for categoricals, min / mean / max for numerics. (Sparklines were the original spec; mini-badges are the student-friendly minimum. Upgrade later if desired.) Column info comes from the already-shipped `GET /api/data/:id/profile`. (E.5) |
| Reasoning at every step | ✅ Optional `Step.reasoning` column + `POST /api/ai/explain-step` already shipped, with server-side caching (second call returns `cached: true` instantly). Frontend work: expandable Timeline rows with an "Explain" button, plus a `UserPrefs.autoExplainSteps` toggle in Settings that auto-runs the endpoint for every un-explained step when the Timeline opens. (E.6) |

---

## Decisions already made (from the last conversation)

| # | Question | Answer |
|---|---|---|
| 1 | Per-step reasoning cost: auto or on-demand? | **Toggle for on-demand.** Default off. New pref `autoExplainSteps` in `UserPrefsContext`. |
| 2 | Feature select-all behaviour | **Let user choose but AI-guided.** Add both "Select all", "Select recommended" (calls AI), and normal manual toggle. |
| 3 | Multi-model comparison metrics | Classification: accuracy, precision, recall, F1, ROC-AUC. Regression: R², RMSE, MAE. |
| 4 | Merge column name auto-suggest | **Only when ✦ button is clicked.** Not automatic on column-change. |
| 5 | Persistent preview default state | Expanded on Clean/Expand, **collapsed** on Stats/Tests/Model. |

---

## What's already in git (last commit on this branch)

### Backend — DONE

- `backend/models.py` — `Step.reasoning TEXT` column + in `to_dict`.
- `backend/database.py` — `run_migrations()` adds `steps.reasoning` if
  missing. Safe to re-run; no-op when already applied.
- `backend/services/ai_service.py` — four new functions:
  - `suggestions(dataset, profile, module)` → `{suggestions: [...]}`
    2–4 cards per module. Module is one of
    `data|clean|expand|stats|tests|model`.
  - `explain_step(step)` → plain-English "why" paragraph.
  - `suggest_column_name(source_columns, operation, description?)` →
    snake_case name string (max 60 chars).
  - `suggest_model_features(dataset, profile, target)` →
    `{features: [...], reasoning}`.
- `backend/services/model_service.py` — `train_random_forest()`,
  `train_gradient_boosting()`, plus shared helpers
  `_classification_metrics`, `_regression_metrics`,
  `_feature_importance_list`. Both handle classification and
  regression auto-dispatching on `prep["target_type"]`.
- `backend/routes/ai.py` — new endpoints:
  - `GET  /api/ai/suggestions?dataset_id=X&module=Y`
  - `POST /api/ai/explain-step`   body: `{step_id, force?}`
  - `POST /api/ai/suggest-column-name` body: `{source_columns, operation, description?}`
  - `POST /api/ai/suggest-model-features` body: `{dataset_id, target}`
  - `explain-step` caches the text on `Step.reasoning` — subsequent
    calls return instantly with `cached: true`.
- `backend/routes/models.py` — new endpoints:
  - `POST /api/models/:dataset_id/forest` body: `{target, features, n_estimators?, max_depth?}`
  - `POST /api/models/:dataset_id/gbm`    body: `{target, features, n_estimators?, learning_rate?, max_depth?}`

### Frontend API wrappers — DONE

- `frontend/src/api/ai.js` — `getSuggestions(datasetId, module)`,
  `explainStep(stepId, force=false)`, `suggestColumnName(source, op, desc?)`,
  `suggestModelFeatures(datasetId, target)`.
- `frontend/src/api/models.js` — `trainForest(datasetId, target, features, nEstimators?, maxDepth?)`,
  `trainGBM(datasetId, target, features, nEstimators?, learningRate?, maxDepth?)`.

### Build/syntax status

- Backend syntax-checks clean (all six changed files).
- Frontend builds clean (`npm run build`).

---

## What's left (frontend UI)

Do them in this order. Each task lists files to create/edit and
acceptance criteria.

### E.1 — Shared `CurrentDatasetBar` component

**Create:** `frontend/src/components/CurrentDatasetBar.jsx`

**Purpose:** Pinned header on every workspace view so the current
dataset never disappears. Shows filename, rows × cols, Export button,
and an (optional) collapsible mini preview of the first ~10 rows
reusing `DataTable.jsx`.

**Props:**
- `dataset` — the current `Dataset` object (has `id`,
  `original_filename`, `row_count`, `column_count`, `columns_info`)
- `defaultOpen` (bool) — start expanded or collapsed
- `onExport` — optional; if omitted, button links to
  `GET /api/data/:id/export` via an `<a href>` (URL already exists in
  `api/data.js` as `exportDatasetUrl`)

**Behavior:**
- Header row: filename · dims · [Export] · [▾/▸ collapse toggle]
- Body (when open): fetch first page via `previewDataset(dataset.id, 1, 10)`
  and render `<DataTable columns={} rows={} maxHeight="240px" />`
- Re-fetch when `dataset.id` changes
- Persist collapse state per view in `localStorage` keyed by
  `"currentDatasetBar:open:<module>"`

---

### E.2 — Shared `AISuggestions` component

**Create:** `frontend/src/components/AISuggestions.jsx`

**Purpose:** Module-aware "what should I do next" card. Replaces the
chat-only AI interaction model with proactive suggestions.

**Props:**
- `datasetId`
- `module` — string, one of the six module keys
- `onApply(suggestion)` — optional callback when user clicks a chip

**Behavior:**
- On mount (and when `datasetId` changes) call `getSuggestions(datasetId, module)`.
- Render a collapsible card; default expanded.
- Each suggestion renders as a bordered chip: title bold, description
  below, optional [Apply] button on the right if `onApply` is set
  and `suggestion.action` is present. Clicking Apply fires
  `onApply(suggestion)` — the parent view inspects `suggestion.action`
  and `suggestion.params` and pre-fills its form (e.g. set the Clean
  missing-value column + strategy).
- Manual **Refresh** button in the header.
- "Not using yet" suggestions (`action` absent) render as plain text.

Copy the visual style from the existing `AIOverview.jsx` — it's a good
match. The response shape mirrors `overview()` — one prompt returns the
JSON array ready to render.

---

### E.3 — Wire `CurrentDatasetBar` + `AISuggestions` into all views

**Edit:** `frontend/src/views/CleanView.jsx`, `ExpandView.jsx`,
`StatsView.jsx`, `TestsView.jsx`, `ModelView.jsx`.

Pattern at the top of each view's JSX:

```jsx
<CurrentDatasetBar
  dataset={dataset}
  defaultOpen={module === 'clean' || module === 'expand'}
/>
<AISuggestions
  datasetId={dataset.id}
  module="<this view's key>"
  onApply={(s) => {
    // TODO per view: inspect s.action / s.params and prefill the form
  }}
/>
{/* existing view content */}
```

For `onApply`, start with a minimal switch that only handles 1–2
common `action` values per view (e.g. for Clean:
`action === "fill_missing"` with `params.column` and `params.strategy`
just sets form state). Anything unhandled can just open a toast
"Suggestion applied — adjust settings below" and do nothing. Shipping
proactive suggestions without wiring every action is OK.

---

### E.4 — ExpandView ✦ Suggest name buttons

**Edit:** `frontend/src/views/ExpandView.jsx`

Each of the three tabs (`MathTab`, `CombineTab`, `BinsTab`) has a
"New column name" input with a Field wrapper. Add a small `✦` button
inside the input row (or next to it) that calls
`suggestColumnName(sourceColumns, operation, description)` from
`api/ai.js` and sets `customName` to the response.

Per tab:

- **Math**: `suggestColumnName([column], transform, \`${transform} of ${column}\`)`
- **Combine**: `suggestColumnName([colA, colB], operation, \`${operation} of ${colA} and ${colB}\`)`
- **Bins**: `suggestColumnName([column], \`bin_\${method}\`, \`${numBins} bins of ${column}\`)`

Show a tiny spinner on the button while awaiting. Disable button when
source columns are empty.

**Important:** the panelist asked for required names — but the current
backend auto-generates when name is empty. Don't break that
convention. Just make the ✦ button easily reachable and visually
prominent; let the empty → auto-name path keep working.

---

### E.5 — ModelView overhaul

**Edit:** `frontend/src/views/ModelView.jsx` (major rewrite)

New UX:

1. **Target + features section** (shared, not per-tab):
   - Target column dropdown at top.
   - Features panel below. Three controls:
     - `[ ] Select all` checkbox (selects every non-target column)
     - `✦ Select recommended` button — calls
       `suggestModelFeatures(dataset.id, target)`, then sets
       `selectedFeatures = new Set(result.features)` and shows
       `result.reasoning` as a subtitle.
     - Individual toggles below (same chips as today).

2. **Model selection** — multi-select checkboxes instead of tabs:
   ```
   ☐ Linear regression (continuous target)
   ☐ Logistic regression (binary target)
   ☐ Decision tree
   ☐ Random forest
   ☐ Gradient boosting
   ```
   Grey out / disable models that don't fit the inferred target type
   (infer by quick heuristic: dtype numeric with >10 unique =
   continuous; exactly 2 uniques = binary; else multiclass).

3. **Pipeline preview card** below the model selection:
   - Shows "For each model we'll: drop rows with NaN in target or
     features ({N rows will remain}), split 80/20 train/test …"
   - For linear/logistic: "standardize numeric features".
   - For all: "one-hot encode categorical features (drop first level)."
   - This is static text per model type — no AI call needed.

4. **Train button**: "Train N model(s)". Fires one request per model
   in parallel (Promise.allSettled). Show a per-model status row as
   they complete (green check / red X / still training).

5. **Comparison table** after all finish:
   - Rows = models. Columns = metrics.
   - For classification: Accuracy, Precision, Recall, F1, ROC-AUC.
   - For regression: R², RMSE, MAE.
   - Highlight the best cell per column (green bg).
   - Below table: existing `FeatureBars` and `ConfusionMatrix` for
     the currently-expanded model. Add a tab/selector to pick which
     model's details to show.

6. **Feature importance with column contents**:
   - Next to each feature in `FeatureBars`, add a small badge that
     shows the column's top 3 values (categorical) or
     min/mean/max (numeric). Fetch column info from
     `dataset.columns_info` + `getProfile(dataset.id)` — already
     available via `api/data.js:getProfile`.

**API wrappers already exist** for trainForest / trainGBM — just call them.

---

### E.6 — Timeline reasoning (per-step "why")

**Edit:** `frontend/src/components/Timeline.jsx`,
`frontend/src/contexts/UserPrefsContext.jsx`,
`frontend/src/pages/SettingsPage.jsx`.

1. `UserPrefsContext`: add `autoExplainSteps` boolean pref + setter.
   Default `false`. Persist to localStorage keyed by user id
   (same pattern as `theme` and `avatar`).

2. `SettingsPage`: add a new section "AI behavior" with a toggle:
   > Auto-explain timeline steps  [toggle]
   > When on, each step gets a plain-English explanation as soon as
   > you open the Timeline. Off: click "Explain" on any step.

3. `Timeline.jsx`:
   - Each step row gains an expandable state (click to expand).
   - When expanded, show `step.reasoning` if present. Otherwise show
     an "Explain" link that calls `explainStep(step.id)` and updates
     the UI with the returned reasoning (it's now cached on the
     backend too).
   - When `prefs.autoExplainSteps` is true and the Timeline mounts:
     iterate steps that don't already have `.reasoning` and call
     `explainStep(step.id)` in sequence (not parallel — it burns
     tokens). Backoff if any call fails.
   - `ProjectPage.refreshProject()` already refetches steps; after a
     refresh, the reasoning strings round-trip via
     `Step.to_dict().reasoning`.

---

### E.7 — Wire-up details

- Keep `Data` tab as-is. It already has its own full preview via
  `DataView.jsx` + the AIOverview panel. CurrentDatasetBar is for the
  *other* views, not Data.
- `IconSidebar` sizing: CurrentDatasetBar in a narrow workspace
  column will feel cramped. Test at ~240px sidebar width. If needed,
  reduce preview `maxHeight` to 200px when viewport is tight.

---

## Testing checklist

After everything is wired:

1. [ ] Open a project with a dataset. Click Clean, Expand, Stats,
       Tests, Model — each shows the CurrentDatasetBar pinned at top.
2. [ ] AISuggestions panel loads on each view and lists 2–4
       suggestions. Clicking Refresh regenerates.
3. [ ] ExpandView → Math/Combine/Bins ✦ button fills the name field
       with a snake_case string.
4. [ ] ModelView: pick multiple model types, "Select recommended"
       populates features, Train runs them all, comparison table
       highlights best metrics.
5. [ ] Timeline drawer: with `autoExplainSteps=false`, steps have an
       "Explain" link that fills in reasoning on click. Toggle to
       true in Settings, reopen Timeline, every step auto-fills
       reasoning (watch the network tab — one call per step).
6. [ ] Dark mode still works on all new components (use `dark:`
       fallbacks in index.css or explicit `dark:` classes).

---

## Notes and gotchas

- `ai_service.explain_step` only reads `step.title` + `step.details` —
  it doesn't load the dataset. That keeps it cheap. The trade-off:
  explanations don't reference concrete cell values.
- `explain_step` endpoint caches into `Step.reasoning`. When the user
  rolls back a step with the history endpoint (marks reverted), the
  reasoning stays. That's fine — it's historical.
- `suggest_column_name` returns a cleaned string; don't trust the
  model blindly. The function already strips quotes and caps to
  60 chars.
- Random forest trains fast on tabular data with `n_jobs=-1`; GBM is
  sequential and slower. Warn users before training on datasets over
  10k rows.
- The panelist asked for "column contents in feature importance" —
  I interpreted this as mini-badges with top values / numeric range,
  not histograms. If they meant actual charts, that's a follow-up.
- ROC-AUC is only computed for binary classification in the new
  metric helper (`_classification_metrics` checks `len(classes) == 2`).
  Multiclass returns it as undefined; the comparison table should
  render `—` for those cells.

---

## Files touched this session (committed below)

- `backend/models.py`
- `backend/database.py`
- `backend/services/ai_service.py`
- `backend/services/model_service.py`
- `backend/routes/ai.py`
- `backend/routes/models.py`
- `frontend/src/api/ai.js`
- `frontend/src/api/models.js`

## Files that still need to be created

- `frontend/src/components/CurrentDatasetBar.jsx`
- `frontend/src/components/AISuggestions.jsx`
- `frontend/src/components/PipelinePreview.jsx` (small, embedded in ModelView is fine too)
- `frontend/src/components/ModelComparisonTable.jsx` (same — could inline)

## Files that need edits (see tasks above)

- `frontend/src/views/CleanView.jsx`
- `frontend/src/views/ExpandView.jsx`
- `frontend/src/views/StatsView.jsx`
- `frontend/src/views/TestsView.jsx`
- `frontend/src/views/ModelView.jsx` (major)
- `frontend/src/components/Timeline.jsx`
- `frontend/src/contexts/UserPrefsContext.jsx`
- `frontend/src/pages/SettingsPage.jsx`
