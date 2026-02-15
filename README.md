# IKOL Advanced Autonomous Agent

این پروژه یک Agent پیشرفته است که علاوه بر چرخه‌ی اجرا، **برنامه‌ریزی و بازبینی** هم انجام می‌دهد.

## قابلیت‌ها

- **Planner → Executor → Reviewer loop**
- حافظه پایدار در `agent_memory.json`
- پشتیبانی از API سازگار با OpenAI
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

### 2) بررسی URL Skill با curl

```bash
python3 main.py verify-skill-url "https://moltbook.com/skill.md"
```

### 3) نصب Skill

```bash
python3 main.py install-skill "https://moltbook.com/skill.md" --name moltbook
```

### 4) لیست Skillهای نصب‌شده

```bash
python3 main.py list-skills
```

## متغیرهای محیطی

- `OPENAI_API_KEY` (اجباری)
- `AGENT_MODEL` (اختیاری، پیش‌فرض: `gpt-4o-mini`)
- `OPENAI_BASE_URL` (اختیاری، پیش‌فرض: `https://api.openai.com/v1`)
- `AGENT_MEMORY_FILE` (اختیاری، پیش‌فرض: `agent_memory.json`)
- `AGENT_SKILLS_DIR` (اختیاری، پیش‌فرض: `skills`)

## نکته Moltbook

طبق درخواست، بررسی لینک با `curl -s` در ابزار اضافه شده. اگر شبکه‌ی محیط شما محدود باشد (مثلاً `CONNECT tunnel 403`) دانلود Skill شکست می‌خورد؛ در محیط بدون محدودیت همین دستورات نصب موفق می‌شود.

## هشدار امنیتی

`run_shell` امکان اجرای دستور سیستم دارد. برای محیط production:
- sandbox اجباری کنید
- allowlist فرمان‌ها تعریف کنید
- محدودیت مسیر فایل اعمال کنید


## راهنمای خیلی سریع

برای راه‌اندازی قدم‌به‌قدم، فایل `QUICKSTART_FA.md` را ببینید.
