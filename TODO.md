# TODO

- Phase A (app shell, Dashboard/Projects/Files/Settings, modals, dark
  mode, avatar picker) — **DONE**.
- Phase B (File as a first-class resource, upload/rename/delete on the
  Files page, "Use in new project", project-delete with shared-file
  handling, lightweight in-app migrations) — **DONE**.

Everything below is still open.

## Data view / project workspace

### 1. Resizable sidebar + larger text

- `frontend/src/components/IconSidebar.jsx` is a fixed-width icon
  column (60px). Widen it or add a drag handle; show labels; persist
  the chosen width to `localStorage`.
- Bump base font size — the current 11–12px is too tight.

### 2. Data view: table-only scroll + column header actions + hover stats

- File: `frontend/src/views/DataView.jsx`.
- Only the data table container scrolls (both X and Y); sticky header
  row; sticky first column.
- Per-column dropdown in the table header:
  - Change data type (`str` ↔ `int` ↔ `float` ↔ `date` ↔ `bool`).
  - Date format picker when type is `date`.
  - Drop / rename column.
  - Conversion is best-effort; values that can't coerce get flagged
    as errors.
- Column hover popover:
  - declared type
  - non-null count, null count
  - numeric: sum, mean, min, max, std
  - error count (values that don't match the declared type)
  - categorical: frequency table + null count
- Needs a new endpoint `GET /api/data/:dataset/columns/:name/profile`.

### 3. Replace "Columns" chip bar with AI Overview

- Remove the top "Columns" chip bar in DataView.
- Add an Overview panel fed by a new AI endpoint that uses the column
  profiles from task 2 to report:
  - total null / blank count
  - special characters / encoding issues
  - datatype mismatches
  - probable errors per column
  - suggested cleaning actions

### 4. Dark mode across the project workspace

- Phase A styled the shell; the workspace views (DataView, CleanView,
  StatsView, TestsView, ModelView, WhatIfView, ReportView, IconSidebar,
  AIChat, Timeline, DataTable, ChartCard, StatCard, TopBar,
  SyntheticModal) still use plain `bg-white` etc.
- Pass through adding `dark:` variants on backgrounds, borders, and
  text. No logic changes.

## Nice-to-haves

- Replace remaining `window.confirm()` calls (`ProjectPage.jsx` in
  `handleRollback`, etc.) with `ConfirmModal`.
- Replace remaining `alert()` calls with a tiny toast component (the
  Files page upload handler still uses `alert()`).
- Preview a file's rows directly from the Files page (we added the
  backend endpoint — need a simple DataTable modal).
- Sync avatar + theme to a new `User.avatar` / `User.theme` column so
  preferences follow users across devices. Our `run_migrations()`
  helper can add the columns; update `UserPrefsContext` to fall back
  to localStorage only when the user isn't logged in.
- Sort / filter dropdowns on the Files and Projects pages.
