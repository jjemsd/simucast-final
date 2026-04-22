# TODO — UX / data-view improvements

Captured 2026-04-22. Work on these in a future session.

## 1. Replace `window.prompt()` with a real modal for project creation

Currently clicking "Create new project" on the Dashboard fires a native
`window.prompt("Project name?")` — that's where the "simucast-web.onrender.com
says" dialog comes from.

- File: `frontend/src/pages/DashboardPage.jsx` (uses `createProject` from
  `api/projects.js`)
- Want: a React modal component with a labeled input, Create / Cancel
  buttons, validation (non-empty, reasonable max length), and
  Esc-to-close / click-outside-to-close.
- While we're at it, audit the codebase for any other `prompt()` /
  `confirm()` / `alert()` calls and replace with modals/toasts for
  consistency.

## 2. Resizable sidebar + larger text

Sidebar in the project shell is a fixed narrow column and the text is too
small to read comfortably.

- File: `frontend/src/pages/ProjectPage.jsx` (and whatever renders the
  nav items — probably a small sub-component)
- Want:
  - Drag handle on the sidebar's right edge that resizes width; persist
    chosen width in `localStorage`.
  - Sensible min / max widths (e.g. 160px … 480px).
  - Bump base font size for nav items (current ~12px is too tight).
  - Bump global base text size for readability (check `index.css` /
    Tailwind config).

## 3. Data view: table-only scroll + column header actions + hover stats

Today when a dataset has many columns the whole page scrolls horizontally
instead of just the table.

- File: `frontend/src/views/DataView.jsx` + any `DataTable` child
- Scrolling:
  - Outer layout should NOT scroll horizontally.
  - The data table container is the only thing that scrolls (both X and
    Y); sticky header row; sticky first column ideally.
- Column header dropdown (per column):
  - Change data type: `str` → `int` / `float` / `date` / `bool`.
  - Date format picker when type is `date` (ISO, MM/DD/YYYY, etc.).
  - Drop / rename column.
  - Conversion is best-effort: `"12345"` → int, `"123.45"` → float, etc.
    Values that can't coerce get flagged as errors (don't throw away the
    original — keep it so the user can still see what was there).
  - Probably needs a new backend endpoint (or to extend
    `/api/clean/:dataset/recode`) that returns a new dataset + step.
- Column hover tooltip / popover:
  - declared data type
  - non-null count, null count
  - numeric: sum, mean, min, max, std
  - error count = values that don't match the declared type
  - categorical (low-cardinality text, e.g. Yes/No, Married/Single/…):
    frequency table of each distinct value plus null count
  - This should use a new backend endpoint like
    `/api/data/:dataset/columns/:name/profile` that returns the full
    profile so the frontend doesn't recompute on every hover. Cache on
    the dataset after cleaning steps.

## 4. Replace the "Columns" chip bar with an AI "Overview" panel

The chip bar at the top of the Data view (column name + type per chip)
adds little; what's useful is a summary of what's wrong with the
dataset.

- File: `frontend/src/views/DataView.jsx`
- Remove: the existing "Columns" section.
- Add: an "Overview" panel that calls a new AI endpoint (extend
  `backend/routes/ai.py` + `backend/services/ai_service.py`) which takes
  a dataset id and returns:
  - total null / blank count
  - special characters / encoding issues
  - datatype mismatches (e.g. mostly-numeric column with a few text
    rows)
  - probable errors per column
  - suggested cleaning actions (human-readable, ideally with a link /
    button that prefills the corresponding Clean tool)
- The server probably wants to send Claude a compact summary of the
  column profiles (from task 3) rather than the raw CSV, to keep tokens
  low.

## Loose ordering suggestion

1. Modal (#1) — small, isolated, good warm-up.
2. Sidebar + text size (#2) — affects every screen, easy win.
3. Column profiles + table scroll (#3) — biggest piece; profile
   endpoint unlocks #4.
4. AI Overview (#4) — depends on #3's profile data.
