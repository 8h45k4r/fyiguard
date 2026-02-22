
# FYI Guard - Chrome Web Store Listing

## Extension Metadata

| Field | Value |
|-------|-------|
| **Name** | FYI Guard - AI Prompt Security |
| **Short Description** | Prevent sensitive data leaks to ChatGPT, Claude & other AI tools in real-time |
| **Category** | Productivity |
| **Language** | English |
| **Version** | 1.0.0 |
| **Manifest Version** | 3 |

---

## Full Description (up to 132 words)

**FYI Guard** is your real-time AI prompt security guardian. It automatically scans text before you send it to ChatGPT, Claude, Gemini, Copilot, Perplexity, and Poe - blocking or warning you about sensitive data.

### What it detects:
- **PII** - Emails, phone numbers, SSNs, addresses
- **API Keys & Credentials** - OpenAI, AWS, Stripe, GitHub tokens
- **Financial Data** - Credit cards, bank accounts
- **Health & Legal** - Medical records, NDA content
- **Prompt Injection** - Jailbreak attempts

### Key features:
- Real-time detection in 8+ AI platforms
- Visual block/warn overlays
- Configurable sensitivity (Low/Medium/High)
- Freemium: 5 free scans/day, unlimited on Pro
- Enterprise org management & audit logs
- Privacy-first: local detection, no prompt storage

**Powered by Certifyi.ai** | [Privacy Policy](https://learn.certifyi.ai/fyi-guard/privacy-policy/)

---

## Short Description (132 chars max)

```
Real-time AI prompt guardian. Block PII, API keys & credentials before they reach ChatGPT, Claude, Gemini, and more.
```

---

## Required Screenshots (1280x800 or 640x400)

| Screenshot # | Description | File |
|-------------|-------------|------|
| 1 | Popup dashboard showing detected events | `docs/screenshots/screenshot-1-dashboard.png` |
| 2 | Block overlay on ChatGPT with API key warning | `docs/screenshots/screenshot-2-block-overlay.png` |
| 3 | Settings page with detection categories | `docs/screenshots/screenshot-3-settings.png` |
| 4 | Freemium upgrade CTA and daily limit banner | `docs/screenshots/screenshot-4-upgrade.png` |
| 5 | Organization management page | `docs/screenshots/screenshot-5-org.png` |

### Screenshot Creation Instructions

1. Load the built extension: `chrome://extensions` → Load unpacked → select `extension/dist/`
2. Open https://chatgpt.com and type a prompt with PII (e.g., `my email is test@example.com`)
3. Capture the overlay warning at 1280x800px
4. Open the extension popup and capture the dashboard
5. Navigate to extension options for settings screenshot

---

## Icon Requirements

| Size | File | Status |
|------|------|--------|
| 16x16 | `extension/public/icons/icon16.svg` | ✅ SVG (needs PNG export) |
| 48x48 | `extension/public/icons/icon48.svg` | ✅ SVG (needs PNG export) |
| 128x128 | `extension/public/icons/icon128.svg` | ✅ SVG (needs PNG export) |
| 440x280 | `docs/screenshots/promo-small.png` | ⚠️ Required for CWS |
| 920x680 | `docs/screenshots/promo-marquee.png` | Optional |

### Converting SVG Icons to PNG

```bash
# Install ImageMagick or use Inkscape
npx svgexport extension/public/icons/icon128.svg docs/screenshots/icon128.png 128:128
npx svgexport extension/public/icons/icon48.svg docs/screenshots/icon48.png 48:48
npx svgexport extension/public/icons/icon16.svg docs/screenshots/icon16.png 16:16
```

---

## Permissions Justification

| Permission | Justification |
|-----------|---------------|
| `storage` | Save user settings, scan counts, detection events locally |
| `activeTab` | Read the current tab to detect AI platform context |
| `alarms` | Schedule background event uploads (every 1 min) |
| `notifications` | Show browser notifications for critical detections |
| Host permissions | Inject content scripts into supported AI platforms only |

---

## Privacy Disclosures

- **Data collection**: User settings stored locally via `chrome.storage.local`
- **Remote transmission**: Detection events batched and sent to FYI Guard API (authenticated users only)
- **No prompt storage**: Raw prompt text is NEVER stored or transmitted
- **Privacy policy**: https://learn.certifyi.ai/fyi-guard/privacy-policy/

---

## Supported Platforms

- ChatGPT (chatgpt.com, chat.openai.com)
- Claude (claude.ai)
- Google Gemini (gemini.google.com)
- Microsoft Copilot (copilot.microsoft.com)
- Perplexity AI (perplexity.ai)
- Poe (poe.com)

---

## Submission Checklist

- [ ] Extension built: `npm run build`
- [ ] Extension zipped: `cd extension/dist && zip -r ../fyiguard.zip .`
- [ ] Icons exported as PNG (16, 48, 128)
- [ ] 5 screenshots at 1280x800
- [ ] Promo tile 440x280
- [ ] Privacy policy URL verified: https://learn.certifyi.ai/fyi-guard/privacy-policy/
- [ ] CWS Developer account: https://chrome.google.com/webstore/devconsole
- [ ] One-time registration fee paid ($5 USD)
- [ ] All metadata fields filled in Developer Console
- [ ] Submit for review