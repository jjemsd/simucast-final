# SimuCast

AI-assisted statistical analysis and what-if modeling for students and casual analysts.

SimuCast lets you upload a dataset, clean it, explore it with descriptive statistics, run tests, build predictive models, and ask "what if" questions — all with Claude as a built-in tutor that explains results in plain English.

---

## Quick start

### Prerequisites

- **Python 3.10+** (check with `python --version`)
- **Node.js 18+** (check with `node --version`)
- **An Anthropic API key** — get one at https://console.anthropic.com/

### 1. Backend setup

```bash
cd backend

# Create a virtual environment so our dependencies don't pollute the system
python -m venv .venv

# Activate it:
#   On Windows:       .venv\Scripts\activate
#   On Mac/Linux:     source .venv/bin/activate

# Install all dependencies (Flask, pandas, scipy, anthropic, etc.)
pip install -r requirements.txt

# Copy the env template and fill in your API key
cp .env.example .env      # on Windows use:  copy .env.example .env

# Open .env and set ANTHROPIC_API_KEY=sk-ant-... (your real key)

# Start the server
python app.py
```

Backend now runs at **http://localhost:5000**. Visit it in a browser — you should see `{"status": "ok", "app": "SimuCast API"}`.

### 2. Frontend setup

Open a **second** terminal.

```bash
cd frontend

# Install dependencies (React, Vite, Tailwind, Chart.js, etc.)
npm install

# Start the dev server
npm run dev
```

Frontend now runs at **http://localhost:5173**. Open it in your browser.

### 3. First run

1. Register a new account (email, password, name)
2. From the dashboard, click **+ New project** and give it a name
3. In the project view, **Data** module is active — upload any CSV (the Titanic dataset is a classic starter)
4. Switch to the **Stats** module, pick some numeric columns, and click **Run descriptives**
5. Open the AI Chat sidebar (collapse button at top) and ask questions about your data

---

## How the code is organized

```
simucast/
├── backend/              # Python / Flask / pandas
│   ├── app.py            # Entry point — wires everything together
│   ├── config.py         # Reads .env, holds all settings
│   ├── database.py       # SQLAlchemy setup
│   ├── models.py         # All database tables in one file
│   ├── routes/           # HTTP endpoints (thin — just receive + respond)
│   └── services/         # Business logic (pandas, scipy, Claude calls)
│
└── frontend/             # React / Vite / Tailwind / Chart.js
    └── src/
        ├── api/          # Backend calls (1 file per backend route)
        ├── pages/        # Full-screen components (Login, Dashboard, Project)
        ├── views/        # Module content inside ProjectPage (Data, Stats, etc.)
        ├── components/   # Shared UI pieces (TopBar, AIChat, StatCard, ...)
        └── utils/        # Number formatting, validators
```

### The four rules to remember

1. **Route files are thin, service files do the work.** Routes receive HTTP, services use pandas.
2. **`api/foo.js` only ever talks to `routes/foo.py`.** One-to-one mapping.
3. **Pages vs views.** Pages are screens you navigate *to*. Views swap *inside* a page.
4. **Components are anything reused.** Used once → keep it in the view file.

### Reading the code

Start here if you want to understand the flow:

1. **Backend boot:** `backend/app.py` — see how Flask gets wired up
2. **A full request round-trip:** Upload a CSV and follow it:
   - `frontend/src/views/DataView.jsx` — user picks a file
   - → `frontend/src/api/data.js` — `uploadFile()` sends it via Axios
   - → `backend/routes/data.py` — receives the request
   - → `backend/services/data_service.py` — saves the file, parses with pandas
   - → `backend/models.py` — the `Dataset` row that gets stored
3. **AI integration:** `backend/services/ai_service.py` — every Claude call lives here

---

## What's built vs what's stubbed

### Working (V1 core flow)
- User registration + login with session cookies
- Project creation + listing
- CSV / Excel / JSON / TSV upload
- Paginated data preview
- Descriptive statistics (mean, median, SD, skew, kurtosis, etc.)
- AI chat sidebar (context-aware of current dataset)

### Stubbed (add in later weeks)
Every other module is a scaffolded placeholder that loads without errors but shows "Coming soon":
- Clean, Expand, Synthetic data, Tests, Model, What-If, Report, History

Each stub has its route file, service file, API file, and view file all in place with the right naming conventions — so when you build the real thing you just replace the contents.

---

## Environment variables

All secrets live in `backend/.env` (copy from `.env.example`).

| Variable | What it does |
|---|---|
| `SECRET_KEY` | Signs session cookies — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `FLASK_DEBUG` | `True` for dev, `False` for production |
| `DATABASE_URL` | SQLite works for dev. Swap for a Postgres URL in production |
| `ANTHROPIC_API_KEY` | Required for AI features — get at https://console.anthropic.com/ |
| `MAX_UPLOAD_MB` | Maximum file upload size (default 50MB) |

---

## Troubleshooting

**Backend: "ANTHROPIC_API_KEY is not set"**
Make sure you copied `.env.example` to `.env` AND put your real key in there. Restart the server after changing `.env`.

**Frontend: CORS errors**
Make sure the backend is running on port 5000 (not something else). `vite.config.js` proxies `/api/*` to `localhost:5000` — if you changed the backend port, update it there too.

**File upload fails with "413 Payload Too Large"**
Increase `MAX_UPLOAD_MB` in `.env` and restart the backend.

**Database errors after changing `models.py`**
The simplest fix during development: delete `backend/simucast.db` and restart the backend. It'll recreate the schema from scratch. (For production, use proper migrations with Alembic.)

---

## Next steps

See the project plan for what to build in Weeks 2-4. Starting with Clean + Cleaning Log is a good choice — users spend the most time cleaning data, and the Timeline component is already in place.
