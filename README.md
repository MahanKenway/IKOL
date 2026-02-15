# IKOL Advanced Autonomous Agent

این پروژه به یک Agent پیشرفته‌تر تبدیل شده که علاوه بر چرخه‌ی اجرا، **برنامه‌ریزی و بازبینی** هم انجام می‌دهد.

## قابلیت‌های جدید

- **Planner → Executor → Reviewer loop**
- حافظه پایدار در `agent_memory.json`
- پشتیبانی از API سازگار با OpenAI
- سیستم **Skill Registry**:
  - نصب Skill از URL با دستور `install-skill`
  - خواندن Skillهای نصب‌شده و اعمال آن‌ها داخل پرامپت اجرایی
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

### 2) نصب Skill

```bash
python3 main.py install-skill "https://moltbook.com/skill.md" --name moltbook
```

### 3) لیست Skillهای نصب‌شده

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

اگر دسترسی شبکه به `moltbook.com` در محیط شما محدود باشد، دانلود Skill ممکن است خطا بدهد. در محیط خودتان همان دستور `install-skill` را اجرا کنید تا Skill نصب شده و از آن پس Agent در Prompt اجرا، دستورالعمل Skill را رعایت کند.

## هشدار امنیتی

`run_shell` امکان اجرای دستور سیستم دارد. برای محیط production:
- sandbox اجباری کنید
- allowlist فرمان‌ها تعریف کنید
- محدودیت مسیر فایل اعمال کنید
