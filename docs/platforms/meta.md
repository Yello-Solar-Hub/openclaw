---
summary: "Meta Platforms integration guide covering Facebook Messenger, Instagram Direct, Threads, and WhatsApp with unified configuration patterns"
read_when:
  - Setting up multiple Meta platform channels
  - Configuring cross-platform messaging policies
  - Managing Meta app credentials and webhooks
title: "Meta Platforms"
---

# Meta Platforms

Unified integration guide for Meta's messaging platforms: **Messenger**, **Instagram Direct**, **Threads**, and **WhatsApp**.

<CardGroup cols={4}>
  <Card title="Messenger" icon="message" href="/channels/messenger">
    Facebook Messenger integration with rich messaging and 24h session window.
  </Card>
  <Card title="Instagram" icon="instagram" href="/channels/instagram">
    Instagram Business DMs with story mentions and strict 24h window.
  </Card>
  <Card title="Threads" icon="threads" href="/channels/threads">
    Threads API for public conversations and private DMs.
  </Card>
  <Card title="WhatsApp" icon="whatsapp" href="/channels/whatsapp">
    WhatsApp Business with Baileys Web integration.
  </Card>
</CardGroup>

## Architecture Overview

Meta platforms share common infrastructure:

```
┌─────────────────────────────────────────────────────────┐
│                   Meta Graph API                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │Messenger │  │Instagram │  │ Threads  │  │WhatsApp│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │
└───────┼─────────────┼─────────────┼─────────────┼──────┘
        │             │             │             │
        │  Webhooks   │  Webhooks   │  Webhooks   │  Baileys
        │  (HTTPS)    │  (HTTPS)    │  (HTTPS)    │  WebSocket
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────┐
│              OpenClaw Gateway                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │         @openclaw/meta-common                    │  │
│  │  - OAuth Manager (unified)                       │  │
│  │  - Webhook Manager (HMAC verification)           │  │
│  │  - HTTP Client (rate limiting, retries)          │  │
│  │  - Type definitions (Inbound/Outbound messages)  │  │
│  └──────────────────────────────────────────────────┘  │
│         │              │              │                 │
│  ┌──────▼──────┐ ┌────▼──────┐ ┌────▼──────┐ ┌───────┐│
│  │ @openclaw/  │ │ @openclaw/│ │ @openclaw/│ │WhatsApp││
│  │ messenger   │ │ instagram │ │ threads   │ │       ││
│  └─────────────┘ └───────────┘ └───────────┘ └───────┘│
└─────────────────────────────────────────────────────────┘
```

## Shared Components

### @openclaw/meta-common

All Meta platform plugins share a common library:

- **OAuth Manager**: Unified OAuth 2.0 flow with token refresh
- **Webhook Manager**: HMAC-SHA1 signature verification
- **HTTP Client**: Rate limiting, retries, error handling
- **Type Definitions**: Shared `InboundMessage` and `OutboundMessage` types

**Installation** (automatic as dependency):

```bash
# Installed automatically with any Meta plugin
openclaw plugins install @openclaw/messenger
```

**Note**: `meta-common` is a shared library, not a standalone plugin.

## Unified Setup Flow

### Step 1: Create Meta App

1. Access [Meta for Developers](https://developers.facebook.com/)
2. Create app → Select **Business** use case
3. Add required products:
   - **Messenger** (for Facebook Messenger)
   - **Instagram Graph API** (for Instagram + Threads)
   - **Threads** (for Threads API access)

### Step 2: Configure OAuth (per platform)

Each platform needs its own OAuth redirect URI:

```
Messenger:   https://your-gateway.com/oauth/messenger/callback
Instagram:   https://your-gateway.com/oauth/instagram/callback
Threads:     https://your-gateway.com/oauth/threads/callback
```

### Step 3: Configure Webhooks (per platform)

Each platform posts to a separate webhook path:

```
Messenger:   https://your-gateway.com/webhooks/meta/messenger
Instagram:   https://your-gateway.com/webhooks/meta/instagram
Threads:     https://your-gateway.com/webhooks/meta/threads
WhatsApp:    (uses Baileys WebSocket, no webhook)
```

### Step 4: Generate Access Tokens

Generate tokens in Meta Dashboard for each platform:

- **Messenger**: Page Access Token
- **Instagram**: Instagram Graph API Token
- **Threads**: Threads API Token
- **WhatsApp**: QR code pairing (no token)

### Step 5: Configure OpenClaw

```bash
# Messenger
openclaw config set channels.messenger.enabled true
openclaw config set channels.messenger.accounts.primary "page-id-1"
openclaw config set channels.messenger.auth.accessToken "EAAS..."
openclaw config set channels.messenger.auth.appId "123456789"
openclaw config set channels.messenger.auth.appSecret "abc123..."
openclaw config set channels.messenger.webhook.verifyToken "your-verify-token"

# Instagram
openclaw config set channels.instagram.enabled true
openclaw config set channels.instagram.accounts.primary "ig-account-id"
openclaw config set channels.instagram.auth.accessToken "IGSC..."
openclaw config set channels.instagram.auth.appId "123456789"
openclaw config set channels.instagram.auth.appSecret "abc123..."
openclaw config set channels.instagram.webhook.verifyToken "your-verify-token"

# Threads
openclaw config set channels.threads.enabled true
openclaw config set channels.threads.accounts.primary "th-account-id"
openclaw config set channels.threads.auth.accessToken "TH..."
openclaw config set channels.threads.auth.appId "123456789"
openclaw config set channels.threads.auth.appSecret "abc123..."
openclaw config set channels.threads.webhook.verifyToken "your-verify-token"
```

## Configuration Reference

### Complete Meta Stack Config

```json5
{
  channels: {
    messenger: {
      enabled: true,
      accounts: {
        primary: "page-id-1",
        support: "page-id-2",
      },
      auth: {
        appId: "123456789",
        appSecret: "<REDACTED>",
        accessToken: "<REDACTED>",
      },
      webhook: {
        path: "/webhooks/meta/messenger",
        verifyToken: "<REDACTED>",
      },
      dmPolicy: "allow",
      allowFrom: [],
      responseWindowHours: 24,
      defaultReplyControl: "standard",
    },
    instagram: {
      enabled: true,
      accounts: {
        primary: "ig-account-id-1",
      },
      auth: {
        appId: "123456789",
        appSecret: "<REDACTED>",
        accessToken: "<REDACTED>",
      },
      webhook: {
        path: "/webhooks/meta/instagram",
        verifyToken: "<REDACTED>",
      },
      dmPolicy: "allow",
      allowFrom: [],
      responseWindowHours: 24,
    },
    threads: {
      enabled: true,
      accounts: {
        primary: "th-account-id-1",
      },
      auth: {
        appId: "123456789",
        appSecret: "<REDACTED>",
        accessToken: "<REDACTED>",
      },
      webhook: {
        path: "/webhooks/meta/threads",
        verifyToken: "<REDACTED>",
      },
      dmPolicy: "allow",
      allowFrom: [],
      responseWindowHours: 24,
    },
    whatsapp: {
      enabled: true,
      accounts: {
        primary: "whatsapp-account-1",
      },
      dmPolicy: "pairing",
      allowFrom: [],
      groupPolicy: "allowlist",
    },
  },
}
```

## Webhook Security

All Meta webhooks (except WhatsApp) use HMAC-SHA1 verification:

### Signature Verification

```typescript
import { WebhookManager } from '@openclaw/meta-common';

const manager = new WebhookManager({
  verifyToken: 'your-verify-token',
});

// Verify webhook signature
const isValid = await manager.verify(
  'your-verify-token',
  payload,
  'x-hub-signature',
);

// Parse inbound message
const parsed = await manager.parseInbound(payload, 'account-id');
```

### Constant-Time Comparison

Gateway uses constant-time comparison to prevent timing attacks:

```typescript
// meta-common/src/webhook/manager.ts
private constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

## OAuth Token Management

### Token Lifecycle

| Platform | Short-Lived | Long-Lived | Refresh |
|----------|-------------|------------|---------|
| Messenger | 1-2 hours | 60 days | Auto (5 days before expiry) |
| Instagram | 1 hour | 60 days | Auto (5 days before expiry) |
| Threads | 1 hour | 60 days | Auto (5 days before expiry) |

### Manual Token Refresh

```bash
# Check token expiry
openclaw config get channels.messenger.auth.accessToken

# Refresh token (via OAuth flow)
openclaw channels login --channel messenger

# Or manually update
openclaw config set channels.messenger.auth.accessToken "NEW_TOKEN"
```

## Rate Limiting

Meta enforces platform-specific rate limits:

| Platform | Limit | Window | Strategy |
|----------|-------|--------|----------|
| Messenger | 1000 req/min | Per app, per minute | Queue + retry |
| Instagram | 200 req/hour | Per user, per hour | Queue + retry |
| Threads | 100 req/hour | Per user, per hour | Queue + retry |
| WhatsApp | No API limit | Baileys WebSocket | Native flow control |

Gateway implements automatic rate limiting with exponential backoff.

## Cross-Platform Messaging Patterns

### Unified Inbox

Configure routing to handle messages from all platforms:

```json5
{
  routing: {
    rules: [
      // Priority: WhatsApp first
      { channel: 'whatsapp', priority: 1 },
      // Then Messenger
      { channel: 'messenger', priority: 2 },
      // Then Instagram
      { channel: 'instagram', priority: 3 },
      // Then Threads
      { channel: 'threads', priority: 4 },
    ],
  },
}
```

### Cross-Platform User Identity

Meta platforms use different user ID systems:

| Platform | User ID Type | Scope |
|----------|--------------|-------|
| Messenger | PSID (Page-Scoped ID) | Per Page |
| Instagram | IGSC (Instagram Secure Customer ID) | Per Business Account |
| Threads | Threads User ID | Per Threads Profile |
| WhatsApp | Phone Number (E.164) | Global |

**User resolution strategy**:

```typescript
// Normalize user identity across platforms
function normalizeUserId(message: InboundMessage): string {
  const platform = message.channelId;
  const userId = message.from.id;
  
  switch (platform) {
    case 'messenger':
      return `fb:${userId}`;  // PSID
    case 'instagram':
      return `ig:${userId}`;  // IGSC
    case 'threads':
      return `th:${userId}`;  // Threads ID
    case 'whatsapp':
      return `wa:${userId}`;  // Phone number
    default:
      return `${platform}:${userId}`;
  }
}
```

## 24-Hour Messaging Window

All Meta platforms (except WhatsApp) enforce 24-hour session windows:

| Platform | Window | Message Tags | Strict? |
|----------|--------|--------------|---------|
| Messenger | 24h from last user message | ✅ Yes | No (tags allow outside) |
| Instagram | 24h from last user message | ❌ No | Yes |
| Threads | 24h from last DM | ❌ No | Yes |
| WhatsApp | No window (always allowed) | N/A | No |

Gateway tracks session windows per user and prevents violations.

## Troubleshooting

### Common Issues

**Webhook 401 errors**:
- Verify `verifyToken` matches in Meta Dashboard and config
- Check HMAC signature computation (uses `appSecret`)
- Ensure webhook URL is publicly accessible

**Token expired errors**:
- Check token expiry: `openclaw config get channels.<platform>.auth.accessToken`
- Refresh via OAuth: `openclaw channels login --channel <platform>`
- Verify auto-refresh is working (check logs)

**Rate limit errors**:
- Check gateway logs for `429 Too Many Requests`
- Gateway automatically queues and retries
- Reduce message volume if persistent

**Message delivery failures**:
- Check error codes in response
- Verify user hasn't blocked account
- Confirm 24h window is still active

### Diagnostic Commands

```bash
# Check channel status
openclaw channels status --channel messenger
openclaw channels status --channel instagram
openclaw channels status --channel threads

# View recent logs
openclaw logs --channel messenger --tail 100
openclaw logs --channel instagram --tail 100
openclaw logs --channel threads --tail 100

# Test webhook connectivity
curl -X POST https://your-gateway.com/webhooks/meta/messenger \
  -H "Content-Type: application/json" \
  -d '{"object":"page","entry":[]}'

# Check token expiry
openclaw config get channels.messenger.auth.accessToken --verbose
```

## Security Best Practices

### Credential Management

- **Never commit** secrets to version control
- Use environment variables or secure config storage
- Rotate tokens every 90 days minimum
- Use separate Meta apps for prod/staging

### Webhook Security

- Always verify HMAC signatures
- Use HTTPS for webhook URLs
- Validate `verifyToken` on every request
- Log all webhook attempts for auditing

### Access Control

- Configure `allowFrom` lists for known users
- Use `dmPolicy` to control unsolicited messages
- Enable `groupPolicy` for group message filtering
- Monitor for suspicious activity in logs

## Monitoring & Observability

### Key Metrics

Track these metrics for each platform:

- **Inbound messages**: Count per minute/hour
- **Outbound messages**: Count per minute/hour
- **Webhook latency**: P50, P95, P99
- **Token refresh events**: Count per day
- **Rate limit hits**: Count per hour
- **Delivery failures**: Count + error codes

### Logging

Gateway logs all Meta platform activity:

```bash
# Verbose logging for debugging
openclaw logs --channel messenger --verbose

# Filter by event type
openclaw logs --channel instagram --filter "webhook"
openclaw logs --channel threads --filter "oauth"

# Export logs for analysis
openclaw logs --channel messenger --export json > logs.json
```

## Related

- [Messenger](/channels/messenger) — Detailed Messenger setup
- [Instagram](/channels/instagram) — Detailed Instagram setup
- [Threads](/channels/threads) — Detailed Threads setup
- [WhatsApp](/channels/whatsapp) — WhatsApp integration
- [Webhook Security](/security/webhooks) — General webhook security guide
