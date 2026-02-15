#!/usr/bin/env python3
"""IKOL: advanced autonomous agent with planning, reflection, memory, and skill installation."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import textwrap
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import request
from urllib.error import URLError


def utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


@dataclass
class AgentMemory:
    path: Path = field(default_factory=lambda: Path("agent_memory.json"))

    def load(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

    def save(self, entries: list[dict[str, Any]]) -> None:
        self.path.write_text(
            json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8"
        )


@dataclass
class SkillRegistry:
    root: Path = field(default_factory=lambda: Path("skills"))

    def __post_init__(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def list_installed(self) -> list[str]:
        skills: list[str] = []
        for item in self.root.iterdir():
            if item.is_dir() and (item / "SKILL.md").exists():
                skills.append(item.name)
        return sorted(skills)

    def verify_url_with_curl(self, url: str) -> tuple[bool, str]:
        command = ["curl", "-sS", "-L", url]
        completed = subprocess.run(command, check=False, text=True, capture_output=True)
        if completed.returncode == 0:
            snippet = completed.stdout[:220]
            return True, f"curl_ok bytes={len(completed.stdout)} preview={snippet!r}"
        err = (completed.stderr or completed.stdout).strip()[:300]
        return False, f"curl_failed code={completed.returncode} details={err}"

    def install_from_url(self, url: str, name: str | None = None) -> str:
        body, source = self._download_skill(url)
        if body is None:
            return source

        skill_name = name or self._derive_name(url)
        target = self.root / skill_name
        target.mkdir(parents=True, exist_ok=True)
        (target / "SKILL.md").write_text(body, encoding="utf-8")
        return f"Installed skill '{skill_name}' from {url} via {source}"

    def _download_skill(self, url: str) -> tuple[str | None, str]:
        # User explicitly asked for curl validation; try curl first.
        curl_ok, curl_message = self.verify_url_with_curl(url)
        if curl_ok:
            completed = subprocess.run(
                ["curl", "-sS", "-L", url],
                check=False,
                text=True,
                capture_output=True,
            )
            if completed.returncode == 0 and completed.stdout.strip():
                return completed.stdout, "curl"
            return None, f"Skill download failed via curl: {curl_message}"

        try:
            with request.urlopen(url, timeout=30) as resp:  # noqa: S310
                body = resp.read().decode("utf-8")
            return body, "urllib"
        except URLError as exc:
            return (
                None,
                f"Skill download failed. curl=({curl_message}) urllib=({exc})",
            )

    def read_skill_bodies(self, limit_chars: int = 8000) -> str:
        chunks: list[str] = []
        for skill_name in self.list_installed():
            body = (self.root / skill_name / "SKILL.md").read_text(encoding="utf-8")
            chunks.append(f"## {skill_name}\n{body[:2000]}")
        joined = "\n\n".join(chunks)
        return joined[:limit_chars]

    @staticmethod
    def _derive_name(url: str) -> str:
        cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", url).strip("-")
        return cleaned[-64:] or "external-skill"


class LocalTools:
    @staticmethod
    def read_file(path: str) -> str:
        p = Path(path).expanduser().resolve()
        if not p.exists():
            return f"File does not exist: {p}"
        return p.read_text(encoding="utf-8")[:6000]

    @staticmethod
    def write_file(path: str, content: str) -> str:
        p = Path(path).expanduser().resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Wrote file: {p}"

    @staticmethod
    def run_shell(command: str) -> str:
        completed = subprocess.run(
            command,
            shell=True,
            check=False,
            text=True,
            capture_output=True,
        )
        output = (completed.stdout + "\n" + completed.stderr).strip()
        return f"exit={completed.returncode}\n{output}"[:6000]


class OpenAICompatibleLLM:
    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        extra_headers: dict[str, str] | None = None,
    ):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.extra_headers = extra_headers or {}

    def chat(self, messages: list[dict[str, str]], temperature: float = 0.2) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            **self.extra_headers,
        }
        req = request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with request.urlopen(req, timeout=90) as resp:  # noqa: S310
            data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"]


def extract_json(text: str) -> dict[str, Any]:
    """Best-effort JSON extraction from model output."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            return {"action": "finish", "final_answer": text}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {"action": "finish", "final_answer": text}


@dataclass
class AgentState:
    goal: str
    max_steps: int = 12
    history: list[dict[str, Any]] = field(default_factory=list)


class AutonomousAgent:
    def __init__(self, llm: OpenAICompatibleLLM, tools: dict[str, Any], skill_registry: SkillRegistry):
        self.llm = llm
        self.tools = tools
        self.skill_registry = skill_registry

    def _planner_prompt(self, goal: str) -> str:
        return textwrap.dedent(
            f"""
            You are a planning engine. Generate an execution plan for this goal:
            {goal}

            Return JSON only:
            {{"plan": ["step1", "step2", ...], "success_criteria": ["..."]}}
            """
        ).strip()

    def _executor_prompt(
        self,
        goal: str,
        plan: dict[str, Any],
        memory: list[dict[str, Any]],
        history: list[dict[str, Any]],
    ) -> str:
        installed_skills = self.skill_registry.read_skill_bodies(limit_chars=6000)
        return textwrap.dedent(
            f"""
            You are an autonomous execution agent.
            Goal: {goal}
            Plan JSON: {json.dumps(plan, ensure_ascii=False)}

            Follow installed skill instructions if relevant:
            {installed_skills or "(no installed skills)"}

            You must output JSON only with schema:
            {{
              "thought": "short reasoning",
              "action": "read_file|write_file|run_shell|finish",
              "input": {{}},
              "final_answer": "required when action=finish",
              "confidence": 0.0
            }}

            Prefer safe, incremental actions. If enough evidence, finish.
            """
        ).strip() + "\n\n" + json.dumps(
            {
                "recent_memory": memory[-8:],
                "recent_history": history[-8:],
                "timestamp": utc_now(),
            },
            ensure_ascii=False,
        )

    def _review_prompt(self, goal: str, history: list[dict[str, Any]]) -> str:
        return textwrap.dedent(
            f"""
            You are a reviewer. Decide whether the goal is met.
            Goal: {goal}
            Return JSON only:
            {{"done": true/false, "reason": "...", "final_answer": "if done"}}
            History: {json.dumps(history[-12:], ensure_ascii=False)}
            """
        ).strip()

    def run(self, state: AgentState, memory_store: AgentMemory) -> str:
        memory = memory_store.load()

        planner_raw = self.llm.chat(
            [
                {"role": "system", "content": "Return JSON only."},
                {"role": "user", "content": self._planner_prompt(state.goal)},
            ]
        )
        plan = extract_json(planner_raw)
        state.history.append({"phase": "plan", "data": plan})

        for step_no in range(1, state.max_steps + 1):
            exec_raw = self.llm.chat(
                [
                    {"role": "system", "content": "Return JSON only."},
                    {
                        "role": "user",
                        "content": self._executor_prompt(state.goal, plan, memory, state.history),
                    },
                ]
            )
            decision = extract_json(exec_raw)
            decision["step"] = step_no
            state.history.append({"phase": "execute", "data": decision})
            memory.append({"goal": state.goal, "timestamp": utc_now(), "decision": decision})

            action = decision.get("action", "finish")
            if action == "finish":
                memory_store.save(memory)
                return str(decision.get("final_answer", "Done."))

            tool = self.tools.get(action)
            if tool is None:
                state.history.append({"phase": "observation", "data": f"Unknown action: {action}"})
                continue

            kwargs = decision.get("input", {}) or {}
            try:
                observation = tool(**kwargs)
            except TypeError as exc:
                observation = f"Invalid tool input: {exc}"

            state.history.append({"phase": "observation", "data": observation})
            memory.append({"goal": state.goal, "timestamp": utc_now(), "observation": observation})

            review_raw = self.llm.chat(
                [
                    {"role": "system", "content": "Return JSON only."},
                    {"role": "user", "content": self._review_prompt(state.goal, state.history)},
                ],
                temperature=0.1,
            )
            review = extract_json(review_raw)
            state.history.append({"phase": "review", "data": review})
            if review.get("done"):
                memory_store.save(memory)
                return str(review.get("final_answer") or review.get("reason") or "Done.")

        memory_store.save(memory)
        return "Reached max steps without finishing."


def build_runtime() -> tuple[AutonomousAgent, SkillRegistry, AgentMemory]:
    provider = os.getenv("AGENT_PROVIDER", "openai").strip().lower()
    openai_key = os.getenv("OPENAI_API_KEY", "")
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    api_key = openai_key or openrouter_key
    if not api_key:
        raise RuntimeError("Set OPENAI_API_KEY or OPENROUTER_API_KEY in your environment.")

    if provider == "openrouter":
        default_model = "openai/gpt-4o-mini"
        default_base_url = "https://openrouter.ai/api/v1"
    else:
        default_model = "gpt-4o-mini"
        default_base_url = "https://api.openai.com/v1"

    model = os.getenv("AGENT_MODEL", default_model)
    base_url = os.getenv("OPENAI_BASE_URL", default_base_url)

    extra_headers: dict[str, str] = {}
    referer = os.getenv("OPENROUTER_HTTP_REFERER", "")
    title = os.getenv("OPENROUTER_X_TITLE", "IKOL Agent")
    if provider == "openrouter":
        if referer:
            extra_headers["HTTP-Referer"] = referer
        if title:
            extra_headers["X-Title"] = title

    llm = OpenAICompatibleLLM(
        model=model,
        api_key=api_key,
        base_url=base_url,
        extra_headers=extra_headers,
    )
    skill_registry = SkillRegistry(Path(os.getenv("AGENT_SKILLS_DIR", "skills")))
    tools = {
        "read_file": LocalTools.read_file,
        "write_file": LocalTools.write_file,
        "run_shell": LocalTools.run_shell,
    }
    agent = AutonomousAgent(llm=llm, tools=tools, skill_registry=skill_registry)
    memory = AgentMemory(Path(os.getenv("AGENT_MEMORY_FILE", "agent_memory.json")))
    return agent, skill_registry, memory


def cli() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Advanced autonomous AI agent")
    sub = parser.add_subparsers(dest="command", required=True)

    run_p = sub.add_parser("run", help="Run agent against a goal")
    run_p.add_argument("goal", help="Goal the agent should achieve")
    run_p.add_argument("--max-steps", type=int, default=12)

    ins_p = sub.add_parser("install-skill", help="Install a skill from URL")
    ins_p.add_argument("url", help="Direct URL to skill markdown")
    ins_p.add_argument("--name", help="Optional local skill name")

    verify_p = sub.add_parser("verify-skill-url", help="Verify skill URL via curl")
    verify_p.add_argument("url", help="Direct URL to skill markdown")

    sub.add_parser("list-skills", help="List installed skills")
    return parser


def main() -> None:
    parser = cli()
    args = parser.parse_args()

    if args.command == "install-skill":
        registry = SkillRegistry(Path(os.getenv("AGENT_SKILLS_DIR", "skills")))
        msg = registry.install_from_url(args.url, args.name)
        print(msg)
        return

    if args.command == "verify-skill-url":
        registry = SkillRegistry(Path(os.getenv("AGENT_SKILLS_DIR", "skills")))
        ok, message = registry.verify_url_with_curl(args.url)
        print(json.dumps({"ok": ok, "message": message}, ensure_ascii=False))
        return

    if args.command == "list-skills":
        registry = SkillRegistry(Path(os.getenv("AGENT_SKILLS_DIR", "skills")))
        for name in registry.list_installed():
            print(name)
        return

    agent, _registry, memory = build_runtime()
    state = AgentState(goal=args.goal, max_steps=args.max_steps)
    final = agent.run(state, memory)
    print(final)


if __name__ == "__main__":
    main()
