# Spool Verification

Factory-floor barcode verification: scan the **Surbhi** sticker and the
**Manufacturing** sticker; the app checks that both VPNs match (PASS/FAIL)
and keeps a persistent, server-side audit trail.

## Sticker formats

| Sticker        | Format                        | Example                       |
|----------------|-------------------------------|-------------------------------|
| Surbhi         | `VPN$lotcode$datecode$qty`    | `VPN123$LOT456$20241014$100`  |
| Manufacturing  | `VPN`                         | `VPN123`                      |

## Architecture

```
app/
  __init__.py     # application factory (config, SECRET_KEY policy, DB init)
  api.py          # /api blueprint — all JSON endpoints
  db.py           # SQLite layer; stats/history derived from one scans table
  validation.py   # pure sticker-format validators (unit-tested)
templates/        # single-page UI (state loaded from the API)
static/           # style.css + script.js (scanner-friendly, XSS-safe DOM)
tests/            # pytest suite (validation + API integration)
wsgi.py           # entrypoint (dev); gunicorn in production (Procfile)
```

Key design decisions (fixes from the previous implementation):

* **Server-side SQLite persistence** — scans survive refreshes/new devices and
  are shared across clients. Stats are *derived* with SQL from the single
  `scans` table, so counters can never drift from history.
* **No hardcoded secrets** — `SECRET_KEY` is mandatory outside development.
* **No internal error leakage** — unexpected exceptions are logged server-side;
  clients only see generic JSON errors.
* **XSS-safe frontend** — lists are built with `textContent`, not `innerHTML`.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
python wsgi.py                    # dev server on :10000
# or: gunicorn --bind 0.0.0.0:10000 wsgi:app
```

The database is created automatically at `instance/spool.sqlite3`.

## Tests

```bash
pytest
```

## Deploying on Render (render.com)

A `render.yaml` blueprint is included, so deployment takes ~2 minutes:

1. Push this repo to GitHub.
2. On [render.com](https://render.com) → **New** → **Blueprint** → select your repo.
   (Or **New Web Service** and configure manually as below.)
3. Settings (already in `render.yaml`):
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn --bind 0.0.0.0:$PORT --workers 2 wsgi:app`
   - **Health check path:** `/`
   - **Env vars:** `SECRET_KEY` — set `generateValue: true` in the blueprint,
     or add it manually via Render's dashboard (any random 64-char hex string).
4. Click **Create** — Render builds and deploys automatically; every future
   `git push` to the main branch triggers a redeploy.

⚠️ **Free plan note:** Render's free instances have an **ephemeral filesystem** —
the SQLite DB (`instance/spool.sqlite3`) resets on restart/redeploy/sleep. The
app keeps working (schema is recreated automatically), but scan history is lost.
For permanent storage either upgrade to a paid instance + **Render Disk**, or
migrate `app/db.py` to a hosted Postgres (**Render Database**).

## API

| Method | Path                  | Description                                   |
|--------|-----------------------|-----------------------------------------------|
| POST   | `/api/verify`         | `{surbhi, manufacturing}` → PASS/FAIL + stats |
| GET    | `/api/stats`          | Total / pass / fail counters                  |
| GET    | `/api/recent-scans`   | Last N scans (max 5)                          |
| GET    | `/api/history`        | Last N records (max 50)                       |
| POST   | `/api/clear`          | Wipe all scan records                         |

Semantics: HTTP 200 = verification completed (check `result`), HTTP 400 =
malformed request/sticker. Every attempt (including format failures) is recorded.
