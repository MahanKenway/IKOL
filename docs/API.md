# Ikol Bot - API Reference

## Table of Contents

- [Bot Commands](#bot-commands)
- [AI Chat API](#ai-chat-api)
- [Music API](#music-api)
- [Finance API](#finance-api)
- [Space API](#space-api)
- [Gaming API](#gaming-api)
- [Utilities API](#utilities-api)

---

## Bot Commands

### General Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/start` | Start the bot | `/start` |
| `/help` | Show help message | `/help` |
| `/settings` | Open settings | `/settings` |
| `/stats` | Show bot statistics | `/stats` |

### AI Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/ai` | Start AI chat | `/ai <message>` |
| `/model` | Change AI model | `/model` |
| `/clear` | Clear conversation | `/clear` |

### Download Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/download` | Download media | `/download <url>` |
| (direct URL) | Auto-detect and download | Just send a URL |

### Music Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/music` | Search songs | `/music <query>` |
| `/artist` | Artist information | `/artist <name>` |
| `/album` | Album information | `/album <name>` |

### Finance Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/currency` | Exchange rates | `/currency` |
| `/gold` | Gold prices | `/gold` |
| `/crypto` | Cryptocurrency | `/crypto <coin>` |

### Space Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/apod` | Astronomy Picture of the Day | `/apod` |
| `/spacex` | Latest SpaceX launch | `/spacex` |
| `/mars` | Mars rover photos | `/mars` |

### Gaming Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/freegames` | Free games on Epic Store | `/freegames` |
| `/games` | Gaming hub | `/games` |

### Fun Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/today` | Today's special days | `/today` |
| `/randomfact` | Random fun fact | `/randomfact` |
| `/quote` | Inspirational quote | `/quote` |

### Utility Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/weather` | Weather forecast | `/weather <city>` |
| `/qr` | Generate QR code | `/qr <text>` |
| `/shorten` | Shorten URL | `/shorten <url>` |
| `/password` | Generate password | `/password [length]` |
| `/translate` | Translate text | `/translate <text>` |
| `/wiki` | Wikipedia search | `/wiki <query>` |

---

## AI Chat API

### Endpoints

#### Send Message
```typescript
POST /ai
Body: { message: string }
Response: { response: string, provider: string, model: string }
```

#### Change Model
```typescript
POST /ai/model
Body: { provider: string, model?: string }
Response: { success: boolean, provider: string, model: string }
```

#### Clear History
```typescript
POST /ai/clear
Response: { success: boolean }
```

### Providers

| Provider | Models | Free Tier |
|----------|--------|-----------|
| Gemini | gemini-1.5-flash, gemini-1.5-pro | Yes |
| OpenAI | gpt-3.5-turbo, gpt-4 | Limited |
| Claude | claude-3-haiku, claude-3-sonnet | Limited |
| OpenRouter | Multiple models | Varies |

---

## Music API

### Search

```typescript
GET /music/search?q={query}&limit={limit}
Response: {
  results: [{
    id: number,
    title: string,
    artist: string,
    album: string,
    duration: number,
    previewUrl: string
  }]
}
```

### Artist Info

```typescript
GET /music/artist/{id}
Response: {
  id: number,
  name: string,
  fans: number,
  albums: number,
  picture: string
}
```

### Album Info

```typescript
GET /music/album/{id}
Response: {
  id: number,
  title: string,
  artist: string,
  releaseDate: string,
  tracks: Track[]
}
```

---

## Finance API

### Exchange Rates

```typescript
GET /finance/currency?from={from}&to={to}
Response: {
  base: string,
  rates: { [currency: string]: number },
  timestamp: string
}
```

### Gold Prices

```typescript
GET /finance/gold
Response: {
  price: number,
  change: number,
  changePercent: number,
  timestamp: string
}
```

### Cryptocurrency

```typescript
GET /finance/crypto/{coin}
Response: {
  id: string,
  name: string,
  price: number,
  change24h: number
}
```

---

## Space API

### Astronomy Picture of the Day

```typescript
GET /space/apod?date={date}
Response: {
  date: string,
  title: string,
  explanation: string,
  url: string,
  mediaType: 'image' | 'video'
}
```

### SpaceX Launches

```typescript
GET /space/spacex/latest
Response: {
  id: string,
  name: string,
  date: string,
  success: boolean,
  details: string
}
```

### Mars Rover Photos

```typescript
GET /space/mars?sol={sol}&camera={camera}
Response: {
  photos: [{
    id: number,
    imgSrc: string,
    earthDate: string,
    camera: string
  }]
}
```

---

## Gaming API

### Free Games

```typescript
GET /games/free
Response: {
  games: [{
    id: string,
    title: string,
    description: string,
    endDate: string,
    storeUrl: string
  }]
}
```

---

## Utilities API

### Weather

```typescript
GET /utils/weather/{city}
Response: {
  city: string,
  temperature: number,
  humidity: number,
  condition: string
}
```

### QR Code

```typescript
GET /utils/qr?text={text}
Response: Image URL
```

### URL Shortener

```typescript
GET /utils/shorten?url={url}
Response: { shortUrl: string }
```

---

## Error Responses

All APIs return errors in the format:

```typescript
{
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Invalid request parameters |
| `UNAUTHORIZED` | Missing or invalid API key |
| `RATE_LIMITED` | Too many requests |
| `NOT_FOUND` | Resource not found |
| `SERVER_ERROR` | Internal server error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Global | 30 requests | 1 minute |
| AI Chat | 10 requests | 1 minute |
| Downloads | 5 requests | 1 minute |
| Music Search | 20 requests | 1 minute |
| Finance | 30 requests | 1 minute |

---

## Webhooks

### Telegram Webhook

```typescript
POST https://<worker>.workers.dev/
Content-Type: application/json
Body: Telegram Update object
```

### Webhook Verification

```typescript
X-Telegram-Bot-Api-Secret-Token: <secret>
```
