# Contributing to FYI Guard

Thank you for your interest in contributing to FYI Guard! This guide covers the development setup, coding standards, and submission process.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Coding Standards](#coding-standards)
5. [Commit Conventions](#commit-conventions)
6. [Testing](#testing)
7. [Pull Request Process](#pull-request-process)
8. [Adding a New Platform](#adding-a-new-platform)
9. [Adding Detection Patterns](#adding-detection-patterns)

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **PostgreSQL** 14+ (for backend development)
- **Docker** & Docker Compose (optional, for containerized setup)
- **Chrome** browser (for extension testing)

---

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/8h45k4r/fyiguard.git
cd fyiguard
```

### 2. Extension Setup

```bash
cd extension
npm install
npm run dev          # starts webpack in watch mode
```

Load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select `extension/dist/`

### 3. Backend Setup

```bash
cd backend
cp .env.example .env   # edit with your DB credentials
npm install
npx prisma generate
npx prisma db push
npm run dev            # starts Express on port 3001
```

### 4. Docker Setup (Alternative)

```bash
cd backend
docker-compose up -d   # starts PostgreSQL + API server
```

---

## Coding Standards

### TypeScript

- **Strict mode** enabled (`strict: true` in tsconfig.json)
- **No `any`** except truly unavoidable cases (document with `// eslint-disable-next-line`)
- Use explicit return types on exported functions
- Prefer `interface` over `type` for object shapes
- Use `readonly` for properties that should not be mutated

### React

- Functional components only (no class components)
- Use React hooks for state and effects
- Keep popup width at 360px (Chrome extension constraint)
- Use `theme.ts` constants for colors and fonts

### CSS

- Content script styles must be scoped (use `fyiguard-` prefix)
- Avoid `!important` unless overriding platform styles
- Use CSS custom properties for theming

### File Organization

- One export per file where practical
- Keep shared code in `shared/` directory
- Platform adapters go in `content/platform-adapters/`
- Backend routes in `backend/src/routes/`

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

### Types

| Type | Usage |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons |
| `refactor` | Code change that neither fixes nor adds |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, tooling |

### Scopes

- `extension` — Chrome extension code
- `backend` — Express API server
- `docs` — Documentation
- `ci` — CI/CD pipeline

### Examples

```
feat(extension): add Poe platform adapter
fix(backend): handle duplicate user registration
docs: add API reference documentation
chore(ci): update Node.js version in workflow
```

---

## Testing

### Backend Tests

```bash
cd backend
npm test             # runs Jest test suites
npm run test:watch   # watch mode
```

Test files live in `backend/__tests__/` and cover:

- Route handlers (auth, guard, events, settings)
- Middleware (rate limiter, authentication, error handler)
- Detection service logic

### Extension Testing

Manual testing workflow:

1. Build extension with `npm run dev`
2. Load unpacked in Chrome
3. Navigate to a supported AI platform
4. Type test strings containing sensitive data patterns
5. Verify warning overlay appears with correct category and risk level
6. Test auto-block behavior with CRITICAL risk patterns

---

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`
2. **Implement** your changes following the coding standards above
3. **Test** thoroughly (backend unit tests + manual extension testing)
4. **Commit** using conventional commit messages
5. **Push** to your fork and open a Pull Request
6. **Describe** what your PR does, why, and how to test it
7. **Wait** for review — maintainers will review within 48 hours

### PR Checklist

- [ ] TypeScript strict mode passes with no errors
- [ ] No `any` types added
- [ ] Conventional commit messages used
- [ ] Extension tested manually on at least one platform
- [ ] Backend tests pass (`npm test`)
- [ ] Documentation updated if needed

---

## Adding a New Platform

To add support for a new AI chat platform:

1. **Create adapter** at `extension/src/content/platform-adapters/<name>.ts`
2. **Extend** `PlatformAdapter` from `base.ts`
3. **Implement** all required methods: `getInputElement()`, `getSubmitButton()`, `extractText()`, `blockSubmission()`, `attachListeners()`
4. **Update manifest.json**: add hostname to `content_scripts[0].matches` and `host_permissions`
5. **Update defaultPolicy.ts**: add platform to `platforms` array
6. **Register** in injector.ts platform detection switch statement
7. **Test** on the target platform

---

## Adding Detection Patterns

To add new sensitive data patterns:

1. **Edit** `extension/src/shared/patterns.ts`
2. **Add** a new `PatternDefinition` object:
   - `name`: Human-readable label
   - `category`: existing CategoryGroup or create new one
   - `categoryGroup`: parent grouping
   - `regex`: object with `source` and `flags`
   - `risk`: RiskLevel (CRITICAL, HIGH, MEDIUM, LOW)
   - `description`: what the pattern detects
3. **Test** with sample strings to verify regex accuracy
4. **Avoid** overly broad patterns that cause false positives

---

## Code of Conduct

Be respectful, constructive, and inclusive. We welcome contributors of all experience levels.

---

Built by [CertifYI.ai](https://certifyi.ai)
