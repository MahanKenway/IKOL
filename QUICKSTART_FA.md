# راهنمای قدم‌به‌قدم اجرای IKOL Agent

این راهنما دقیقاً می‌گوید چه کارهایی انجام بدهی تا Agent بالا بیاید.

## 1) پیش‌نیازها

- Python 3.10+
- یک API Key برای مدل (OpenAI یا سرویس سازگار)

بررسی نسخه پایتون:

```bash
python3 --version
```

## 2) رفتن به پوشه پروژه

```bash
cd /workspace/IKOL
```

## 3) تنظیم متغیرهای محیطی

فایل نمونه را کپی کن:

```bash
cp .env.example .env
```

فایل `.env` را باز کن و حداقل این مقدار را پر کن:

```env
OPENAI_API_KEY=کلید_واقعی_تو
```

اگر provider سفارشی داری، این را هم عوض کن:

```env
OPENAI_BASE_URL=https://api.openai.com/v1
```

## 4) تست سالم بودن CLI

```bash
python3 -m py_compile main.py
python3 main.py --help
```

اگر help را دیدی، CLI درست بالا آمده.

## 5) اجرای Agent (اولین ران)

```bash
export OPENAI_API_KEY="..."
python3 main.py run "یک برنامه تحلیل لاگ طراحی کن" --max-steps 10
```

خروجی نهایی در ترمینال چاپ می‌شود و حافظه در `agent_memory.json` ذخیره می‌شود.

## 6) مدیریت Skillها

### لیست Skillهای نصب‌شده

```bash
python3 main.py list-skills
```

### بررسی URL Skill قبل از نصب

```bash
python3 main.py verify-skill-url "https://moltbook.com/skill.md"
```

### نصب Skill

```bash
python3 main.py install-skill "https://moltbook.com/skill.md" --name moltbook
```

## 7) اگر Moltbook خطای 403 داد چه کنم؟

در بعضی محیط‌ها (مثل پراکسی‌های محدود) `curl` یا `urllib` به `moltbook.com` نمی‌رسد و خطای `CONNECT tunnel 403` می‌بینی.

راه‌حل ساده:
1. روی سیستم خودت که دسترسی اینترنت کامل دارد فایل Skill را دانلود کن.
2. دستی داخل پروژه ذخیره کن:

```bash
mkdir -p skills/moltbook
# فایل skill.md را اینجا بگذار:
# skills/moltbook/SKILL.md
```

بعد دوباره `python3 main.py list-skills` بزن. اگر `moltbook` دیده شد، Agent آن را در Prompt اجرا استفاده می‌کند.

## 8) اجرای واقعی برای نتیجه بهتر

- برای تسک‌های پیچیده `--max-steps` را بالاتر ببر (مثلاً 15 تا 25)
- هدف را دقیق و قابل اندازه‌گیری بنویس
- بعد از هر اجرا `agent_memory.json` را بررسی کن تا روند تصمیم‌ها را ببینی

## 9) چک‌لیست سریع تو (کاری که باید انجام بدهی)

1. `cp .env.example .env`
2. مقدار `OPENAI_API_KEY` را وارد کن
3. `python3 main.py --help`
4. `python3 main.py run "..." --max-steps 10`
5. (اختیاری) Skill نصب کن یا دستی در `skills/<name>/SKILL.md` قرار بده

اگر بخواهی، قدم بعدی برایت یک **پیکربندی production-safe** هم می‌سازم (محدودکردن `run_shell` با allowlist + sandbox path).


## 10) اگر می‌خواهی با OpenRouter اجرا کنی

```bash
export AGENT_PROVIDER=openrouter
export OPENROUTER_API_KEY="..."
export AGENT_MODEL="openai/gpt-4o-mini"
python3 main.py run "یک agent برای تحلیل لاگ بساز" --max-steps 12
```

اختیاری (برای attribution):

```bash
export OPENROUTER_HTTP_REFERER="https://your-site.com"
export OPENROUTER_X_TITLE="IKOL Agent"
```


## 11) اجرای بیرون از ترمینال محلی (دو روش ساده)

### روش A: Web Terminal (ساده‌ترین حالت)

```bash
export OPENAI_API_KEY="..."
python3 web_terminal.py --host 127.0.0.1 --port 8787
```

بعد مرورگر را باز کن:

`http://127.0.0.1:8787`

یک فرم می‌بینی: goal را می‌نویسی، روی Run می‌زنی، جواب پایین صفحه چاپ می‌شود.

### روش B: GitHub Actions (روی سرور گیت‌هاب)

1. پروژه را push کن روی GitHub.
2. در Repo برو به: `Settings -> Secrets and variables -> Actions`
3. Secret اضافه کن: `OPENAI_API_KEY` (یا `OPENROUTER_API_KEY`)
4. برو تب `Actions` و workflow با نام `Run IKOL Agent` را اجرا کن.
5. `goal` را وارد کن و Run بزن.
6. خروجی داخل لاگ همان workflow چاپ می‌شود.


## 12) Sign in with Moltbook (برای وب)

1. کلید اپ را از داشبورد Moltbook بردار و ست کن:

```bash
export MOLTBOOK_APP_KEY="..."
```

2. وب ترمینال را بالا بیاور:

```bash
python3 web_terminal.py --host 127.0.0.1 --port 8787
```

3. درخواست `/run` را با هدر زیر بزن:

`X-Moltbook-Identity: <identity_token>`

4. سرور توکن را verify می‌کند و پروفایل agent را به context درخواست وصل می‌کند.
