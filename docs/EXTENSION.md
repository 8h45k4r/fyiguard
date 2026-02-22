# FYI Guard — Extension Guide

> Chrome Extension Manifest V3 architecture for real-time AI prompt scanning.

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Layout](#directory-layout)
3. [Service Worker](#service-worker)
4. [Content Scripts](#content-scripts)
5. [Platform Adapters](#platform-adapters)
6. [Detection Engine](#detection-engine)
7. [Popup UI](#popup-ui)
8. [Options Page](#options-page)
9. [Shared Modules](#shared-modules)
10. [Build & Load](#build--load)

---

## Overview

The extension intercepts text typed into supported AI chat platforms, scans it against configurable regex patterns, and either warns or blocks the submission when sensitive data is detected.

Key design principles:

- **Privacy-first** — all scanning runs locally in the browser; no prompt text leaves the device unless the user opts into cloud audit.
- **Fail-open** — if the content script throws, the user can still submit their prompt (no silent blocking).
- **Platform-agnostic core** — detection logic lives in `shared/`, consumed by both the extension and the backend.

---

## Directory Layout

```
extension/
  manifest.json          # MV3 manifest
  webpack.config.js      # Bundles TS to JS
  tsconfig.json
  package.json
  public/
    icons/               # 16/48/128 SVG icons
    popup.html
    options.html
  src/
    background/
      service-worker.ts
    content/
      injector.ts        # Entry point, fail-safe wrapper
      detector.ts        # PromptDetector class
      content.css        # Warning overlay styles
      platform-adapters/
        base.ts          # Abstract PlatformAdapter
        chatgpt.ts
        claude.ts
        gemini.ts
        copilot.ts
        perplexity.ts
    popup/
      App.tsx            # React popup (360px wide)
    options/
      Options.tsx        # Full-page settings UI
    shared/
      types.ts           # Shared TypeScript interfaces
      patterns.ts        # Regex pattern definitions
      utils.ts           # Helpers (storage, messaging)
      config.ts          # Runtime config constants
      defaultPolicy.ts   # Default platform policy
      theme.ts           # Brand colors and fonts
```

---

## Service Worker

**File:** `src/background/service-worker.ts`

The MV3 service worker handles:

| Responsibility | Detail |
|---|---|
| Message routing | Listens for `chrome.runtime.onMessage` from content scripts and popup |
| Badge updates | Sets icon badge text/color based on scan results |
| Storage sync | Reads/writes `chrome.storage.local` for settings |
| Alarm scheduling | Periodic sync of audit events to backend (if enabled) |
| Install handler | `chrome.runtime.onInstalled` sets default settings |

All message handlers return `true` for async `sendResponse` support.

---

## Content Scripts

### Injector (`content/injector.ts`)

Entry point declared in `manifest.json` via `content_scripts`. Runs at `document_idle` on matched platforms.

Responsibilities:

1. Detect current platform from `window.location.hostname`
2. Instantiate the correct `PlatformAdapter`
3. Attach `MutationObserver` + input event listeners
4. On each input change, run `PromptDetector.scanText()`
5. If detections found, render warning overlay via `content.css`
6. If `autoBlock` enabled and risk is CRITICAL, prevent submission

Fail-safe design: the entire injection logic is wrapped in try/catch. If anything throws, the user can still submit (fail-open).

### Warning Overlay

When sensitive data is detected, a floating overlay appears near the input area showing:

- Risk level badge (CRITICAL / HIGH / MEDIUM / LOW)
- Category of detected data (PII, Credentials, etc.)
- Sanitized preview of matched text
- Dismiss and Block action buttons

---

## Platform Adapters

Each adapter extends `PlatformAdapter` (in `base.ts`) and implements platform-specific DOM selectors for input elements and submit buttons.

### Supported Platforms

| Adapter | Hostname(s) | Input Selector Strategy |
|---|---|---|
| ChatGPT | `chatgpt.com`, `chat.openai.com` | `#prompt-textarea` or `textarea` |
| Claude | `claude.ai` | `div[contenteditable]` |
| Gemini | `gemini.google.com` | `rich-textarea` / `textarea` |
| Copilot | `copilot.microsoft.com` | `textarea`, `#searchbox` |
| Perplexity | `perplexity.ai`, `www.perplexity.ai` | `textarea` |
| Poe | `poe.com` | `textarea` |

### Adding a New Platform

1. Create `platform-adapters/<name>.ts` extending `PlatformAdapter`
2. Add hostname to `manifest.json` content_scripts matches + host_permissions
3. Add hostname to `defaultPolicy.ts` platforms array
4. Register adapter in injector platform detection switch

---

## Detection Engine

**File:** `content/detector.ts` — class `PromptDetector`

### Scan Flow

1. User types text into AI platform input
2. Input event fires, text extracted via platform adapter
3. `scanText(text, settings)` iterates all `PatternDefinition` entries
4. Skips patterns whose category is disabled in user settings
5. Runs regex against text, collects `Detection` objects
6. Returns `ScanResult` with blocked flag, warnings, risk score, and processing time

### Pattern Categories

Defined in `shared/patterns.ts`:

| Category Group | Example Patterns |
|---|---|
| PII | SSN, email, phone, passport, driver license, DOB |
| Financial | Credit card (Visa/MC/Amex/Discover), bank account + routing, IBAN, SWIFT |
| Credentials | API keys (AWS/GCP/GitHub/Stripe), passwords, private keys, JWTs |
| Medical | Patient IDs, medical record numbers, health-related terms |
| Proprietary | Internal project names, confidential markers, NDA references |

### Confidence Scoring

Base confidence by risk level:

| Risk Level | Base Score |
|---|---|
| CRITICAL | 0.95 |
| HIGH | 0.80 |
| MEDIUM | 0.60 |
| LOW | 0.40 |

Boosted by +0.03 if matched string length > 20 characters.

---

## Popup UI

**File:** `src/popup/App.tsx`

React-based popup rendered in a 360 x 500 px window.

### Sections

| Section | Description |
|---|---|
| Header | Logo, FYI Guard title, version badge |
| Status Panel | Active/paused toggle, current platform indicator |
| Stats Panel | Scans today, threats blocked, top category |
| Settings Panel | Sensitivity selector (Low/Medium/High), auto-block toggle, category checkboxes |
| Recent Activity | Last 5 scan events with timestamps |

Communicates with service worker via `chrome.runtime.sendMessage`. Settings persisted in `chrome.storage.local`.

---

## Options Page

**File:** `src/options/Options.tsx`

Full-page settings accessible via `chrome://extensions` > Options or right-click extension icon > Options.

### Tabs

| Tab | Contents |
|---|---|
| General | Master enable/disable, sensitivity level, auto-block toggle |
| Categories | Per-category enable/disable toggles (PII, Financial, Credentials, Medical, Proprietary) |
| Platforms | Per-platform enable/disable toggles for each supported AI site |
| Notifications | Browser notification toggle, email alerts toggle, sound alerts toggle |
| About | Version info, links to documentation, license |

---

## Shared Modules

### types.ts

Core TypeScript interfaces used across the extension:

- `Detection` — single pattern match result
- `ScanResult` — aggregate scan output
- `UserSettings` — user configuration shape
- `RiskLevel` — CRITICAL | HIGH | MEDIUM | LOW
- `CategoryGroup` — PII | FINANCIAL | CREDENTIALS | MEDICAL | PROPRIETARY
- `AuditEvent` — event logged for backend sync

### patterns.ts

Array of `PatternDefinition` objects containing name, category, regex source/flags, risk level, and description.

### config.ts

Runtime constants: `API_BASE_URL`, `SCAN_DEBOUNCE_MS` (300ms), `MAX_TEXT_LENGTH` (50000), `BADGE_COLORS` per risk level.

### defaultPolicy.ts

Default policy applied on fresh install: all categories enabled, sensitivity MEDIUM, auto-block false, all platforms enabled.

### theme.ts

Brand constants: primary color `#368F4D`, font family `Outfit` (Google Fonts), spacing tokens.

---

## Build & Load

### Development

```bash
cd extension
npm install
npm run dev      # webpack --watch
```

### Production

```bash
npm run build    # webpack --mode production
```

### Load in Chrome

1. Navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `extension/dist/` folder
5. Pin FYI Guard icon to toolbar

### Debugging

- **Popup**: Right-click extension icon > Inspect popup
- **Content script**: Open DevTools on any AI platform page, filter console for `[FYI Guard]`
- **Service worker**: `chrome://extensions` > Inspect views: service worker

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Persist user settings and scan history |
| `activeTab` | Access current tab for content injection |
| `alarms` | Schedule periodic backend sync |
| `notifications` | Show browser notifications for blocked prompts |
| Host permissions | Required for content script injection on AI platforms |
