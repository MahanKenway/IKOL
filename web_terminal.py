#!/usr/bin/env python3
"""Minimal web terminal for IKOL agent.

Runs a tiny local web UI where users enter a goal and receive the agent output.
Supports Moltbook identity verification via X-Moltbook-Identity header.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import subprocess
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any
from urllib import request
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs

PAGE_TEMPLATE = """<!doctype html>
<html lang="fa">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IKOL Web Terminal</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background:#0b1020; color:#e6edf3; margin:0; }
    .wrap { max-width:900px; margin:40px auto; padding:24px; }
    .card { background:#11182d; border:1px solid #27314f; border-radius:12px; padding:20px; }
    textarea, input { width:100%; box-sizing:border-box; background:#0f1528; color:#e6edf3; border:1px solid #2f3b5f; border-radius:8px; padding:10px; }
    button { margin-top:12px; padding:10px 16px; border:0; border-radius:8px; background:#3a7afe; color:white; cursor:pointer; }
    pre { background:#0a0f1f; border:1px solid #27314f; padding:14px; border-radius:8px; white-space:pre-wrap; }
    .hint { color:#9fb1d1; font-size:13px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h2>IKOL Agent — Web Terminal</h2>
      <p class="hint">هدف را وارد کن، جواب پایین چاپ می‌شود.</p>
      <p class="hint">Authenticated agent: {agent}</p>
      <form method="POST" action="/run">
        <label>Goal</label>
        <textarea name="goal" rows="5" required>{goal}</textarea>
        <label style="display:block;margin-top:10px;">Max Steps</label>
        <input type="number" min="1" max="50" name="max_steps" value="{max_steps}" />
        <button type="submit">Run Agent</button>
      </form>
      <h3>Output</h3>
      <pre>{output}</pre>
    </div>
  </div>
</body>
</html>"""

VERIFY_IDENTITY_URL = "https://moltbook.com/api/v1/agents/verify-identity"


@dataclass
class AuthResult:
    ok: bool
    status_code: int
    error: str | None = None
    agent: dict[str, Any] | None = None


class MoltbookIdentityVerifier:
    def __init__(self, app_key: str):
        self.app_key = app_key

    def verify_token(self, token: str) -> AuthResult:
        payload = json.dumps({"token": token}).encode("utf-8")
        req = request.Request(
            VERIFY_IDENTITY_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Moltbook-App-Key": self.app_key,
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=20) as resp:  # noqa: S310
                data = json.loads(resp.read().decode("utf-8"))
        except HTTPError as exc:
            return AuthResult(ok=False, status_code=502, error=f"verify_http_error:{exc.code}")
        except URLError:
            return AuthResult(ok=False, status_code=502, error="verify_unreachable")
        except json.JSONDecodeError:
            return AuthResult(ok=False, status_code=502, error="verify_invalid_response")

        valid = bool(data.get("valid"))
        error = data.get("error")
        if valid:
            agent = data.get("agent") or {}
            return AuthResult(ok=True, status_code=200, agent=agent)

        if error == "invalid_app_key":
            return AuthResult(ok=False, status_code=500, error=error)
        if error in {"identity_token_expired", "invalid_token"}:
            return AuthResult(ok=False, status_code=401, error=error)
        return AuthResult(ok=False, status_code=401, error=error or "invalid_token")


class AppHandler(BaseHTTPRequestHandler):
    verified_agent: dict[str, Any] | None = None

    def _render(
        self,
        output: str = "Ready.",
        goal: str = "",
        max_steps: str = "12",
        agent_name: str = "anonymous",
    ) -> None:
        body = PAGE_TEMPLATE.format(
            output=html.escape(output),
            goal=html.escape(goal),
            max_steps=html.escape(max_steps),
            agent=html.escape(agent_name),
        )
        encoded = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _send_json_error(self, status_code: int, message: str) -> None:
        payload = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _authenticate_agent(self) -> AuthResult:
        app_key = os.getenv("MOLTBOOK_APP_KEY", "").strip()
        if not app_key:
            return AuthResult(ok=False, status_code=500, error="moltbook_app_key_missing")

        token = (self.headers.get("X-Moltbook-Identity", "") or "").strip()
        if not token:
            return AuthResult(ok=False, status_code=401, error="missing_identity_token")

        verifier = MoltbookIdentityVerifier(app_key)
        result = verifier.verify_token(token)
        if result.ok:
            self.verified_agent = result.agent
        return result

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/":
            self.send_error(404)
            return
        self._render()

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/run":
            self.send_error(404)
            return

        auth = self._authenticate_agent()
        if not auth.ok:
            self._send_json_error(auth.status_code, auth.error or "unauthorized")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8", errors="ignore")
        data = parse_qs(raw)

        goal = (data.get("goal", [""])[0] or "").strip()
        max_steps = (data.get("max_steps", ["12"])[0] or "12").strip()

        if not goal:
            self._render(
                output="Goal is required.",
                goal=goal,
                max_steps=max_steps,
                agent_name=(auth.agent or {}).get("name", "unknown"),
            )
            return

        command = ["python3", "main.py", "run", goal, "--max-steps", max_steps]
        completed = subprocess.run(command, check=False, text=True, capture_output=True)
        output = (completed.stdout + "\n" + completed.stderr).strip()
        if not output:
            output = f"Command finished with exit code {completed.returncode}."

        profile = auth.agent or {}
        owner = profile.get("owner") or {}
        summary = (
            f"agent={profile.get('name','unknown')} karma={profile.get('karma','?')} "
            f"owner={owner.get('x_handle','unknown')}\n\n"
        )
        self._render(
            output=summary + output,
            goal=goal,
            max_steps=max_steps,
            agent_name=profile.get("name", "unknown"),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run IKOL as a tiny local web terminal")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY") and not os.getenv("OPENROUTER_API_KEY"):
        print("Warning: set OPENAI_API_KEY or OPENROUTER_API_KEY before running requests.")
    if not os.getenv("MOLTBOOK_APP_KEY"):
        print("Warning: set MOLTBOOK_APP_KEY to verify X-Moltbook-Identity tokens.")

    httpd = HTTPServer((args.host, args.port), AppHandler)
    print(f"IKOL Web Terminal running on http://{args.host}:{args.port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
