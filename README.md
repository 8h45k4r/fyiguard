# FYI Guard | AI Prompt Guardian

Prevent sensitive data leaks to ChatGPT, Claude, and other AI platforms. FYI Guard is a Chrome extension that scans your prompts in real-time and blocks sensitive information before it reaches AI services.

## Features

- **Real-time Detection**: Scans prompts before submission to AI platforms
- **Multi-category Protection**: PII, financial data, credentials, medical info, proprietary content
- **Platform Support**: ChatGPT, Claude, Gemini, and more
- **Configurable Policies**: Custom sensitivity levels and category toggles
- **Privacy-first**: All processing happens locally in your browser
- **Visual Alerts**: Warning overlays with risk indicators

## Tech Stack

- TypeScript, React (popup UI)
- Chrome Extension Manifest V3
- Webpack build system
- Regex-based pattern detection engine
- Node.js / Express (backend API)
- Prisma ORM with PostgreSQL
- Docker containerization
- GitHub Actions CI/CD

## Getting Started

## Project Structure

```
fyiguard/
  .github/workflows/ci.yml    # CI/CD pipeline
  extension/                   # Chrome extension
    manifest.json
    tsconfig.json
    webpack.config.js
    public/icons/
    src/
      background/service-worker.ts
      content/
        platform-adapters/     # ChatGPT, Claude, Gemini, Copilot, Perplexity
        detector.ts
        injector.ts
        content.css
      popup/
        App.tsx
        popup.html
      options/
        Options.tsx
        options.html
      shared/
        types.ts
        patterns.ts
        utils.ts
        theme.ts
        config.ts
        defaultPolicy.ts
  backend/                     # Express API server
    prisma/schema.prisma
    src/
      middleware/               # auth, errorHandler, guard, logger, rateLimiter
      routes/                   # guard, health, auth, events, settings, policies, analytics, scan
      services/                 # detectionService, guardService
      lib/                      # prisma client, validation
      __tests__/                # Jest test suites
      server.ts
    Dockerfile
    docker-compose.yml
  package.json
  README.md
```


### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
cd extension
npm install
```

### Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Load Extension

1. Run `npm run build` in the `extension` directory
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `extension/dist` folder

## Detection Categories

| Category | Examples |
|---|---|
| PII | SSN, email addresses, phone numbers |
| Financial | Credit card numbers, bank accounts |
| Credentials | API keys, passwords, private keys |
| Medical | Health records, patient IDs |
| Proprietary | Internal project names, confidential markers |

## Configuration

Use the popup UI to:
- Toggle protection on/off
- Enable/disable specific detection categories
- Set sensitivity level (Low / Medium / High)
- Enable auto-block for critical data
- Manage platform whitelist

## Brand

- **Primary Color**: #368F4D
- **Font**: Outfit (Google Fonts)
- **Logo**: [CertifYI Logo](https://certifyi.ai/wp-content/uploads/2025/01/logoblue.svg)

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Architecture Overview](docs/ARCHITECTURE.md) — system design, data flow, component diagram
- [API Reference](docs/API.md) — backend REST endpoints, request/response schemas
- [Extension Guide](docs/EXTENSION.md) — Chrome extension internals, platform adapters, detection engine
- [Deployment Guide](docs/DEPLOYMENT.md) — Docker, CI/CD, environment setup, Chrome Web Store publishing
- [Contributing Guide](docs/CONTRIBUTING.md) — dev setup, coding standards, commit conventions, PR process


## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions welcome! Please open an issue first to discuss proposed changes.

---

Built by [CertifYI.ai](https://certifyi.ai)