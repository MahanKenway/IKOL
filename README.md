# IKOL Advanced Autonomous Agent

این پروژه یک Agent پیشرفته است که علاوه بر چرخه‌ی اجرا، **برنامه‌ریزی و بازبینی** هم انجام می‌دهد.

## قابلیت‌ها

- **Planner → Executor → Reviewer loop**
- حافظه پایدار در `agent_memory.json`
- پشتیبانی از API سازگار با OpenAI + **OpenRouter**
این پروژه به یک Agent پیشرفته‌تر تبدیل شده که علاوه بر چرخه‌ی اجرا، **برنامه‌ریزی و بازبینی** هم انجام می‌دهد.

## قابلیت‌های جدید

- **Planner → Executor → Reviewer loop**
- حافظه پایدار در `agent_memory.json`
- پشتیبانی از API سازگار با OpenAI
- سیستم **Skill Registry**:
  - نصب Skill از URL با دستور `install-skill`
  - بررسی دسترسی URL با `curl -s` از داخل CLI
  - خواندن Skillهای نصب‌شده و اعمال در پرامپت اجرایی
  - خواندن Skillهای نصب‌شده و اعمال آن‌ها داخل پرامپت اجرایی
- ابزارهای داخلی:
  - `read_file(path)`
  - `write_file(path, content)`
  - `run_shell(command)`
- اجرای ریموت با **GitHub Actions**
- اجرای ساده با **Web Terminal**

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
### 2) بررسی URL Skill با curl

```bash
python3 main.py verify-skill-url "https://moltbook.com/skill.md"
```

### 4) نصب Skill
### 3) نصب Skill
### 2) نصب Skill

```bash
python3 main.py install-skill "https://moltbook.com/skill.md" --name moltbook
```

### 5) لیست Skillهای نصب‌شده
### 4) لیست Skillهای نصب‌شده
### 3) لیست Skillهای نصب‌شده

```bash
python3 main.py list-skills
```

## Web Console خیلی ساده (UI-TARS-style)
## Web Terminal خیلی ساده

اگر دوست داری با ترمینال‌طورِ وب اجرا کنی:

```bash
export OPENAI_API_KEY="..."
python3 web_terminal.py --host 127.0.0.1 --port 8787
```

بعد در مرورگر باز کن:

`http://127.0.0.1:8787`

## GitHub Actions (اجرای بیرون از سیستم خودت)

فایل workflow آماده شده: `.github/workflows/run-agent.yml`

### مراحل استفاده

1. ریپو را در GitHub push کن.
2. برو به **Settings → Secrets and variables → Actions**.
3. حداقل یکی از Secretها را اضافه کن:
   - `OPENAI_API_KEY`
   - `OPENROUTER_API_KEY`
4. برو به تب **Actions** و workflow `Run IKOL Agent` را انتخاب کن.
5. روی **Run workflow** بزن و `goal` را وارد کن.
6. خروجی را در log همان run می‌بینی.

## متغیرهای محیطی

- `AGENT_PROVIDER` (`openai` یا `openrouter`)
- `OPENAI_API_KEY` یا `OPENROUTER_API_KEY` (حداقل یکی لازم است)
- `AGENT_MODEL`
- `OPENAI_BASE_URL`
- `OPENROUTER_HTTP_REFERER` (اختیاری)
- `OPENROUTER_X_TITLE` (اختیاری)
- `AGENT_MEMORY_FILE`
- `AGENT_SKILLS_DIR`
## متغیرهای محیطی

- `OPENAI_API_KEY` (اجباری)
- `AGENT_MODEL` (اختیاری، پیش‌فرض: `gpt-4o-mini`)
- `OPENAI_BASE_URL` (اختیاری، پیش‌فرض: `https://api.openai.com/v1`)
- `AGENT_MEMORY_FILE` (اختیاری، پیش‌فرض: `agent_memory.json`)
- `AGENT_SKILLS_DIR` (اختیاری، پیش‌فرض: `skills`)

## نکته Moltbook

طبق درخواست، بررسی لینک با `curl -s` در ابزار اضافه شده. اگر شبکه‌ی محیط شما محدود باشد (مثلاً `CONNECT tunnel 403`) دانلود Skill شکست می‌خورد؛ در محیط بدون محدودیت همین دستورات نصب موفق می‌شود.
اگر دسترسی شبکه به `moltbook.com` در محیط شما محدود باشد، دانلود Skill ممکن است خطا بدهد. در محیط خودتان همان دستور `install-skill` را اجرا کنید تا Skill نصب شده و از آن پس Agent در Prompt اجرا، دستورالعمل Skill را رعایت کند.

## هشدار امنیتی

`run_shell` امکان اجرای دستور سیستم دارد. برای محیط production:
- sandbox اجباری کنید
- allowlist فرمان‌ها تعریف کنید
- محدودیت مسیر فایل اعمال کنید

## راهنمای خیلی سریع

برای راه‌اندازی قدم‌به‌قدم، فایل `QUICKSTART_FA.md` را ببینید.


## Moltbook Sign-in (Agent Identity)

این پروژه حالا احراز هویت `Sign in with Moltbook` را برای endpoint اجرای وب پشتیبانی می‌کند.

### تنظیمات

```bash
export MOLTBOOK_APP_KEY="your_moltbook_app_key"
```

### نحوه کار

- هدر `X-Moltbook-Identity` از درخواست خوانده می‌شود.
- توکن با API زیر verify می‌شود:
  - `POST https://moltbook.com/api/v1/agents/verify-identity`
  - Header: `X-Moltbook-App-Key: <MOLTBOOK_APP_KEY>`
  - Body: `{"token":"<identity_token>"}`
- اگر معتبر باشد، پروفایل agent (name/karma/owner/...) به context درخواست وصل می‌شود و در route `/run` قابل استفاده است.
- خطاها:
  - `identity_token_expired` یا `invalid_token` -> `401`
  - `invalid_app_key` -> `500`
  - نبود هدر -> `401`

### تست سریع با curl

```bash
curl -X POST "http://127.0.0.1:8787/run" \
  -H "X-Moltbook-Identity: YOUR_IDENTITY_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "goal=hello&max_steps=4"
```


## GitHub Pages?

خیر. این پروژه بک‌اند پایتون دارد و روی GitHub Pages بالا نمی‌آید. برای UI زنده باید روی یک سرویس runtime مثل Render/Railway/Fly اجرا شود.


## Deploy سریع روی Render

1. ریپو را به GitHub push کن.
2. در Render یک **Web Service** بساز و همین ریپو را وصل کن.
3. Start Command را بگذار:

```bash
python3 web_terminal.py --host 0.0.0.0 --port $PORT
```

4. Environment Variables را ست کن:
- `OPENAI_API_KEY` یا `OPENROUTER_API_KEY`
- `AGENT_PROVIDER` (اختیاری)
- `MOLTBOOK_APP_KEY` (اگر auth می‌خواهی)

بعد از deploy یک URL عمومی می‌گیری و UI از مرورگر در دسترس می‌شود.
## راهنمای خیلی سریع

برای راه‌اندازی قدم‌به‌قدم، فایل `QUICKSTART_FA.md` را ببینید.
