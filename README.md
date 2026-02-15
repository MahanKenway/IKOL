# IKOL Advanced Autonomous Agent

این پروژه یک Agent پیشرفته است که علاوه بر چرخه‌ی اجرا، **برنامه‌ریزی و بازبینی** هم انجام می‌دهد.

## قابلیت‌ها

- **Planner → Executor → Reviewer loop**
- حافظه پایدار در `agent_memory.json`
- پشتیبانی از API سازگار با OpenAI + **OpenRouter**
- سیستم **Skill Registry**:
  - نصب Skill از URL با دستور `install-skill`
  - بررسی دسترسی URL با `curl -s` از داخل CLI
  - خواندن Skillهای نصب‌شده و اعمال در پرامپت اجرایی
- ابزارهای داخلی:
  - `read_file(path)`
  - `write_file(path, content)`
  - `run_shell(command)`

## CLI

### 1) اجرای Agent

```bash
export OPENAI_API_KEY="..."
python3 main.py run "یک ابزار تحلیل لاگ بساز" --max-steps 12
```

### 2) اجرای Agent با OpenRouter

```bash
export AGENT_PROVIDER=openrouter
export OPENROUTER_API_KEY="..."
export AGENT_MODEL="openai/gpt-4o-mini"
python3 main.py run "یک ابزار تحلیل لاگ بساز" --max-steps 12
```

### 3) بررسی URL Skill با curl

```bash
python3 main.py verify-skill-url "https://moltbook.com/skill.md"
```

### 4) نصب Skill

```bash
python3 main.py install-skill "https://moltbook.com/skill.md" --name moltbook
```

### 5) لیست Skillهای نصب‌شده

```bash
python3 main.py list-skills
```

## متغیرهای محیطی

- `AGENT_PROVIDER` (`openai` یا `openrouter`)
- `OPENAI_API_KEY` یا `OPENROUTER_API_KEY` (حداقل یکی لازم است)
- `AGENT_MODEL`
- `OPENAI_BASE_URL`
- `OPENROUTER_HTTP_REFERER` (اختیاری)
- `OPENROUTER_X_TITLE` (اختیاری)
- `AGENT_MEMORY_FILE`
- `AGENT_SKILLS_DIR`

## نکته Moltbook

طبق درخواست، بررسی لینک با `curl -s` در ابزار اضافه شده. اگر شبکه‌ی محیط شما محدود باشد (مثلاً `CONNECT tunnel 403`) دانلود Skill شکست می‌خورد؛ در محیط بدون محدودیت همین دستورات نصب موفق می‌شود.

## هشدار امنیتی

`run_shell` امکان اجرای دستور سیستم دارد. برای محیط production:
- sandbox اجباری کنید
- allowlist فرمان‌ها تعریف کنید
- محدودیت مسیر فایل اعمال کنید

## راهنمای خیلی سریع

برای راه‌اندازی قدم‌به‌قدم، فایل `QUICKSTART_FA.md` را ببینید.
