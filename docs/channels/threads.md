---
summary: "Threads channel support, brand account setup, webhook configuration, and conversation management"
read_when:
  - Working on Threads channel behavior or brand account routing
title: "Threads"
---

# Threads

Status: **Ready for Testing** — Plugin implementation complete, Threads API integration ready, webhook handlers implemented.

## Install (on demand)

- Onboarding (`openclaw onboard`) and `openclaw channels add --channel threads`
  prompt to install the Threads plugin the first time you select it.
- `openclaw channels login --channel threads` also offers the install flow when
  the plugin is not present yet.
- Dev channel + git checkout: defaults to the local plugin path `@openclaw/threads`.
- Stable/Beta: defaults to the npm package `@openclaw/threads`.

Manual install stays available:

```bash
openclaw plugins install @openclaw/threads
```

<CardGroup cols={3}>
  <Card title="Meta Developer Setup" icon="cog" href="#meta-developer-configuration">
    Configure Threads API access, OAuth, webhooks.
  </Card>
  <Card title="Webhook verification" icon="shield-check" href="#webhook-verification">
    HMAC signature verification for Threads webhooks.
  </Card>
  <Card title="Channel troubleshooting" icon="wrench" href="/channels/troubleshooting">
    Cross-channel diagnostics and repair playbooks.
  </Card>
</CardGroup>

## Prerequisites

- **Instagram Business Account** (Threads requires linked IG Business)
- **Threads Profile** created from Instagram Business
- **Meta Developer App** with Threads API product enabled
- **Waitlist approval** for Threads API (currently in beta access)

## Meta Developer Configuration

<Steps>
  <Step title="Enable Threads API">

1. Access [Meta for Developers](https://developers.facebook.com/)
2. Select your app → Add **Threads** product
3. Accept Threads API terms
4. Request API access (waitlist approval may be required)

  </Step>

  <Step title="Link Instagram Business">

1. Go to **Threads → Settings** in Meta Dashboard
2. Connect Instagram Business account
3. Verify Threads profile appears in dashboard
4. Note **Threads Account ID** (same as Instagram IGSC ID)

  </Step>

  <Step title="Configure OAuth">

1. Go to **Settings → Basic** in Meta Dashboard
2. Add **Valid OAuth Redirect URIs**:
   ```
   https://your-gateway-domain.com/oauth/threads/callback
   ```
3. Enable **Embedded Browser OAuth** for testing
4. Set **App Domain** to your gateway domain

  </Step>

  <Step title="Configure Webhooks">

1. Go to **Threads → Settings → Webhooks**
2. Click **Add Callback URL**:
   - **Callback URL**: `https://your-gateway-domain.com/webhooks/meta/threads`
   - **Verify Token**: `<YOUR_VERIFY_TOKEN>` (generate secure random string)
3. Subscribe to fields:
   - `messages`
   - `thread_replies`
   - `mentions`

  </Step>

  <Step title="Generate Threads Access Token">

1. Go to **Threads → Settings → Access Tokens**
2. Click **Generate Access Token**
3. Select Threads profile
4. Copy generated token (store securely)

  </Step>

  <Step title="Configure OpenClaw">

```bash
openclaw config set channels.threads.enabled true
openclaw config set channels.threads.accounts.primary "your-threads-account-id"
openclaw config set channels.threads.webhook.verifyToken "<YOUR_VERIFY_TOKEN>"
openclaw config set channels.threads.auth.accessToken "<YOUR_THREADS_ACCESS_TOKEN>"
openclaw config set channels.threads.auth.appId "<YOUR_APP_ID>"
openclaw config set channels.threads.auth.appSecret "<YOUR_APP_SECRET>"
```

  </Step>

  <Step title="Start the gateway">

```bash
openclaw gateway
```

  </Step>

  <Step title="Test webhook">

Post a reply to your Threads profile or send a DM. Verify in gateway logs:

```bash
openclaw logs --channel threads
```

  </Step>
</Steps>

## Configuration Reference

### Minimal config

```json5
{
  channels: {
    threads: {
      enabled: true,
      accounts: {
        primary: "your-threads-account-id",
      },
      webhook: {
        path: "/webhooks/meta/threads",
        verifyToken: "<YOUR_VERIFY_TOKEN>",
      },
      auth: {
        appId: "<YOUR_APP_ID>",
        appSecret: "<YOUR_APP_SECRET>",
        accessToken: "<YOUR_THREADS_ACCESS_TOKEN>",
      },
    },
  },
}
```

### Access control policies

```json5
{
  channels: {
    threads: {
      // ... other config
      dmPolicy: "allow",           // "allow" | "deny"
      allowFrom: ["th-allowed-user-1", "th-allowed-user-2"],
      responseWindowHours: 24,     // Threads 24h messaging window
    },
  },
}
```

### Multi-account setup (multiple brands)

```json5
{
  channels: {
    threads: {
      accounts: {
        primary: "th-account-id-1",
        secondary: "th-account-id-2",
        campaign: "th-account-id-3",
      },
      // Per-account overrides
      accountConfigs: {
        campaign: {
          dmPolicy: "allow",
          responseWindowHours: 12,
        },
      },
    },
  },
}
```

## Webhook Verification

Threads webhooks use HMAC-SHA1 signature verification (same as Meta stack).

### Verification flow

1. Threads sends `X-Hub-Signature` header with each webhook
2. Gateway computes HMAC using `appSecret`
3. Gateway compares signatures (constant-time)
4. Invalid signatures are rejected with 401

### Manual verification test

```bash
# Generate test payload
curl -X POST https://your-gateway-domain.com/webhooks/meta/threads \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: sha1=<COMPUTED_HMAC>" \
  -d '{"object":"threads","entry":[{"id":"th-account-id","time":1234567890,"messaging":[]}]}'
```

Expected: 200 OK for valid signature, 401 for invalid.

## OAuth Flow

### Authorization URL

```
https://www.facebook.com/v21.0/dialog/oauth
  ?client_id={app-id}
  &redirect_uri={redirect-uri}
  &scope={scopes}
  &state={random-state}
  &response_type=code
```

### Required scopes

- `threads_basic` — Read basic Threads profile info
- `threads_manage_messages` — Send/receive Threads messages
- `threads_manage_posts` — Create and manage Threads posts
- `pages_read_engagement` — Read engagement data

### Token refresh

Threads access tokens expire after 60 days (long-lived). Gateway automatically refreshes tokens 5 days before expiry.

## Message Types

### Supported inbound

- Text messages (DMs)
- Thread replies (public conversations)
- Mentions (@username)
- Quote posts
- Text posts in threads

### Supported outbound

- Text messages (DMs)
- Thread posts (text up to 500 characters)
- Thread replies (to existing threads)
- Image posts (with caption)
- Quote posts

### Not supported (Threads restrictions)

- Unsolicited DMs to users who haven't interacted first
- Messages outside 24h window (no message tags for Threads)
- Broadcast messages
- Videos (currently text + images only)
- Links with preview cards (API limitation)

## 24-Hour Messaging Window

Threads enforces a 24-hour session window for DMs:

- **User initiates DM**: 24h window opens for free-form replies
- **After 24h**: Cannot DM user unless they message again
- **Public threads**: No time restriction for public replies

Gateway tracks session windows per Threads user ID. Attempts to send DMs outside window return error.

## Thread Conversations

Threads supports both private DMs and public conversation threads.

### Public thread reply

```typescript
// Reply to existing thread
await sendThreadsMessage({
  accountId: "your-threads-account",
  to: "th-recipient",
  content: {
    type: "thread_reply",
    threadId: "thread-123",
    text: "Great point! Here's my take...",
  },
});
```

### Create new thread

```typescript
// Start new thread (public post)
await sendThreadsMessage({
  accountId: "your-threads-account",
  to: "th-recipient", // Can be empty for broadcast
  content: {
    type: "thread",
    text: "This is a new thread post",
  },
});
```

### Image thread

```typescript
// Post image with caption
await sendThreadsMessage({
  accountId: "your-threads-account",
  to: "th-recipient",
  content: {
    type: "thread_image",
    imageUrl: "https://example.com/image.jpg",
    caption: "Check this out!",
  },
});
```

## Troubleshooting

### Webhook not receiving messages

1. Verify Threads API access is approved (waitlist)
2. Check Instagram Business account is linked
3. Verify webhook URL shows green checkmark in Meta Dashboard
4. Check `verifyToken` matches in config
5. Check gateway logs: `openclaw logs --channel threads --verbose`

### "API access required" error

Threads API is in beta. Verify:

- App has Threads product enabled
- Account is on approved waitlist
- Access token has `threads_manage_messages` scope

### Token expired

```bash
# Re-generate token in Meta Dashboard
openclaw config set channels.threads.auth.accessToken "<NEW_TOKEN>"
openclaw gateway restart
```

### Message delivery failed

Check error codes:

- `#368` — Action blocked (user blocked account)
- `#130429` — Rate limited
- `#131046` — Outside 24h window (DMs only)
- `#2853004` — Threads API access not approved

## Testing

### Send test DM

```bash
openclaw message send --channel threads \
  --account "your-threads-account-id" \
  --to "th-recipient" \
  --text "Hello from OpenClaw"
```

### Create test thread

```bash
openclaw message send --channel threads \
  --account "your-threads-account-id" \
  --text "This is a test thread post" \
  --type thread
```

### Simulate inbound webhook (DM)

```bash
curl -X POST https://your-gateway-domain.com/webhooks/meta/threads \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: sha1=<VALID_HMAC>" \
  -d '{
    "object": "threads",
    "entry": [{
      "id": "th-account-id",
      "time": 1234567890,
      "messaging": [{
        "sender": {"id": "th-user-123"},
        "recipient": {"id": "th-brand-456"},
        "timestamp": 1234567890,
        "message": {"mid": "th-mid-123", "text": "Hello"}
      }]
    }]
  }'
```

### Simulate inbound webhook (thread reply)

```bash
curl -X POST https://your-gateway-domain.com/webhooks/meta/threads \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: sha1=<VALID_HMAC>" \
  -d '{
    "object": "threads",
    "entry": [{
      "id": "th-account-id",
      "time": 1234567890,
      "thread_replies": [{
        "sender": {"id": "th-user-123"},
        "recipient": {"id": "th-brand-456"},
        "timestamp": 1234567890,
        "thread_id": "thread-123",
        "text": "Great thread!"
      }]
    }]
  }'
```

## Security Considerations

- **Never commit** `appSecret`, `accessToken`, or `verifyToken` to version control
- Rotate tokens every 90 days minimum
- Use separate Meta apps for production vs staging
- Monitor webhook logs for suspicious activity
- Threads posts are public by default — validate content before posting

## Threads vs Instagram vs Messenger

| Feature | Threads | Instagram | Messenger |
|---------|---------|-----------|-----------|
| Account type | IG Business required | Business only | Any Page |
| 24h window | DMs only | Strict | Flexible (with tags) |
| Public threads | ✅ Yes | ❌ No | ❌ No |
| Image posts | ✅ Yes | ✅ Yes | ✅ Yes |
| Video posts | ❌ Not yet | ✅ Yes | ✅ Yes |
| DMs | ✅ Yes | ✅ Yes | ✅ Yes |
| Broadcast API | ❌ No | ❌ No | ✅ Yes |

## API Limitations (Beta)

Threads API is currently in beta with these known limitations:

- **Waitlist access** — API approval required
- **No video uploads** — Text and images only
- **No link previews** — URLs posted as plain text
- **Limited analytics** — Basic engagement metrics only
- **Rate limits** — Stricter than Instagram/Messenger

Meta is actively expanding Threads API. Check [Meta Developer Docs](https://developers.facebook.com/docs/threads) for updates.

## Related

- [Messenger](/channels/messenger) — Facebook Messenger integration
- [Instagram](/channels/instagram) — Instagram Direct integration
- [WhatsApp](/channels/whatsapp) — WhatsApp integration
- [Meta Platforms Setup](/platforms/meta) — Complete Meta stack configuration
