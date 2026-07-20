# IKOL

**Intelligent Knowledge & Operations Layer** - An autonomous AI agent with multi-platform messaging support.

## Features

- **Multi-platform support** - Works on Telegram and Bale Messenger
- Autonomous AI agent with planner-executor-reviewer loop
- Persistent memory system
- Skill plugin system
- Web terminal interface
- Moltbook identity verification
- OpenAI/OpenRouter compatible LLM support

## Supported Platforms

| Platform | Status | API Base |
|----------|--------|----------|
| Telegram | Supported | `api.telegram.org` |
| Bale | Supported | `tapi.bale.ai` |

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/MahanKenway/IKOL.git
   cd IKOL
   ```

2. Copy `.env.example` to `.env` and add your API keys:
   ```bash
   cp .env.example .env
   ```

3. Run the multi-platform bot:
   ```bash
   python -m platforms.runner
   ```

4. Or run a single platform:
   ```bash
   # Telegram only
   python platforms/telegram_runner.py

   # Bale only
   python platforms/bale_runner.py
   ```

5. Or use the CLI:
   ```bash
   python main.py run "Your task here"
   ```

6. Or start the web terminal:
   ```bash
   python web_terminal.py
   ```

## Configuration

Create a `.env` file with your credentials:

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
3. Follow the instructions
4. Copy the token

**Bale:**
1. Open @botfather in Bale (bale.ai)
2. Send `/newbot`
3. Follow the instructions
4. Copy the token

## CLI Commands

```bash
# Run agent against a goal
python main.py run "Create a script to analyze logs" --max-steps 12

# Install a skill from URL
python main.py install-skill https://example.com/skill.md --name my-skill

# List installed skills
python main.py list-skills

# Verify a skill URL
python main.py verify-skill-url https://example.com/skill.md
```

## Bot Commands

When using Telegram or Bale, these commands are available:

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show help |
| `/run <goal>` | Run agent on a goal |
| `/status` | Show current status |
| `/skills` | List installed skills |
| `/memory` | View agent memory |
| `/clear` | Clear memory |

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
│   └── runner.py           # Multi-platform runner
├── skills/                 # Plugin directory (auto-created)
├── .env.example            # Environment template
└── requirements.txt        # Dependencies
```

### Design Principles

- **Platform abstraction** - All platforms implement the same interface
- **Shared core** - Business logic is platform-independent
- **Adapter pattern** - Platform-specific code only in adapters
- **Dependency injection** - Platforms are injected into the core
- **Graceful degradation** - Missing tokens disable that platform only

## Deployment

### Local Development

```bash
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your tokens
python -m platforms.runner
```

### Production

For production deployment, consider:

1. Using a process manager (systemd, supervisor)
2. Setting up webhook instead of polling
3. Adding proper logging
4. Configuring error monitoring

## License

MIT
