"""Application factory for the Spool Verification service.

Storage model: intentionally NO database. All scan data lives in a single
in-memory store (app.store.ScanStore) that represents the current live
session. Data resets on restart/redeploy by design.
"""

from __future__ import annotations

import os
import secrets

from flask import Flask, render_template

from .api import api_bp
from .store import ScanStore


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="../static",
    )

    # --- Configuration -----------------------------------------------------
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        MAX_CONTENT_LENGTH=16 * 1024,  # API payloads are tiny; cap abuse
    )

    if test_config:
        app.config.update(test_config)

    # --- Live in-memory store (one per process) ------------------------------
    app.config["STORE"] = ScanStore()

    # Secret key is REQUIRED in production — no hardcoded fallback.
    secret_key = os.environ.get("SECRET_KEY")
    if secret_key:
        app.secret_key = secret_key
    elif app.debug or os.environ.get("FLASK_ENV") == "development" or test_config:
        # Ephemeral key for local dev/tests only.
        app.secret_key = secrets.token_hex(32)
    else:
        raise RuntimeError(
            "SECRET_KEY environment variable is required. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )

    # --- Routes --------------------------------------------------------------
    app.register_blueprint(api_bp)

    @app.route("/")
    def index():
        # UI state is fetched from the JSON API by script.js; nothing is
        # server-rendered into the template.
        return render_template("index.html")

    return app
