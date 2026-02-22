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

## Project Structure

```
extension/
  manifest.json
  tsconfig.json
  webpack.config.js
  package.json
  public/icons/
  src/
    background/service-worker.ts
    content/
      platform-adapters/chatgpt.ts
      detector.ts
      injector.ts
      content.css
    popup/
      App.tsx
      popup.html
    options/options.html
    shared/
      types.ts
      patterns.ts
      utils.ts
      theme.ts
      defaultPolicy.ts
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
cd extension
npm install
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

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions welcome! Please open an issue first to discuss proposed changes.

---

Built by [CertifYI.ai](https://certifyi.ai)