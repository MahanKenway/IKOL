# IKOL

**Intelligent Knowledge & Operations Layer** - An autonomous AI agent with a web terminal interface.

## Features

- Autonomous AI agent with planner-executor-reviewer loop
- Persistent memory system
- Skill plugin system
- Web terminal interface
- Moltbook identity verification
- OpenAI/OpenRouter compatible LLM support

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

3. Run the agent:
   ```bash
   python main.py run "Your task here"
   ```

4. Or start the web terminal:
   ```bash
   python web_terminal.py
   ```

## Configuration

Create a `.env` file with:

```env
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key
AGENT_PROVIDER=openrouter
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
MOLTBOOK_APP_KEY=your_moltbook_app_key
```

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

## Web Terminal

Start the web terminal:
```bash
python web_terminal.py --host 127.0.0.1 --port 8787
```

Then open http://127.0.0.1:8787 in your browser.

## Architecture

- `main.py` - Core agent logic (planner, executor, reviewer, skills, memory)
- `web_terminal.py` - Web-based terminal interface with Moltbook auth
- `skills/` - Plugin directory (auto-created)

## License

MIT
