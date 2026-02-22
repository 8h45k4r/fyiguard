# FYI Guard — System Architecture

## Overview

FYI Guard is a Chrome Extension + Express backend system for real-time DLP (Data Loss Prevention) on AI platforms. It intercepts prompts before submission, scans them with regex-based pattern matching, and blocks or warns users about sensitive data.

## High-Level Architecture

```
+------------------+     +------------------+     +------------------+
|  AI Platform     |     |  Chrome Extension |     |  Backend API     |
|  (ChatGPT, etc.) |<--->|  Content Scripts  |<--->|  Express + Prisma|
|                  |     |  Service Worker   |     |  PostgreSQL      |
+------------------+     +------------------+     +------------------+
```

## Components

### 1. Content Scripts (`extension/src/content/`)

**Purpose**: Inject into AI platform pages, scan user input, intercept form submissions.

| File | Role |
|------|------|
| `injector.ts` | Entry point — detects platform, attaches observers, intercepts submit |
| `detector.ts` | Regex scanning engine — pattern matching with confidence scoring |
| `platform-adapters/` | Platform-specific DOM selectors (ChatGPT, Claude, Gemini, Generic) |
| `content.css` | Notification overlay styles injected into host pages |

**Data Flow**:
1. `injector.ts` loads on matched AI domains (`document_idle`)
2. Detects platform via hostname → selects adapter
3. Attaches `MutationObserver` on prompt input for real-time scanning
4. On submit intercept, runs full `detector.scanText()` scan
5. If blocked: prevents submission, shows overlay, reports to service worker
6. If warning: reports to service worker, allows submission

**Fail-Safe Design**:
- Retries up to 3 times with exponential backoff (1s, 2s, 4s) if prompt element not found
- `try/catch` on all `chrome.runtime.sendMessage` calls with fallback to `DEFAULT_SETTINGS`
- Scan errors fail-open (allow submission) to avoid breaking host pages

### 2. Service Worker (`extension/src/background/service-worker.ts`)

**Purpose**: Central message router, event queue, alarm-based sync, auth management.

**Message Types Handled**:
| Message | Handler | Async |
|---------|---------|-------|
| `LOGIN` | `handleLogin()` → `loginUser()` + `syncPolicies()` | Yes |
| `REGISTER` | `handleRegister()` → `registerUser()` | Yes |
| `LOGOUT` | `handleLogout()` → `clearAuthState()` | Yes |
| `CHECK_AUTH` | `handleCheckAuth()` → `getAuthState()` | Yes |
| `GET_SETTINGS` | `handleGetSettings()` → `chrome.storage.local` | Yes |
| `DETECTION_EVENT` | Queue event, update badge | No |
| `BEHAVIOR_EVENT` | Queue behavior event | No |
| `SESSION_START` | POST to `/behavior/session/start` | No |
| `SESSION_END` | POST to `/behavior/session/end` | No |
| `SEND_ALERT` | POST to `/alerts` | No |
| `SYNC_POLICIES` | `syncPolicies()` | No |
| `SETTINGS_UPDATED` | Write to `chrome.storage.local` | No |

**Alarms**:
- `upload-events`: Every 1 minute — flushes event queue to backend
- `sync-policies`: Every 15 minutes — syncs policies + settings from backend

**Event Queue**:
- Max 50 events buffered in memory
- On flush failure, events are re-queued (capped at 50)
- Badge shows pending event count in red

### 3. Popup UI (`extension/src/popup/`)

**Purpose**: 360px-wide browser action popup with auth, dashboard, events, settings.

| File | Role |
|------|------|
| `App.tsx` | Main popup — auth check, 3-tab layout (Dashboard/Events/Settings) |
| `AuthScreen.tsx` | Login/Signup forms with domain warning for public emails |
| `popup.html` | HTML shell with React mount point |

**State Management**: React `useState` + `chrome.storage.local` (no Redux).

### 4. Options Page (`extension/src/options/`)

**Purpose**: Full-page settings with 5 tabs — Detection, Platforms, Notifications, Organization, Advanced.

| Tab | Features |
|-----|----------|
| Detection | Category toggles (PII, Financial, Credentials, Medical, Proprietary), sensitivity selector |
| Platforms | Functional checkboxes per platform (ChatGPT, Claude, Gemini, Copilot, Perplexity, Poe) |
| Notifications | Browser + email notification toggles |
| Organization | Create org, invite members, view member list (admin-only invite) |
| Advanced | Auto-block critical toggle |

### 5. Shared Modules (`extension/src/shared/`)

| File | Purpose |
|------|----------|
| `types.ts` | All TypeScript interfaces (Detection, ScanResult, UserSettings, Policy, AlertPayload, BehaviorEvent, etc.) |
| `patterns.ts` | 14 detection categories with regex patterns and risk levels |
| `auth-utils.ts` | Login/register API calls, token storage, `authFetch()`, policy/settings sync |
| `config.ts` | API endpoint URLs with `/api/v1` prefix, platform registry |
| `defaultPolicy.ts` | Default settings and supported platforms list |
| `theme.ts` | Brand colors (#368F4D), font (Outfit), brand metadata |
| `utils.ts` | Debounce, event ID generation, version/browser info helpers |

### 6. Backend API (`backend/src/`)

**Stack**: Express.js + Prisma ORM + PostgreSQL

**Server** (`server.ts`): Configures middleware (helmet, CORS, rate limiter, logger), mounts all route handlers under `/api/v1`.

**Middleware**:
| File | Purpose |
|------|----------|
| `auth.ts` | JWT verification, `requireAuth` guard, `AuthRequest` type extension |
| `errorHandler.ts` | Global error handler with `AppError` class |
| `rateLimiter.ts` | Request rate limiting |
| `logger.ts` | Request logging middleware |
| `guard.ts` | Guard middleware for content scanning |

**Routes** (all under `/api/v1/`):
| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/health` | GET | No | Health check |
| `/auth` | POST | No | Register, login |
| `/events` | GET, POST, DELETE | Yes | Detection events CRUD + batch |
| `/settings` | GET, PATCH, DELETE | Yes | User settings upsert/reset |
| `/policies` | GET, POST, PUT, DELETE | Yes | Policy CRUD with rules |
| `/analytics` | GET | Yes | Summary stats, by-platform |
| `/behavior` | POST, GET | Yes | Session tracking, usage summaries, dashboard |
| `/alerts` | GET, POST, PATCH | Yes | Admin alerts CRUD, acknowledge |
| `/organizations` | GET, POST, DELETE | Yes | Org CRUD, invites, domains, dashboard |
| `/scan` | POST | Yes | On-demand prompt scan |
| `/guard` | POST | Yes | Guard verdict endpoint |

### 7. Database Schema (`backend/prisma/schema.prisma`)

**Core Models**:
- `User` — email, password, role (ADMIN/MEMBER/VIEWER), org link
- `UserSettings` — per-user preferences (categories, sensitivity, platforms, webhooks)
- `DetectionEvent` — logged scan results with risk level, platform, pattern matched
- `Policy` / `PolicyRule` — user-defined detection policies

**Organization Models**:
- `Organization` — name, slug, plan, domain restriction flag
- `OrgDomain` — verified email domains for auto-join
- `OrgMember` — many-to-many user↔org with role

**Analytics Models**:
- `BehaviorSession` — platform usage sessions with duration, counts
- `DailyUsageSummary` — daily aggregated stats per user
- `AdminAlert` — org-level security alerts with severity

**Audit Models**:
- `Session` — API session tokens with TTL
- `GuardLog` — guard verdict audit trail

## Data Flow Diagrams

### Prompt Scanning Flow
```
User types in ChatGPT
       |
       v
MutationObserver fires (debounced 500ms)
       |
       v
detector.scanText(text, settings)
       |
       v
+----- CRITICAL detected? -----+
|                               |
Yes                            No
|                               |
v                               v
Block submission              Warn (badge update)
Show overlay                  Allow submission
Report to SW                  Report to SW
       |                        |
       v                        v
SW queues event            SW queues event
       |                        |
       +--------+-------+------+
                |
                v
       Alarm flush (1 min)
                |
                v
       POST /api/v1/events/batch
                |
                v
       Prisma → PostgreSQL
```

### Authentication Flow
```
AuthScreen.tsx → LOGIN message → Service Worker
       |
       v
loginUser(email, pw) → POST /api/v1/auth/login
       |
       v
JWT token + user data returned
       |
       v
saveAuthState(token, user) → chrome.storage.local
       |
       v
syncPolicies() → GET /api/v1/policies
syncSettings() → GET /api/v1/settings
       |
       v
Policies + settings cached in chrome.storage.local
```

## Security Considerations

1. **Local-first scanning**: All regex pattern matching runs in the browser — no prompt data sent to backend for scanning
2. **JWT auth**: Backend routes protected with JWT verification middleware
3. **Sanitized matches**: Only sanitized snippets (X-masked) stored in detection events
4. **Fail-open**: Content scripts never break host pages — errors allow submission
5. **CORS + Helmet**: Backend hardened with security headers and origin restrictions
6. **Rate limiting**: API requests rate-limited to prevent abuse

## Technology Decisions

| Decision | Rationale |
|----------|----------|
| Manifest V3 | Required for Chrome Web Store, uses service workers instead of background pages |
| TypeScript strict | Type safety across extension + backend, no `any` types |
| Prisma ORM | Type-safe database queries, auto-generated types, easy migrations |
| React (no framework) | Lightweight popup UI, no routing needed, direct `createRoot` mount |
| Regex patterns (not ML) | Deterministic, fast, zero latency, no model download required |
| Chrome storage API | Persists settings across sessions, syncs between popup/content/background |
| Express (not Fastify) | Mature ecosystem, wide middleware support, team familiarity |
