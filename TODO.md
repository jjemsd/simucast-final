# TODO

Phase A (new app shell, Dashboard/Projects/Files/Settings, dark mode,
avatar, modal-based project create/rename/delete) — **DONE**.

Everything below needs future sessions.

## Phase B — Files as a first-class resource

Today every uploaded file is pinned to exactly one project via
`Dataset.project_id`. To make Files a real standalone resource:

1. New `File` table (id, user_id, original_filename, storage_path,
   row_count, column_count, columns_info, created_at).
2. `Dataset.file_id` FK (nullable during migration); a dataset within a
   project references its source file. Same file can back multiple
   projects.
3. Set up **Alembic** for migrations first — `db.create_all()` won't
   add columns to existing tables in production.
4. New routes:
   - `POST /api/files` — upload (no project required)
   - `GET /api/files/:id` — metadata
   - `GET /api/files/:id/preview` — paged rows
   - `DELETE /api/files/:id` — only if unused by any project
   - `POST /api/files/:id/new-project` — create a project seeded from
     this file
5. Files page gets: upload button, delete with "used in N projects"
   check, rename, "used in" badge.
6. Project delete: detect shared files, warn with "X files are still
   used by other projects, they won't be deleted" message.
7. Sync avatar + dark mode preference from localStorage to `User`
   table (column `avatar`, column `theme`). Needs a migration.

## Data view / project workspace improvements

Carried over from earlier planning. Independent of Files work.

### 1. Resizable sidebar + larger text (project workspace)

- `frontend/src/components/IconSidebar.jsx` is currently fixed-width
  icons only (60px column). Either widen it and show labels, or add a
  drag handle.
- Persist chosen width in `localStorage`.
- Bump base font size — current 11–12px is too small.

### 2. Data view: table-only scroll + column header actions + hover stats

- File: `frontend/src/views/DataView.jsx`.
- Scrolling: only the data table container scrolls (both X and Y);
  sticky header row; sticky first column.
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
  - error count
  - categorical: frequency table + null count
- Needs a new endpoint `GET /api/data/:dataset/columns/:name/profile`.

### 3. Replace "Columns" chip bar with AI Overview

- Remove the top "Columns" section.
- Add an Overview panel that calls a new AI endpoint with the column
  profiles from the previous task and returns:
  - total null / blank count
  - special characters / encoding issues
  - datatype mismatches
  - probable errors per column
  - suggested cleaning actions

### 4. Dark mode for project workspace

- The new shell pages support dark mode. The project workspace
  (DataView, CleanView, StatsView, TestsView, ModelView, WhatIfView,
  ReportView, IconSidebar, AIChat, Timeline, DataTable, ChartCard,
  StatCard, TopBar, SyntheticModal) still uses plain `bg-white` etc.
- Pass: add `dark:` variants on backgrounds, borders, and text in
  each view. No logic changes.

## Nice-to-haves

- Replace remaining `window.confirm()` calls (`ProjectPage.jsx` in
  `handleRollback`, and anywhere else) with `ConfirmModal`.
- Replace remaining `alert()` calls with a tiny toast component.
- Loading skeletons on the Files and Projects pages match the
  Dashboard.
- Keyboard: ⌘K / Ctrl-K opens a "new project" / search palette.
