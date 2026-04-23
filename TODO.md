# TODO

- Phase A (app shell, Dashboard/Projects/Files/Settings, modals, dark
  mode, avatar picker) — **DONE**.
- Phase B (File as a first-class resource, upload/rename/delete on the
  Files page, "Use in new project", project-delete with shared-file
  handling, lightweight in-app migrations) — **DONE**.
- Phase C (resizable workspace sidebar, table-only scroll with sticky
  header/first column, column header menu for rename / change type /
  delete, hover popover with per-column stats, AI Overview replacing
  the old "Columns" chip bar) — **DONE**.
- Phase D (dark mode across the project workspace) — **DONE** via a
  fallback CSS block in `index.css` that paints `bg-white`,
  `border-gray-*`, `text-gray-*`, common hover states and text
  inputs/selects/textareas when `html.dark` is set. Explicit `dark:`
  utilities already in Phase A/B pages continue to win because
  Tailwind emits them after the base utilities. If a specific
  workspace component reads wrong, add an explicit `dark:` variant on
  that element — it overrides the fallback.

Everything below is still open.

## Nice-to-haves

- Replace remaining `window.confirm()` calls (`ProjectPage.jsx` in
  `handleRollback`, etc.) with `ConfirmModal`.
- Replace remaining `alert()` calls with a tiny toast component (the
  Files page upload handler still uses `alert()`).
- Preview a file's rows directly from the Files page (we added the
  backend endpoint — need a simple DataTable modal).
- Sync avatar + theme to a new `User.avatar` / `User.theme` column so
  preferences follow users across devices. The existing
  `run_migrations()` helper can add the columns; update
  `UserPrefsContext` to fall back to localStorage only when the user
  isn't logged in.
- Sort / filter dropdowns on the Files and Projects pages.
- Code-split the frontend bundle — Vite is warning about the 500KB
  chunk. `React.lazy()` around the workspace views would trim the
  initial load for people hitting /login.
- Keyboard nav for the column header menu (arrow keys / Enter).
- Pin the AIOverview refresh to manual only (right now it runs on
  every dataset change, which burns tokens when rolling back steps).
