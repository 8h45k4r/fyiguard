# FYI Guard — Deployment Guide

## Prerequisites

- Node.js >= 18
- npm >= 9
- PostgreSQL 14+ (or Supabase/Neon hosted)
- Docker & Docker Compose (optional)

---

## Extension Setup

### 1. Install Dependencies
```bash
cd extension
npm install
```

### 2. Development Build (watch mode)
```bash
npm run dev
```

### 3. Production Build
```bash
npm run build
```

### 4. Load in Chrome
1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/dist` folder
5. The FYI Guard icon appears in the toolbar

### 5. Update After Changes
- Run `npm run build` again
- Click the refresh icon on the extension card in `chrome://extensions`

---

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fyiguard"
DIRECT_URL="postgresql://user:password@localhost:5432/fyiguard"

# JWT
JWT_SECRET="your-secret-key-min-32-chars"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN="*"

# Optional: Email notifications
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="alerts@company.com"
SMTP_PASS="app-password"
```

### 3. Initialize Database
```bash
npx prisma generate
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```
Server starts on `http://localhost:3001`.

### 5. Run Production
```bash
npm run build
npm start
```

---

## Docker Deployment

### Using Docker Compose
```bash
cd backend
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Backend API on port 3001

### Dockerfile (backend only)
```bash
cd backend
docker build -t fyiguard-api .
docker run -p 3001:3001 --env-file .env fyiguard-api
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | Yes | - | PostgreSQL direct connection (for migrations) |
| `JWT_SECRET` | Yes | - | Secret for JWT signing (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `7d` | JWT token expiration |
| `PORT` | No | `3001` | API server port |
| `NODE_ENV` | No | `development` | Environment (development/production) |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins |
| `SMTP_HOST` | No | - | SMTP server for email alerts |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | - | SMTP username |
| `SMTP_PASS` | No | - | SMTP password |

---

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):

1. **Lint & Type Check**: Runs `tsc --noEmit` for both extension and backend
2. **Test**: Runs Jest test suites
3. **Build**: Builds extension with webpack, compiles backend with TypeScript
4. **Deploy**: (Optional) Push to staging/production

Triggers: Push to `main`, Pull requests to `main`.

---

## Extension Configuration

Update `extension/src/shared/config.ts` to point to your backend:

```typescript
const BASE = 'https://your-api-domain.com/api/v1';
```

Supported platforms are configured in `manifest.json` content_scripts matches and host_permissions.

---

## Database Migrations

```bash
# Create a migration
npx prisma migrate dev --name add_new_field

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# View database in browser
npx prisma studio
```

---

## Chrome Web Store Publishing

1. Run `npm run build` in `extension/`
2. Zip the `dist/` folder
3. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Fill in listing details, screenshots, privacy policy
5. Submit for review

---

## Monitoring & Logs

- Backend logs via `requestLogger` middleware
- Extension logs: Open Chrome DevTools on any AI platform page, check console for `[FYI Guard]` prefix
- Service worker logs: Open `chrome://extensions`, click "Inspect views: service worker"
- Database queries: Enable Prisma query logging with `log: ['query']` in schema
