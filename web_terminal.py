#!/usr/bin/env python3
"""Minimal web terminal for IKOL agent.

Runs a tiny local web UI where users enter a goal and receive the agent output.
"""

from __future__ import annotations

import argparse
import html
import os
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
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


class AppHandler(BaseHTTPRequestHandler):
    def _render(self, output: str = "Ready.", goal: str = "", max_steps: str = "12") -> None:
        body = PAGE_TEMPLATE.format(
            output=html.escape(output),
            goal=html.escape(goal),
            max_steps=html.escape(max_steps),
        )
        encoded = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802
        self._render()

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/run":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8", errors="ignore")
        data = parse_qs(raw)

        goal = (data.get("goal", [""])[0] or "").strip()
        max_steps = (data.get("max_steps", ["12"])[0] or "12").strip()

        if not goal:
            self._render(output="Goal is required.", goal=goal, max_steps=max_steps)
            return

        command = ["python3", "main.py", "run", goal, "--max-steps", max_steps]
        completed = subprocess.run(command, check=False, text=True, capture_output=True)
        output = (completed.stdout + "\n" + completed.stderr).strip()
        if not output:
            output = f"Command finished with exit code {completed.returncode}."
        self._render(output=output, goal=goal, max_steps=max_steps)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run IKOL as a tiny local web terminal")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY") and not os.getenv("OPENROUTER_API_KEY"):
        print("Warning: set OPENAI_API_KEY or OPENROUTER_API_KEY before running requests.")

    httpd = HTTPServer((args.host, args.port), AppHandler)
    print(f"IKOL Web Terminal running on http://{args.host}:{args.port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
