# IKOL

**Intelligent Knowledge & Operations Layer** - A next-generation AI-powered Telegram and Bale assistant.

## Features

### Core
- **Multi-platform support** - Works on Telegram and Bale Messenger
- **Autonomous AI agent** - Planner-executor-reviewer loop
- **Persistent memory** - Remembers past interactions
- **Skill system** - Extensible via markdown plugins

### Multi-Language Support
- **Persian (Farsi)** - Full RTL support with Jalali calendar
- **English** - Default language
- **Auto-detection** - Detects user language automatically
- **Persian numerals** - Displays numbers in Eastern Arabic numerals

### Utility Commands
- `/time` - Current time with Jalali date
- `/date` - Full Jalali calendar date
- `/calc` - Mathematical calculator
- `/translate` - Text translation
- `/poetry` - Random Persian poetry
- `/quote` - Inspirational quotes
- `/ping` - Connection test

### AI Agent
- `/run <goal>` - Execute tasks autonomously
- `/skills` - List installed skills
- `/memory` - View agent memory
- `/clear` - Clear memory

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/MahanKenway/IKOL.git
   cd IKOL
   ```

2. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

3. Run the multi-platform bot:
   ```bash
   python -m platforms.runner
   ```

## Configuration

### Environment Variables

```env
# Messaging Platforms (at least one required)
TELEGRAM_BOT_TOKEN=your_telegram_token
BALE_BOT_TOKEN=your_bale_token

# AI Provider
AGENT_PROVIDER=openai
OPENAI_API_KEY=your_openai_key

# Optional
OPENROUTER_API_KEY=your_openrouter_key
AGENT_MODEL=gpt-4o-mini
```

### Getting Tokens

**Telegram:**
1. Open @BotFather in Telegram
2. Send `/newbot`
3. Copy the token

**Bale:**
1. Open @botfather in Bale (bale.ai)
2. Send `/newbot`
3. Copy the token

## Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Welcome message | `/start` |
| `/help` | Show all commands | `/help` |
| `/run <goal>` | Run AI agent | `/run Write a Python script` |
| `/time` | Current time | `/time` |
| `/date` | Jalali date | `/date` |
| `/calc <expr>` | Calculator | `/calc 2 + 2` |
| `/translate <text>` | Translate | `/translate Hello` |
| `/poetry` | Persian poetry | `/poetry` |
| `/quote` | Inspirational quote | `/quote` |
| `/lang` | Change language | `/lang` |
| `/status` | System status | `/status` |
| `/skills` | List skills | `/skills` |
| `/memory` | View memory | `/memory` |
| `/clear` | Clear memory | `/clear` |
| `/ping` | Test connection | `/ping` |

## Architecture

```
IKOL/
├── main.py                 # CLI entry point
├── web_terminal.py         # Web UI
├── platforms/
│   ├── __init__.py         # Package exports
│   ├── base.py             # Abstract platform interface
│   ├── telegram.py         # Telegram adapter
│   ├── bale.py             # Bale adapter
│   ├── core.py             # Shared bot logic
│   ├── i18n.py             # Internationalization
│   └── runner.py           # Multi-platform runner
├── skills/                 # Plugin directory
├── .env.example            # Environment template
└── requirements.txt        # Dependencies
```

## Persian Language Support

IKOL fully supports Persian (Farsi) users:

- **Jalali Calendar** - All dates in Solar Hijri calendar
- **Persian Numerals** - ۰۱۲۳۴۵۶۷۸۹
- **RTL Text** - Right-to-left rendering
- **Persian Poetry** - Classical poetry from Hafez, Saadi, Rumi
- **Auto-detection** - Automatically detects Persian input

## Platform Support

| Platform | Status | API |
|----------|--------|-----|
| Telegram | Active | api.telegram.org |
| Bale | Active | tapi.bale.ai |

## License

MIT
