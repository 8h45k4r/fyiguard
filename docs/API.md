# FYI Guard — API Reference

Base URL: `http://localhost:3001/api/v1`

All protected routes require `Authorization: Bearer <token>` header.

---

## Authentication

### POST `/auth/register`
Create a new user account.

**Request Body**:
```json
{
  "email": "user@company.com",
  "password": "min8chars",
  "name": "Jane Doe"
}
```

**Response** `201`:
```json
{
  "token": "jwt-token-string",
  "userId": "cuid_xxx",
  "email": "user@company.com",
  "role": "MEMBER"
}
```

### POST `/auth/login`
Authenticate an existing user.

**Request Body**:
```json
{
  "email": "user@company.com",
  "password": "password123"
}
```

**Response** `200`: Same shape as register response.

---

## Detection Events

### POST `/events`
Log a single detection event.

**Auth**: Required

**Request Body**:
```json
{
  "id": "evt_abc123",
  "eventType": "BLOCK",
  "detection": {
    "category": "CREDIT_CARD",
    "confidence": 0.95,
    "riskLevel": "CRITICAL",
    "patternMatched": "4111-XXXX-XXXX-1111",
    "sanitizedMatch": "XXXXXXXXXXXX"
  },
  "context": {
    "platform": "chatgpt",
    "url": "https://chatgpt.com",
    "conversationId": null,
    "promptLength": 250
  },
  "metadata": {
    "extensionVersion": "1.0.0",
    "browser": "Chrome 120",
    "userAction": "attempted_send"
  }
}
```

**Response** `201`: Created event object.

### POST `/events/batch`
Log multiple events in a single request (max 50).

**Auth**: Required

**Request Body**:
```json
{
  "events": [ ...array of event objects... ]
}
```

**Response** `201`:
```json
{ "created": 5 }
```

### GET `/events`
List detection events for the authenticated user.

**Auth**: Required

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `category` | string | - | Filter by category |
| `riskLevel` | string | - | Filter by risk level |

**Response** `200`:
```json
{
  "events": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### DELETE `/events/:id`
Delete a specific event.

**Auth**: Required

**Response** `200`:
```json
{ "message": "Event deleted" }
```

---

## User Settings

### GET `/settings`
Get current user settings.

**Auth**: Required

**Response** `200`: UserSettings object.

### PATCH `/settings`
Update user settings (partial update).

**Auth**: Required

**Request Body** (all fields optional):
```json
{
  "sensitivity": "HIGH",
  "autoBlock": true,
  "pii": true,
  "financial": false,
  "credentials": true,
  "medical": true,
  "proprietary": true,
  "browserNotifications": true,
  "emailNotifications": false,
  "whitelistedDomains": ["internal.company.com"],
  "enabledPlatforms": ["chatgpt.com", "claude.ai"]
}
```

**Response** `200`: Updated settings object.

### DELETE `/settings`
Reset settings to defaults.

**Auth**: Required

**Response** `200`: New default settings object.

---

## Policies

### GET `/policies`
List all policies for the authenticated user.

**Auth**: Required

**Response** `200`:
```json
{
  "policies": [
    {
      "id": "pol_xxx",
      "name": "Block All PII",
      "enabled": true,
      "platforms": ["chatgpt.com"],
      "rules": [
        {
          "id": "rule_xxx",
          "category": "PII",
          "action": "BLOCK",
          "exceptions": []
        }
      ]
    }
  ]
}
```

### POST `/policies`
Create a new policy.

**Auth**: Required

### PUT `/policies/:id`
Update an existing policy.

**Auth**: Required

### DELETE `/policies/:id`
Delete a policy.

**Auth**: Required

---

## Analytics

### GET `/analytics/summary`
Get analytics summary for the authenticated user.

**Auth**: Required

**Response** `200`:
```json
{
  "totalEvents": 150,
  "blocked": 12,
  "warned": 45,
  "allowed": 93,
  "topCategory": "API_KEY",
  "riskBreakdown": {
    "CRITICAL": 3,
    "HIGH": 15,
    "MEDIUM": 42,
    "LOW": 90
  }
}
```

### GET `/analytics/by-platform`
Get event counts grouped by platform.

**Auth**: Required

---

## Behavior Tracking

### POST `/behavior/session/start`
Start a new platform usage session.

**Auth**: Required

**Request Body**:
```json
{
  "userId": "user_xxx",
  "platform": "chatgpt",
  "url": "https://chatgpt.com"
}
```

### POST `/behavior/session/end`
End an active session.

**Auth**: Required

### POST `/behavior/event`
Log a behavior event.

**Auth**: Required

### GET `/behavior/usage`
Get daily usage summary.

**Auth**: Required

### GET `/behavior/dashboard`
Get org-level behavior dashboard (admin only).

**Auth**: Required (Admin)

### GET `/behavior/trending`
Get trending usage data.

**Auth**: Required

### GET `/behavior/leaderboard`
Get user activity leaderboard.

**Auth**: Required

---

## Admin Alerts

### POST `/alerts`
Create a new admin alert.

**Auth**: Required

**Request Body**:
```json
{
  "orgId": "org_xxx",
  "userId": "user_xxx",
  "category": "CREDIT_CARD",
  "riskLevel": "CRITICAL",
  "platform": "chatgpt",
  "details": "Credit card number detected in prompt"
}
```

### GET `/alerts`
List alerts (filtered by org).

**Auth**: Required

### PATCH `/alerts/:id/acknowledge`
Acknowledge an alert.

**Auth**: Required

---

## Organizations

### POST `/organizations`
Create a new organization.

**Auth**: Required

**Request Body**:
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp"
}
```

**Response** `201`: Organization object with members.

### GET `/organizations/mine`
Get organizations the user belongs to.

**Auth**: Required

### GET `/organizations/:id`
Get organization details.

**Auth**: Required (Must be member)

### POST `/organizations/:id/invite`
Invite a user to the organization.

**Auth**: Required (Admin only)

**Request Body**:
```json
{
  "email": "newuser@company.com",
  "role": "member"
}
```

### DELETE `/organizations/:id/members/:userId`
Remove a member from the organization.

**Auth**: Required (Admin only)

### POST `/organizations/:id/domains`
Add an email domain to the organization.

**Auth**: Required (Admin only)

### GET `/organizations/:id/dashboard`
Get organization analytics dashboard.

**Auth**: Required (Admin only)

**Response** `200`:
```json
{
  "orgId": "org_xxx",
  "totalMembers": 15,
  "totalAlerts": 8,
  "recentAlerts": [...],
  "totalTimeHours": 124.5,
  "riskSummary": { "critical": 2, "high": 5, "medium": 20, "low": 45 },
  "totalEvents": 350,
  "recentSessions": [...]
}
```

---

## Health Check

### GET `/health`
Server health check.

**Auth**: Not required

**Response** `200`:
```json
{ "status": "ok", "timestamp": "2026-02-22T15:00:00Z" }
```

---

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message description",
  "statusCode": 400
}
```

| Code | Meaning |
|------|---------|
| 400 | Bad Request — invalid input or validation error |
| 401 | Unauthorized — missing or invalid JWT token |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found — resource does not exist |
| 409 | Conflict — duplicate resource |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

All API routes are subject to rate limiting. The default limit is configured via the `rateLimiter` middleware.

## CORS

CORS is configured to accept requests from the Chrome extension origin. Set `CORS_ORIGIN` environment variable to restrict origins in production.
