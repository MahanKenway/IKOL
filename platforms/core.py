"""Shared bot core - platform-independent command handlers and business logic.

All commands, modules and features work on both Telegram and Bale.
Platform-specific code only exists in adapters (telegram.py, bale.py).
"""

from __future__ import annotations

import json
import math
import os
import random
import re
import subprocess
import textwrap
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Callable

from .base import Platform, Message, Update, User, InlineKeyboard
from .i18n import (
    TRANSLATIONS, to_persian_digits, to_english_digits,
    format_jalali_datetime, format_time, format_jalali_date,
    gregorian_to_jalali, detect_language, get_random_poetry,
    get_random_quote, get_user_lang, JALALI_MONTHS,
)


class BotCore:
    """Core bot logic shared across all platforms."""

    def __init__(self):
        self.handlers: dict[str, Callable] = {}
        self.callback_handlers: dict[str, Callable] = {}
        self.user_data: dict[int, dict] = {}
        self._start_time = datetime.now(timezone.utc)
        self._load_user_data()
        self._setup_handlers()

    def _load_user_data(self) -> None:
        """Load user data from file."""
        data_path = Path("user_data.json")
        if data_path.exists():
            try:
                self.user_data = json.loads(data_path.read_text(encoding="utf-8"))
            except Exception:
                self.user_data = {}

    def _save_user_data(self) -> None:
        """Save user data to file."""
        data_path = Path("user_data.json")
        data_path.write_text(
            json.dumps(self.user_data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _get_user_lang(self, user_id: int) -> str:
        """Get user's preferred language."""
        return self.user_data.get(str(user_id), {}).get("language", "en")

    def _set_user_lang(self, user_id: int, lang: str) -> None:
        """Set user's preferred language."""
        uid = str(user_id)
        if uid not in self.user_data:
            self.user_data[uid] = {}
        self.user_data[uid]["language"] = lang
        self._save_user_data()

    def _t(self, user_id: int, key: str, **kwargs) -> str:
        """Get translated string for user."""
        lang = self._get_user_lang(user_id)
        template = TRANSLATIONS.get(lang, TRANSLATIONS["en"]).get(key, key)
        try:
            return template.format(**kwargs) if kwargs else template
        except (KeyError, IndexError):
            return template

    def _setup_handlers(self) -> None:
        """Register all command handlers."""
        # Core commands
        self.handlers["start"] = self.cmd_start
        self.handlers["help"] = self.cmd_help
        self.handlers["run"] = self.cmd_run
        self.handlers["status"] = self.cmd_status
        self.handlers["skills"] = self.cmd_skills
        self.handlers["memory"] = self.cmd_memory
        self.handlers["clear"] = self.cmd_clear

        # New utility commands
        self.handlers["lang"] = self.cmd_lang
        self.handlers["time"] = self.cmd_time
        self.handlers["date"] = self.cmd_date
        self.handlers["calc"] = self.cmd_calc
        self.handlers["translate"] = self.cmd_translate
        self.handlers["poetry"] = self.cmd_poetry
        self.handlers["quote"] = self.cmd_quote
        self.handlers["ping"] = self.cmd_ping

        # Callback handlers
        self.callback_handlers["help:ai"] = self.cb_help_ai
        self.callback_handlers["help:tools"] = self.cb_help_tools
        self.callback_handlers["help:skills"] = self.cb_help_skills
        self.callback_handlers["lang:en"] = self.cb_lang_en
        self.callback_handlers["lang:fa"] = self.cb_lang_fa
        self.callback_handlers["menu:main"] = self.cb_menu_main

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
        user_id = message.from_user.id if message.from_user else 0

        # Auto-detect language from first message
        if user_id and str(user_id) not in self.user_data:
            detected = detect_language(text)
            self._set_user_lang(user_id, detected)

        if not text.startswith("/"):
            # Regular message - could be a goal for the agent
            await self._handle_text(platform, chat_id, text, user_id)
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
                self._t(user_id, "error_unknown", command=command),
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

    async def _handle_text(self, platform: Platform, chat_id: int, text: str, user_id: int = 0) -> None:
        """Handle plain text message - treat as AI goal."""
        lang = self._get_user_lang(user_id)

        # Check if it looks like a goal/question
        if len(text) > 10:
            await self.cmd_run(platform, chat_id, text, Message(
                message_id=0,
                text=f"/run {text}",
            ))
        else:
            await platform.send_message(
                chat_id,
                self._t(user_id, "help_title") + "\n\n" +
                self._t(user_id, "help_run") + "\n" +
                self._t(user_id, "help_time") + "\n" +
                self._t(user_id, "help_date") + "\n" +
                self._t(user_id, "help_calc"),
            )

    # ===== Core Command Handlers =====

    async def cmd_start(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user = message.from_user
        user_id = user.id if user else 0
        name = user.first_name if user else "there"

        # Set language based on detected language code
        if user and user.language_code:
            if user.language_code.startswith("fa"):
                self._set_user_lang(user_id, "fa")

        lang = self._get_user_lang(user_id)

        if lang == "fa":
            text = (
                f"سلام {name}! 👋\n\n"
                "من IKOL هستم (لایه دانش و عملیات هوشمند).\n\n"
                "یک عامل هوش مصنوعی خودمختار هستم که می‌توانم:\n"
                "• وظایف را با برنامه‌ریزی و استدلال اجرا کنم\n"
                "• فایل‌ها را بخوانم و بنویسم\n"
                "• دستورات shell را اجرا کنم\n"
                "• مهارت‌ها را نصب و استفاده کنم\n\n"
                "برای مشاهده همه دستورات از /help استفاده کنید.\n\n"
                "🌐 زبان / Language"
            )
        else:
            text = (
                f"Hello {name}! 👋\n\n"
                "I'm IKOL (Intelligent Knowledge & Operations Layer).\n\n"
                "I'm an autonomous AI agent that can:\n"
                "• Execute tasks using planning and reasoning\n"
                "• Read and write files\n"
                "• Run shell commands\n"
                "• Install and use skills\n\n"
                "Use /help to see all commands.\n\n"
                "🌐 زبان / Language"
            )

        keyboard = platform.build_keyboard([
            [("English", "lang:en"), ("فارسی", "lang:fa")],
            [("📋 Help", "help:ai"), ("▶️ Run", "menu:main")],
        ])

        await platform.send_message(chat_id, text, reply_markup=keyboard)

    async def cmd_help(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0
        lang = self._get_user_lang(user_id)

        if lang == "fa":
            text = (
                "📋 دستورات IKOL\n\n"
                "🤖 عامل هوش مصنوعی:\n"
                "/run <هدف> - اجرای عامل روی یک هدف\n\n"
                "⏰ ابزارها:\n"
                "/time - زمان فعلی\n"
                "/date - تاریخ فعلی (جلالی)\n"
                "/calc <عبارت> - ماشین حساب\n\n"
                "🌐 زبان و فرهنگ:\n"
                "/lang - تغییر زبان\n"
                "/poetry - شعر فارسی\n"
                "/quote - جمله الهام‌بخش\n\n"
                "📊 اطلاعات:\n"
                "/status - وضعیت سیستم\n"
                "/skills - مهارت‌های نصب شده\n"
                "/memory - حافظه عامل\n"
                "/ping - تست اتصال\n\n"
                "💡 همچنین می‌توانید هر متنی برای من ارسال کنید!"
            )
        else:
            text = (
                "📋 IKOL Commands\n\n"
                "🤖 AI Agent:\n"
                "/run <goal> - Run agent on a goal\n\n"
                "⏰ Utilities:\n"
                "/time - Current time\n"
                "/date - Current date (Jalali)\n"
                "/calc <expression> - Calculator\n\n"
                "🌐 Language & Culture:\n"
                "/lang - Change language\n"
                "/poetry - Persian poetry\n"
                "/quote - Inspirational quote\n\n"
                "📊 Info:\n"
                "/status - System status\n"
                "/skills - Installed skills\n"
                "/memory - Agent memory\n"
                "/ping - Connection test\n\n"
                "💡 You can also send any text message!"
            )

        keyboard = platform.build_keyboard([
            [("🤖 AI", "help:ai"), ("🛠 Tools", "help:tools")],
            [("📚 Skills", "help:skills"), ("🏠 Menu", "menu:main")],
        ])

        await platform.send_message(chat_id, text, reply_markup=keyboard)

    async def cmd_run(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0

        if not args:
            await platform.send_message(
                chat_id,
                self._t(user_id, "error_no_goal"),
            )
            return

        await platform.send_message(chat_id, self._t(user_id, "running", goal=args[:100]))

        try:
            # Import and run the agent
            from main import build_runtime, AgentState

            agent, _registry, memory = build_runtime()
            state = AgentState(goal=args, max_steps=12)
            result = agent.run(state, memory)

            # Truncate if too long
            if len(result) > 3500:
                result = result[:3500] + "\n\n... (truncated)"

            await platform.send_message(chat_id, self._t(user_id, "result", result=result))
        except Exception as exc:
            await platform.send_message(chat_id, self._t(user_id, "error", error=str(exc)[:200]))

    async def cmd_status(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0
        lang = self._get_user_lang(user_id)

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

        uptime = datetime.now(timezone.utc) - self._start_time
        uptime_str = str(uptime).split(".")[0]

        if lang == "fa":
            text = (
                "📊 وضعیت IKOL\n\n"
                f"🌐 پلتفرم: {platform.name}\n"
                f"🧠 تعداد حافظه: {to_persian_digits(memory_count)}\n"
                f"📚 مهارت‌ها: {to_persian_digits(skill_count)}\n"
                f"⚙️ ارائه‌دهنده: {os.getenv('AGENT_PROVIDER', 'openai')}\n"
                f"⏱ زمان فعالیت: {uptime_str}\n"
                f"📅 تاریخ: {format_jalali_datetime()}"
            )
        else:
            text = (
                "📊 IKOL Status\n\n"
                f"🌐 Platform: {platform.name}\n"
                f"🧠 Memory entries: {memory_count}\n"
                f"📚 Skills: {skill_count}\n"
                f"⚙️ Provider: {os.getenv('AGENT_PROVIDER', 'openai')}\n"
                f"⏱ Uptime: {uptime_str}\n"
                f"📅 Date: {format_jalali_datetime()}"
            )
        await platform.send_message(chat_id, text)

    async def cmd_skills(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0

        skills_path = Path(os.getenv("AGENT_SKILLS_DIR", "skills"))
        if not skills_path.exists():
            await platform.send_message(chat_id, self._t(user_id, "skills_none"))
            return

        skills = [
            d.name for d in skills_path.iterdir()
            if d.is_dir() and (d / "SKILL.md").exists()
        ]

        if not skills:
            await platform.send_message(chat_id, self._t(user_id, "skills_none"))
            return

        text = self._t(user_id, "skills_title") + "\n\n" + "\n".join(f"• {s}" for s in sorted(skills))
        await platform.send_message(chat_id, text)

    async def cmd_memory(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0
        lang = self._get_user_lang(user_id)

        memory_path = Path(os.getenv("AGENT_MEMORY_FILE", "agent_memory.json"))
        if not memory_path.exists():
            await platform.send_message(chat_id, self._t(user_id, "memory_empty"))
            return

        try:
            data = json.loads(memory_path.read_text(encoding="utf-8"))
            if not data:
                await platform.send_message(chat_id, self._t(user_id, "memory_empty"))
                return

            # Show last 5 entries
            recent = data[-5:]
            count = to_persian_digits(len(data)) if lang == "fa" else str(len(data))

            if lang == "fa":
                text = f"🧠 حافظه ({count} مورد، نمایش ۵ مورد اخیر):\n\n"
                for entry in recent:
                    goal = entry.get("goal", "ناشناخته")[:50]
                    ts = entry.get("timestamp", "?")[:19]
                    text += f"• {ts}: {goal}\n"
            else:
                text = f"🧠 Memory ({count} total, showing last 5):\n\n"
                for entry in recent:
                    goal = entry.get("goal", "unknown")[:50]
                    ts = entry.get("timestamp", "?")[:19]
                    text += f"• {ts}: {goal}\n"

            await platform.send_message(chat_id, text)
        except Exception as exc:
            await platform.send_message(chat_id, self._t(user_id, "error", error=str(exc)[:100]))

    async def cmd_clear(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0
        memory_path = Path(os.getenv("AGENT_MEMORY_FILE", "agent_memory.json"))
        if memory_path.exists():
            memory_path.write_text("[]", encoding="utf-8")
        await platform.send_message(chat_id, self._t(user_id, "memory_cleared"))

    # ===== New Utility Commands =====

    async def cmd_lang(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0

        keyboard = platform.build_keyboard([
            [("English 🇺🇸", "lang:en"), ("فارسی 🇮🇷", "lang:fa")],
        ])

        await platform.send_message(
            chat_id,
            "🌐 Select Language / انتخاب زبان",
            reply_markup=keyboard,
        )

    async def cmd_time(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0
        lang = self._get_user_lang(user_id)

        now = datetime.now(timezone(timedelta(hours=3, minutes=30)))
        time_str = format_time(now, persian_digits=(lang == "fa"))

        if lang == "fa":
            text = f"⏰ زمان فعلی: {time_str}\n📅 تاریخ: {format_jalali_datetime(now, True)}"
        else:
            text = f"⏰ Current time: {time_str}\n📅 Date: {format_jalali_datetime(now, False)}"

        await platform.send_message(chat_id, text)

    async def cmd_date(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0
        lang = self._get_user_lang(user_id)

        now = datetime.now(timezone(timedelta(hours=3, minutes=30)))
        jy, jm, jd = gregorian_to_jalali(now.year, now.month, now.day)

        if lang == "fa":
            from .i18n import JALALI_MONTHS
            month_name = JALALI_MONTHS[jm - 1]
            text = (
                f"📅 تاریخ امروز:\n\n"
                f"جلالی: {to_persian_digits(jd)} {month_name} {to_persian_digits(jy)}\n"
                f"میلادی: {now.strftime('%Y-%m-%d')}\n"
                f"روز هفته: {['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'][now.weekday()]}"
            )
        else:
            from .i18n import JALALI_MONTHS_EN
            month_name = JALALI_MONTHS_EN[jm - 1]
            weekday = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][now.weekday()]
            text = (
                f"📅 Today's Date:\n\n"
                f"Jalali: {jd} {month_name} {jy}\n"
                f"Gregorian: {now.strftime('%Y-%m-%d')}\n"
                f"Weekday: {weekday}"
            )

        await platform.send_message(chat_id, text)

    async def cmd_calc(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0

        if not args:
            await platform.send_message(
                chat_id,
                "Usage: /calc <expression>\n\nExamples:\n/calc 2 + 2\n/calc 15 * 3\n/calc sqrt(144)\n/calc sin(3.14)",
            )
            return

        try:
            # Safe math evaluation
            allowed_names = {
                "abs": abs, "round": round, "min": min, "max": max,
                "sqrt": math.sqrt, "sin": math.sin, "cos": math.cos,
                "tan": math.tan, "log": math.log, "log10": math.log10,
                "pi": math.pi, "e": math.e, "pow": pow,
            }
            result = eval(args, {"__builtins__": {}}, allowed_names)
            await platform.send_message(chat_id, f"🧮 Result: {result}")
        except Exception as exc:
            await platform.send_message(chat_id, f"❌ Error: {exc}")

    async def cmd_translate(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0

        if not args:
            await platform.send_message(
                chat_id,
                "Usage: /translate <text>\n\nExample: /translate Hello world",
            )
            return

        # Simple translation using MyMemory API
        try:
            from urllib import request, parse
            url = f"https://api.mymemory.translated.net/get?q={parse.quote(args)}&langpair=auto|{'fa' if self._get_user_lang(user_id) == 'en' else 'en'}"
            req = request.Request(url)
            with request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                translated = data.get("responseData", {}).get("translatedText", "Translation failed")
                await platform.send_message(chat_id, f"🌐 Translation:\n\n{args}\n\n→ {translated}")
        except Exception:
            await platform.send_message(chat_id, "❌ Translation service unavailable.")

    async def cmd_poetry(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        poem = get_random_poetry()
        text = f"🪶 {poem['poet']}\n\n{poem['verse']}"
        await platform.send_message(chat_id, text)

    async def cmd_quote(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        quote = get_random_quote()
        text = f"💬 {quote['text']}\n\n— {quote['author']}"
        await platform.send_message(chat_id, text)

    async def cmd_ping(self, platform: Platform, chat_id: int, args: str, message: Message) -> None:
        user_id = message.from_user.id if message.from_user else 0
        lang = self._get_user_lang(user_id)

        if lang == "fa":
            await platform.send_message(chat_id, "🏓 پونگ! اتصال فعال است.")
        else:
            await platform.send_message(chat_id, "🏓 Pong! Connection is active.")

    # ===== Callback Handlers =====

    async def cb_help_ai(self, platform: Platform, chat_id: int, args: str) -> None:
        await platform.send_message(
            chat_id,
            "🤖 AI Agent Features:\n\n"
            "IKOL uses a planner-executor-reviewer loop:\n"
            "1. Planner creates an execution plan\n"
            "2. Executor carries out each step\n"
            "3. Reviewer checks if the goal is met\n\n"
            "Supported providers: OpenAI, OpenRouter\n"
            "Use /run <goal> to start.",
        )

    async def cb_help_tools(self, platform: Platform, chat_id: int, args: str) -> None:
        await platform.send_message(
            chat_id,
            "🛠 Available Tools:\n\n"
            "• read_file: Read file contents\n"
            "• write_file: Create/modify files\n"
            "• run_shell: Execute shell commands\n\n"
            "The agent uses these tools autonomously.",
        )

    async def cb_help_skills(self, platform: Platform, chat_id: int, args: str) -> None:
        await platform.send_message(
            chat_id,
            "📚 Skills System:\n\n"
            "Skills are markdown files that extend IKOL's capabilities.\n\n"
            "Install: /install <url>\n"
            "List: /skills\n\n"
            "Skills provide instructions the agent follows.",
        )

    async def cb_lang_en(self, platform: Platform, chat_id: int, args: str) -> None:
        # We need to get user_id from callback - for now use chat_id
        self.user_data[str(chat_id)] = self.user_data.get(str(chat_id), {})
        self.user_data[str(chat_id)]["language"] = "en"
        self._save_user_data()
        await platform.send_message(chat_id, "✅ Language changed to English.")

    async def cb_lang_fa(self, platform: Platform, chat_id: int, args: str) -> None:
        self.user_data[str(chat_id)] = self.user_data.get(str(chat_id), {})
        self.user_data[str(chat_id)]["language"] = "fa"
        self._save_user_data()
        await platform.send_message(chat_id, "✅ زبان به فارسی تغییر کرد.")

    async def cb_menu_main(self, platform: Platform, chat_id: int, args: str) -> None:
        lang = self._get_user_lang(chat_id)

        if lang == "fa":
            text = (
                "🏠 منوی اصلی IKOL\n\n"
                "از دستورات زیر استفاده کنید:\n\n"
                "🤖 /run <هدف> - اجرای عامل\n"
                "⏰ /time - زمان فعلی\n"
                "📅 /date - تاریخ jalali\n"
                "🧮 /calc - ماشین حساب\n"
                "🌐 /lang - تغییر زبان\n"
                "🪶 /poetry - شعر فارسی\n"
                "💬 /quote - جمله الهام‌بخش\n"
                "📊 /status - وضعیت سیستم\n"
                "❓ /help - راهنما"
            )
        else:
            text = (
                "🏠 IKOL Main Menu\n\n"
                "Use these commands:\n\n"
                "🤖 /run <goal> - Run agent\n"
                "⏰ /time - Current time\n"
                "📅 /date - Jalali date\n"
                "🧮 /calc - Calculator\n"
                "🌐 /lang - Change language\n"
                "🪶 /poetry - Persian poetry\n"
                "💬 /quote - Inspirational quote\n"
                "📊 /status - System status\n"
                "❓ /help - Help"
            )

        await platform.send_message(chat_id, text)
