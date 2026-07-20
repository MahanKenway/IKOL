"""Shared bot core - platform-independent command handlers and business logic.

All commands, modules and features work on both Telegram and Bale.
Platform-specific code only exists in adapters (telegram.py, bale.py).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import textwrap
from pathlib import Path
from typing import Any, Callable, Awaitable

from .base import Platform, Message, Update, User, InlineKeyboard


class BotCore:
    """Core bot logic shared across all platforms."""

    def __init__(self):
        self.handlers: dict[str, Callable] = {}
        self.callback_handlers: dict[str, Callable] = {}
        self._setup_handlers()

    def _setup_handlers(self) -> None:
        """Register all command handlers."""
        self.handlers["start"] = self.cmd_start
        self.handlers["help"] = self.cmd_help
        self.handlers["run"] = self.cmd_run
        self.handlers["status"] = self.cmd_status
        self.handlers["skills"] = self.cmd_skills
        self.handlers["memory"] = self.cmd_memory
        self.handlers["clear"] = self.cmd_clear

        # Callback handlers
        self.callback_handlers["help:ai"] = self.cb_help_ai
        self.callback_handlers["help:tools"] = self.cb_help_tools
        self.callback_handlers["help:skills"] = self.cb_help_skills

    async def handle_update(self, platform: Platform, update: Update) -> None:
        """Process an update from any platform."""
        # Handle callback queries
        if update.callback_query:
            await self._handle_callback(platform, update.callback_query)
            return

        # Handle messages
        if update.message and update.message.text:
            await self._handle_message(platform, update.message)

    async def _handle_message(self, platform: Platform, message: Message) -> None:
        """Route message to appropriate handler."""
        text = message.text.strip()
        chat_id = message.chat.id if message.chat else 0

        if not text.startswith("/"):
            # Regular message - could be a goal for the agent
            await self._handle_text(platform, chat_id, text)
            return

        # Parse command
        parts = text.split(maxsplit=1)
        command = parts[0].lstrip("/").split("@")[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        handler = self.handlers.get(command)
        if handler:
            await handler(platform, chat_id, args, message)
        else:
            await platform.send_message(
                chat_id,
                f"Unknown command: /{command}\nUse /help to see available commands.",
            )

    async def _handle_callback(self, platform: Platform, callback: Any) -> None:
        """Handle callback query."""
        data = callback.data if hasattr(callback, "data") else None
        if not data:
            return

        await platform.answer_callback(callback.id)

        handler = self.callback_handlers.get(data)
        if handler:
            chat_id = callback.message.chat.id if callback.message and callback.message.chat else 0
            await handler(platform, chat_id, "")
        else:
            await platform.send_message(
                callback.message.chat.id if callback.message else 0,
                f"Callback not recognized: {data}",
            )

    async def _handle_text(self, platform: Platform, chat_id: int, text: str) -> None:
        """Handle plain text message."""
        await platform.send_message(
            chat_id,
            "I received your message. Use /help to see what I can do!",
        )

    # ===== Command Handlers =====

    async def cmd_start(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user = message.from_user
        name = user.first_name if user else "there"

        text = (
            f"Hello {name}! I'm IKOL (Intelligent Knowledge & Operations Layer).\n\n"
            "I'm an autonomous AI agent that can:\n"
            "- Execute tasks using planning and reasoning\n"
            "- Read and write files\n"
            "- Run shell commands\n"
            "- Install and use skills\n\n"
            "Use /help to see all commands."
        )

        keyboard = platform.build_keyboard([
            [("Help", "help:ai"), ("Run Task", "run")],
        ])

        await platform.send_message(chat_id, text, reply_markup=keyboard)

    async def cmd_help(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        text = (
            "IKOL Commands:\n\n"
            "/start - Welcome message\n"
            "/help - Show this help\n"
            "/run <goal> - Run agent on a goal\n"
            "/status - Show current status\n"
            "/skills - List installed skills\n"
            "/memory - View agent memory\n"
            "/clear - Clear conversation history\n\n"
            "You can also send any text message to chat with me."
        )

        keyboard = platform.build_keyboard([
            [("AI Features", "help:ai"), ("Tools", "help:tools")],
            [("Skills", "help:skills")],
        ])

        await platform.send_message(chat_id, text, reply_markup=keyboard)

    async def cmd_run(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        if not args:
            await platform.send_message(
                chat_id,
                "Usage: /run <goal>\n\nExample: /run Create a Python script to count words in a file",
            )
            return

        await platform.send_message(chat_id, f"Running agent on: {args}\n\nThis may take a moment...")

        try:
            # Import and run the agent
            from main import build_runtime, AgentState

            agent, _registry, memory = build_runtime()
            state = AgentState(goal=args, max_steps=12)
            result = agent.run(state, memory)

            # Truncate if too long
            if len(result) > 3500:
                result = result[:3500] + "\n\n... (truncated)"

            await platform.send_message(chat_id, f"Result:\n\n{result}")
        except Exception as exc:
            await platform.send_message(chat_id, f"Error: {exc}")

    async def cmd_status(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        memory_path = Path(os.getenv("AGENT_MEMORY_FILE", "agent_memory.json"))
        memory_count = 0
        if memory_path.exists():
            try:
                data = json.loads(memory_path.read_text(encoding="utf-8"))
                memory_count = len(data)
            except Exception:
                pass

        skills_path = Path(os.getenv("AGENT_SKILLS_DIR", "skills"))
        skill_count = 0
        if skills_path.exists():
            skill_count = len([
                d for d in skills_path.iterdir()
                if d.is_dir() and (d / "SKILL.md").exists()
            ])

        text = (
            "IKOL Status\n\n"
            f"Platform: {platform.name}\n"
            f"Memory entries: {memory_count}\n"
            f"Installed skills: {skill_count}\n"
            f"Provider: {os.getenv('AGENT_PROVIDER', 'openai')}"
        )
        await platform.send_message(chat_id, text)

    async def cmd_skills(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        skills_path = Path(os.getenv("AGENT_SKILLS_DIR", "skills"))
        if not skills_path.exists():
            await platform.send_message(chat_id, "No skills installed yet.\n\nUse /install <url> to install a skill.")
            return

        skills = [
            d.name for d in skills_path.iterdir()
            if d.is_dir() and (d / "SKILL.md").exists()
        ]

        if not skills:
            await platform.send_message(chat_id, "No skills installed yet.")
            return

        text = "Installed Skills:\n\n" + "\n".join(f"- {s}" for s in sorted(skills))
        await platform.send_message(chat_id, text)

    async def cmd_memory(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        memory_path = Path(os.getenv("AGENT_MEMORY_FILE", "agent_memory.json"))
        if not memory_path.exists():
            await platform.send_message(chat_id, "No memory entries yet.")
            return

        try:
            data = json.loads(memory_path.read_text(encoding="utf-8"))
            if not data:
                await platform.send_message(chat_id, "Memory is empty.")
                return

            # Show last 5 entries
            recent = data[-5:]
            text = f"Memory ({len(data)} total entries, showing last 5):\n\n"
            for entry in recent:
                goal = entry.get("goal", "unknown")[:50]
                ts = entry.get("timestamp", "?")[:19]
                text += f"- {ts}: {goal}\n"

            await platform.send_message(chat_id, text)
        except Exception as exc:
            await platform.send_message(chat_id, f"Error reading memory: {exc}")

    async def cmd_clear(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        memory_path = Path(os.getenv("AGENT_MEMORY_FILE", "agent_memory.json"))
        if memory_path.exists():
            memory_path.write_text("[]", encoding="utf-8")
        await platform.send_message(chat_id, "Memory cleared.")

    # ===== Callback Handlers =====

    async def cb_help_ai(self, platform: Platform, chat_id: int, args: str) -> None:
        text = (
            "AI Features:\n\n"
            "IKOL uses a planner-executor-reviewer loop:\n"
            "1. Planner creates an execution plan\n"
            "2. Executor carries out each step\n"
            "3. Reviewer checks if the goal is met\n\n"
            "Supported providers: OpenAI, OpenRouter\n"
            "Use /run <goal> to start."
        )
        await platform.send_message(chat_id, text)

    async def cb_help_tools(self, platform: Platform, chat_id: int, args: str) -> None:
        text = (
            "Available Tools:\n\n"
            "- read_file: Read file contents\n"
            "- write_file: Create/modify files\n"
            "- run_shell: Execute shell commands\n\n"
            "The agent uses these tools autonomously to achieve goals."
        )
        await platform.send_message(chat_id, text)

    async def cb_help_skills(self, platform: Platform, chat_id: int, args: str) -> None:
        text = (
            "Skills System:\n\n"
            "Skills are markdown files that extend IKOL's capabilities.\n\n"
            "Install: /install <url>\n"
            "List: /skills\n\n"
            "Skills provide instructions the agent follows."
        )
        await platform.send_message(chat_id, text)
