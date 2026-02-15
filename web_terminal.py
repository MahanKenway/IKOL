#!/usr/bin/env python3
"""UI-TARS-style minimal web console for IKOL agent.

- Browser UI for entering goal + max steps
- Optional Moltbook identity token input
- JSON API endpoint `/api/run`
- Legacy form endpoint `/run` kept for backward compatibility
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

VERIFY_IDENTITY_URL = "https://moltbook.com/api/v1/agents/verify-identity"

PAGE_TEMPLATE = """<!doctype html>
<html lang="fa">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IKOL UI Console</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; font-family: Inter, ui-monospace, monospace; background:#0a0f1f; color:#e5edff; }
    .container { max-width: 980px; margin: 24px auto; padding: 0 16px; }
    .card { background:#101732; border:1px solid #243052; border-radius:14px; padding:16px; box-shadow: 0 8px 24px rgba(0,0,0,.25); }
    h1 { margin:0 0 6px; font-size: 20px; }
    .muted { color:#95a7d1; font-size:13px; margin:0 0 12px; }
    label { display:block; margin:10px 0 6px; font-size:13px; color:#bbcaf0; }
    input, textarea { width:100%; box-sizing:border-box; border:1px solid #33446f; border-radius:10px; background:#0d1430; color:#e8f0ff; padding:10px; }
    textarea { min-height:110px; resize: vertical; }
    .row { display:flex; gap:12px; }
    .row > div { flex:1; }
    button { background:#3a7afe; color:#fff; border:0; border-radius:10px; padding:10px 14px; font-weight:600; cursor:pointer; margin-top:12px; }
    pre { background:#090f24; border:1px solid #273760; border-radius:10px; padding:14px; min-height:180px; white-space:pre-wrap; }
    .pill { display:inline-block; font-size:12px; border:1px solid #33446f; padding:2px 8px; border-radius:999px; color:#b9c9ef; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>IKOL UI Console</h1>
      <p class="muted">یک نسخه ساده و سایت‌طور برای اجرای Agent (الهام‌گرفته از UX مدرن Agent Console).</p>
      <span class="pill">Auth Agent: <span id="agentName">anonymous</span></span>
      <label>Goal</label>
      <textarea id="goal" placeholder="مثال: یک برنامه برای تحلیل لاگ طراحی کن"></textarea>
      <div class="row">
        <div>
          <label>Max Steps</label>
          <input id="maxSteps" type="number" min="1" max="50" value="12" />
        </div>
        <div>
          <label>X-Moltbook-Identity (optional)</label>
          <input id="identity" type="text" placeholder="identity token" />
        </div>
      </div>
      <button id="runBtn">Run Agent</button>
      <label>Output</label>
      <pre id="output">Ready.</pre>
    </div>
  </div>

<script>
const output = document.getElementById('output');
const runBtn = document.getElementById('runBtn');
const agentName = document.getElementById('agentName');

runBtn.addEventListener('click', async () => {
  const goal = document.getElementById('goal').value.trim();
  const maxSteps = document.getElementById('maxSteps').value.trim() || '12';
  const identity = document.getElementById('identity').value.trim();

  if (!goal) {
    output.textContent = 'Goal is required.';
    return;
  }

  runBtn.disabled = true;
  output.textContent = 'Running...';

  try {
    const headers = {'Content-Type': 'application/json'};
    if (identity) headers['X-Moltbook-Identity'] = identity;

    const res = await fetch('/api/run', {
      method: 'POST',
      headers,
      body: JSON.stringify({goal, max_steps: maxSteps}),
    });

    const text = await res.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = {raw: text}; }

    if (!res.ok) {
      output.textContent = JSON.stringify(payload, null, 2);
      agentName.textContent = 'anonymous';
      return;
    }

    const agent = payload.agent || {};
    agentName.textContent = agent.name || 'anonymous';
    output.textContent = payload.output || '(empty output)';
  } catch (e) {
    output.textContent = 'Request failed: ' + String(e);
  } finally {
    runBtn.disabled = false;
  }
});
</script>
</body>
</html>"""


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
        if valid:
            return AuthResult(ok=True, status_code=200, agent=data.get("agent") or {})

        error = data.get("error")
        if error == "invalid_app_key":
            return AuthResult(ok=False, status_code=500, error=error)
        if error in {"identity_token_expired", "invalid_token"}:
            return AuthResult(ok=False, status_code=401, error=error)
        return AuthResult(ok=False, status_code=401, error=error or "invalid_token")


class AppHandler(BaseHTTPRequestHandler):
    verified_agent: dict[str, Any] | None = None

    def _send_json(self, payload: dict[str, Any], status_code: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _render_html(self) -> None:
        encoded = PAGE_TEMPLATE.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _authenticate_agent(self) -> AuthResult:
        token = (self.headers.get("X-Moltbook-Identity", "") or "").strip()
        if not token:
            return AuthResult(ok=True, status_code=200, agent=None)

        app_key = os.getenv("MOLTBOOK_APP_KEY", "").strip()
        if not app_key:
            return AuthResult(ok=False, status_code=500, error="moltbook_app_key_missing")

        result = MoltbookIdentityVerifier(app_key).verify_token(token)
        if result.ok:
            self.verified_agent = result.agent
        return result

    def _run_agent(self, goal: str, max_steps: str) -> tuple[int, str]:
        command = ["python3", "main.py", "run", goal, "--max-steps", max_steps]
        completed = subprocess.run(command, check=False, text=True, capture_output=True)
        output = (completed.stdout + "\n" + completed.stderr).strip()
        if not output:
            output = f"Command finished with exit code {completed.returncode}."
        return completed.returncode, output

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/":
            self.send_error(404)
            return
        self._render_html()

    def do_POST(self) -> None:  # noqa: N802
        if self.path == "/api/run":
            self._handle_api_run()
            return
        if self.path == "/run":
            self._handle_legacy_form_run()
            return
        self.send_error(404)

    def _handle_api_run(self) -> None:
        auth = self._authenticate_agent()
        if not auth.ok:
            self._send_json({"error": auth.error or "unauthorized"}, status_code=auth.status_code)
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8", errors="ignore")
        try:
            body = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            self._send_json({"error": "invalid_json_body"}, status_code=400)
            return

        goal = str(body.get("goal", "")).strip()
        max_steps = str(body.get("max_steps", "12")).strip() or "12"
        if not goal:
            self._send_json({"error": "goal_required"}, status_code=400)
            return

        code, output = self._run_agent(goal, max_steps)
        status_code = 200 if code == 0 else 500
        self._send_json(
            {
                "ok": code == 0,
                "exit_code": code,
                "agent": auth.agent,
                "goal": goal,
                "max_steps": max_steps,
                "output": output,
            },
            status_code=status_code,
        )

    def _handle_legacy_form_run(self) -> None:
        auth = self._authenticate_agent()
        if not auth.ok:
            self._send_json({"error": auth.error or "unauthorized"}, status_code=auth.status_code)
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8", errors="ignore")
        form = parse_qs(raw)
        goal = (form.get("goal", [""])[0] or "").strip()
        max_steps = (form.get("max_steps", ["12"])[0] or "12").strip()

        if not goal:
            self._send_json({"error": "goal_required"}, status_code=400)
            return

        code, output = self._run_agent(goal, max_steps)
        profile = auth.agent or {}
        owner = profile.get("owner") or {}
        summary = (
            f"agent={profile.get('name','anonymous')} karma={profile.get('karma','?')} "
            f"owner={owner.get('x_handle','unknown')}\n\n"
        )
        status_code = 200 if code == 0 else 500
        self._send_json({"ok": code == 0, "exit_code": code, "output": summary + output, "agent": profile}, status_code=status_code)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run IKOL as a tiny web console")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY") and not os.getenv("OPENROUTER_API_KEY"):
        print("Warning: set OPENAI_API_KEY or OPENROUTER_API_KEY before running requests.")

    httpd = HTTPServer((args.host, args.port), AppHandler)
    print(f"IKOL Web Console running on http://{args.host}:{args.port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
