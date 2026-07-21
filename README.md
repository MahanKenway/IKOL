# Ikol (ایکول) - Intelligent Telegram AI Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![grammY](https://img.shields.io/badge/grammY-1.21-green.svg)](https://grammy.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)

Ikol is a powerful, modular Telegram bot that combines AI chat, media downloads, music discovery, financial data, and more into a single intelligent assistant.

## Features

### Core Features
- **AI Chat** - Multi-provider AI chatbot (OpenAI, Gemini, Claude, OpenRouter)
- **Media Downloader** - Download from YouTube, Instagram, TikTok, Twitter, Reddit, and more
- **Music Assistant** - Search songs, artists, albums with Deezer integration
- **Finance Module** - Exchange rates, gold prices, cryptocurrency tracking
- **Space Module** - NASA APOD, SpaceX launches, Mars rover photos
- **Gaming Hub** - Free games tracker, deals, new releases
- **Fun Calendar** - International days, fun holidays, random facts
- **Utilities** - Weather, QR codes, URL shortener, password generator, translation

### Technical Features
- **Modular Architecture** - Easy to add new features
- **Multi-Language Support** - English, Persian (Farsi), Arabic
- **Rate Limiting** - Anti-abuse protection
- **Caching** - Smart caching with Cloudflare KV
- **Database** - Persistent storage with Cloudflare D1
- **Logging** - Comprehensive logging system

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: grammY (Telegram Bot API)
- **Language**: TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **Storage**: Cloudflare R2 (optional)

## Project Structure

```
ikol-bot/
├── src/
│   ├── bot/              # Bot core and middleware
│   │   ├── commands/     # Command handlers
│   │   ├── middleware/   # Middleware functions
│   │   └── index.ts      # Bot initialization
│   ├── modules/          # Feature modules
│   │   ├── ai/          # AI chat system
│   │   ├── downloader/  # Media downloader
│   │   ├── music/       # Music search
│   │   ├── finance/     # Financial data
│   │   ├── space/       # Space information
│   │   ├── games/       # Gaming updates
│   │   ├── fun-calendar/# Fun days and events
│   │   └── utilities/   # Utility commands
│   ├── services/         # Core services
│   │   ├── api/         # API client
│   │   ├── cache/       # Cache service
│   │   ├── database/    # Database service
│   │   └── logger/      # Logging service
│   ├── config/          # Configuration
│   ├── types/           # TypeScript types
│   └── utils/           # Utility functions
├── migrations/           # Database migrations
├── tests/               # Test files
└── docs/                # Documentation
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account (for deployment)
- Telegram Bot Token (from @BotFather)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ikol-bot.git
cd ikol-bot
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .dev.vars
# Edit .dev.vars with your API keys
```

4. Run database migrations:
```bash
npm run migrate:local
```

5. Start development server:
```bash
npm run dev
```

### Deployment

1. Create a Cloudflare Worker:
```bash
npx wrangler create ikol-bot
```

2. Set up D1 database:
```bash
npx wrangler d1 create ikol-db
```

3. Update `wrangler.toml` with your database ID

4. Set secrets:
```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put GEMINI_API_KEY
# Add other secrets as needed
```

5. Run migrations:
```bash
npm run migrate
```

6. Deploy:
```bash
npm run deploy
```

7. Set webhook:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<your-worker>.workers.dev/"}'
```

## Commands

### General
- `/start` - Start the bot
- `/help` - Show help
- `/settings` - User settings
- `/stats` - Bot statistics

### AI Chat
- `/ai <message>` - Chat with AI
- `/model` - Change AI model
- `/clear` - Clear conversation history

### Downloads
- `/download <url>` - Download media
- Or just send a URL!

### Music
- `/music <query>` - Search songs
- `/artist <name>` - Artist info
- `/album <name>` - Album info

### Finance
- `/currency` - Exchange rates
- `/gold` - Gold prices
- `/crypto <coin>` - Cryptocurrency prices

### Space
- `/apod` - Astronomy Picture of the Day
- `/spacex` - Latest SpaceX launch
- `/mars` - Mars rover photos

### Gaming
- `/freegames` - Free games on Epic Store
- `/games` - Gaming hub

### Fun
- `/today` - Today's special days
- `/randomfact` - Random fun fact
- `/quote` - Inspirational quote

### Utilities
- `/weather <city>` - Weather forecast
- `/qr <text>` - Generate QR code
- `/shorten <url>` - Shorten URL
- `/password [length]` - Generate password
- `/translate <text>` - Translate text
- `/wiki <query>` - Wikipedia search

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

### Feature Flags

Disable features by setting environment variables:
```
ENABLE_AI=false
ENABLE_DOWNLOADER=false
```

## API Keys

### Required
- **BOT_TOKEN** - Get from [@BotFather](https://t.me/BotFather)
- **At least one AI key** (GEMINI_API_KEY recommended for free tier)

### Optional
- **NASA_API_KEY** - Get from [api.nasa.gov](https://api.nasa.gov/)
- **OPENAI_API_KEY** - For GPT models
- **ANTHROPIC_API_KEY** - For Claude models
- **OPENROUTER_API_KEY** - For multiple models

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [grammY](https://grammy.dev/) - Telegram Bot API framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless platform
- [Deezer API](https://developers.deezer.com/) - Music data
- [NASA APIs](https://api.nasa.gov/) - Space data
- [Epic Games Store](https://www.epicgames.com/) - Gaming data

## Support

- Create an [Issue](https://github.com/yourusername/ikol-bot/issues)
- Join our Telegram channel (coming soon)

---

Made with ❤️ by the Ikol Team
