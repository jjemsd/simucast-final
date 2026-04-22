# SimuCast

Web-based statistical analysis and predictive modeling platform — Flask + React.

- **Backend**: Python 3.11+, Flask, SQLAlchemy, pandas/scipy/sklearn, Anthropic SDK
- **Frontend**: React 18 + Vite, Tailwind, axios, Chart.js
- **Storage**: SQLite (dev) / PostgreSQL (prod), local filesystem for uploads

For a detailed walk-through aimed at non-developers, see [`README.txt`](./README.txt).

---

## Run locally

### Prerequisites

- Python 3.10+ (tested on 3.13)
- Node.js 18+
- An Anthropic API key (optional — AI features are disabled without it)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY and SECRET_KEY

python app.py
```

Backend listens on `http://localhost:5000`.

### 2. Frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` to the backend, so no CORS setup is needed in dev.

### Environment variables

| File | Variable | Purpose |
|---|---|---|
| `backend/.env` | `SECRET_KEY` | Signs session cookies |
| | `ANTHROPIC_API_KEY` | AI chat / interpretation / synthetic data |
| | `DATABASE_URL` | Defaults to `sqlite:///simucast.db` |
| | `FLASK_DEBUG` | `True` in dev |
| | `FRONTEND_ORIGIN` | CORS allowlist; defaults to `http://localhost:5173` |
| | `MAX_UPLOAD_MB` | Per-file upload limit (default 50) |
| `frontend/.env` | `VITE_API_URL` | Leave empty in dev (Vite proxy handles it) |

---

## Deploy to Render

The repo ships with [`render.yaml`](./render.yaml), a Render Blueprint that provisions:

- `simucast-db` — managed PostgreSQL (`basic-256mb`)
- `simucast-api` — Flask API on gunicorn + a 1 GB persistent disk mounted at `backend/uploads/`
- `simucast-web` — static Vite build with SPA-rewrite routing

Services are wired together automatically: `DATABASE_URL`, `SECRET_KEY`, `FRONTEND_ORIGIN`, and `VITE_API_URL` are all injected via `fromDatabase` / `fromService`.

### One-time setup

1. **Push this repo to GitHub** (Render pulls from GitHub/GitLab/Bitbucket).

2. **Render dashboard → New → Blueprint**
   - Pick this repo and the branch you want to deploy.
   - Render reads `render.yaml` and shows a plan. Click **Apply**.
   - First build takes ~5–10 min (pip install of pandas/scipy/sklearn is slow).

3. **Set the Anthropic key**
   Open the `simucast-api` service → **Environment** → set `ANTHROPIC_API_KEY`. It's marked `sync: false` in `render.yaml` so Render doesn't auto-generate it.

4. **Visit the frontend URL** (something like `https://simucast-web.onrender.com`). Sign up and you're in.

### What gets deployed

| Resource | Plan | Notes |
|---|---|---|
| `simucast-db` | `basic-256mb` (~$6/mo) | 256 MB RAM, 1 GB storage; free tier expires after 30 days so we use paid. |
| `simucast-api` | `starter` (~$7/mo) | Gunicorn, 2 workers × 4 threads, 120s timeout. |
| `simucast-uploads` disk | 1 GB | Persists across deploys. Resize in the dashboard if needed. |
| `simucast-web` | Static (free) | Built once per deploy; served from Render's CDN. |

### Deploy updates

`autoDeploy: true` is set for both web services, so every push to the configured branch redeploys. To pin to a specific branch, change it in the Render dashboard after the first apply.

### Production-only behavior

With `FLASK_ENV=production` set in the blueprint, the backend:

- Rewrites Render's legacy `postgres://` URL to `postgresql://` for SQLAlchemy 2.x.
- Sets `SESSION_COOKIE_SAMESITE=None; Secure` so cookies cross the `simucast-web → simucast-api` subdomain boundary.
- Wraps WSGI with `ProxyFix` so `request.is_secure` and forwarded headers are respected behind Render's load balancer.
- Uses `pool_pre_ping` and `pool_recycle=280` to survive Render Postgres idle-connection drops.

The frontend's axios client reads `VITE_API_URL` at build time and prepends `https://` if it's a bare hostname (Render's `fromService.host` returns a hostname without scheme).

### Caveats

- **Schema migrations**: `db.create_all()` runs at startup but only creates missing tables. If `models.py` changes after launch, add Alembic or run an ad-hoc migration.
- **Horizontal scaling**: a Render disk attaches to one instance. Don't scale `simucast-api` past 1 instance until uploads move to object storage (S3/R2).
- **Cold starts**: the `starter` plan doesn't sleep, but `free` does. Upgrade if you pick free and see first-request latency.

---

## Project layout

```
simucast/
├── backend/
│   ├── app.py              # Flask app factory + blueprint registration
│   ├── config.py           # Env-driven config (dev + prod)
│   ├── database.py         # SQLAlchemy init
│   ├── models.py           # User, Project, Dataset, Step
│   ├── routes/             # One blueprint per feature area
│   ├── services/           # Business logic (stats, cleaning, AI, etc.)
│   └── uploads/            # CSV uploads + trained models (disk on Render)
├── frontend/
│   ├── src/
│   │   ├── api/            # axios client + per-feature API modules
│   │   ├── pages/          # Route-level components
│   │   ├── views/          # Feature panels inside a project
│   │   └── components/     # Shared UI
│   └── vite.config.js      # /api proxy → localhost:5000 in dev
├── render.yaml             # Render Blueprint
└── README.txt              # Detailed setup guide for non-developers
```
