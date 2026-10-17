# Spool Verification

Factory-floor barcode verification: scan the **Surbhi** sticker and the
**Manufacturing** sticker; the app checks that both VPNs match (PASS/FAIL)
and shows live stats, recent scans, and session history.

## Sticker formats

| Sticker        | Format                        | Example                       |
|----------------|-------------------------------|-------------------------------|
| Surbhi         | `VPN$lotcode$datecode$qty`    | `VPN123$LOT456$20241014$100`  |
| Manufacturing  | `VPN`                         | `VPN123`                      |

## Architecture

```
app/
  __init__.py     # application factory (config, SECRET_KEY policy, store init)
  api.py          # /api blueprint — all JSON endpoints
  store.py        # thread-safe, bounded IN-MEMORY scan store (no database)
  validation.py   # pure sticker-format validators (unit-tested)
templates/        # single-page UI (state loaded from the API)
static/           # style.css + script.js (scanner-friendly, XSS-safe DOM)
tests/            # pytest suite (validation + API integration)
wsgi.py           # entrypoint (dev); gunicorn in production (Procfile)
```

Key design decisions:

* **No database — by design.** This is a *live verification station*: all scan
  data lives in one in-memory store (`app/store.py`) representing the current
  session. Stats/history are derived from the same list that receives writes,
  so counters can never drift. History is bounded (last 50 records) so memory
  use is capped.
* **Data resets on restart/redeploy.** That is intentional and acceptable for
  shift-based live verification. If permanent storage is ever needed, add a
  persistence layer implementing the same `ScanStore` interface.
* **Single worker process.** In-memory state is per-process, so gunicorn runs
  with exactly 1 worker (see Procfile / render.yaml). Do not scale workers or
  instances without introducing shared storage.
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
# or: gunicorn --bind 0.0.0.0:10000 --workers 1 wsgi:app
```

No database file, no migrations, nothing to provision — the app starts clean.

## Tests

```bash
pytest
```

## Deploying on Render (render.com)

A `render.yaml` blueprint is included, so deployment takes ~2 minutes:

1. Push this repo to GitHub.
2. On [render.com](https://render.com) → **New** → **Blueprint** → select your repo.
   (Or **New → Web Service** and configure manually as below.)
3. Settings (already in `render.yaml`):
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn --bind 0.0.0.0:$PORT --workers 1 wsgi:app`
   - **Health check path:** `/`
   - **Env vars:** `SECRET_KEY` — `generateValue: true` in the blueprint
     (Render creates a secure random value). No DATABASE_URL needed.
4. Click **Create / Approve & Apply** — every future `git push` redeploys.

**What happens to data on Render?** Free instances sleep after inactivity and
reset on redeploy — since there is no database, stats/history start fresh at
that point. For a live scanning station this is fine: each shift begins with a
clean slate anyway.

## API

| Method | Path                  | Description                                   |
|--------|-----------------------|-----------------------------------------------|
| POST   | `/api/verify`         | `{surbhi, manufacturing}` → PASS/FAIL + stats |
| GET    | `/api/stats`          | Total / pass / fail counters                  |
| GET    | `/api/recent-scans`   | Last N scans (max 5)                          |
| GET    | `/api/history`        | Last N records (max 50)                       |
| POST   | `/api/clear`          | Wipe all in-session scan records              |

Semantics: HTTP 200 = verification completed (check `result`), HTTP 400 =
malformed request/sticker. Every attempt (including format failures) is recorded.
