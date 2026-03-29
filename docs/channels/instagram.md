---
summary: "Instagram Direct Message channel support, business account setup, webhook configuration, and messaging policies"
read_when:
  - Working on Instagram DM channel behavior or business account routing
title: "Instagram"
---

# Instagram Direct

Status: **Ready for Testing** — Plugin implementation complete, Instagram Graph API integration ready, webhook handlers implemented.

## Install (on demand)

- Onboarding (`openclaw onboard`) and `openclaw channels add --channel instagram`
  prompt to install the Instagram plugin the first time you select it.
- `openclaw channels login --channel instagram` also offers the install flow when
  the plugin is not present yet.
- Dev channel + git checkout: defaults to the local plugin path `@openclaw/instagram`.
- Stable/Beta: defaults to the npm package `@openclaw/instagram`.

Manual install stays available:

```bash
openclaw plugins install @openclaw/instagram
```

<CardGroup cols={3}>
  <Card title="Meta Business Setup" icon="cog" href="#meta-business-configuration">
    Connect Instagram Business account, configure Graph API.
  </Card>
  <Card title="Webhook verification" icon="shield-check" href="#webhook-verification">
    HMAC signature verification for Instagram webhooks.
  </Card>
  <Card title="Channel troubleshooting" icon="wrench" href="/channels/troubleshooting">
    Cross-channel diagnostics and repair playbooks.
  </Card>
</CardGroup>

## Prerequisites

- **Instagram Business Account** (personal accounts don't support API messaging)
- **Facebook Page** linked to Instagram Business account
- **Meta Developer App** with Instagram Graph API product

## Meta Business Configuration

<Steps>
  <Step title="Convert to Business Account">

1. Open Instagram app → Settings → Account
2. Select **Switch to Professional Account**
3. Choose **Business** category
4. Connect to existing Facebook Page (or create new)

  </Step>

  <Step title="Create Meta App">

1. Access [Meta for Developers](https://developers.facebook.com/)
2. Create new app → Select **Business** use case
3. Add **Instagram Graph API** product to app
4. Note **App ID** and **App Secret** from Dashboard

  </Step>

  <Step title="Configure OAuth">

1. Go to **Settings → Basic** in Meta Dashboard
2. Add **Valid OAuth Redirect URIs**:
   ```
   https://your-gateway-domain.com/oauth/instagram/callback
   ```
3. Enable **Embedded Browser OAuth** for testing
4. Set **App Domain** to your gateway domain

  </Step>

  <Step title="Configure Webhooks">

1. Go to **Instagram Graph API → Settings → Webhooks**
2. Click **Add Callback URL**:
   - **Callback URL**: `https://your-gateway-domain.com/webhooks/meta/instagram`
   - **Verify Token**: `<YOUR_VERIFY_TOKEN>` (generate secure random string)
3. Subscribe to fields:
   - `messages`
   - `messaging_handovers`
   - `story_mention`

  </Step>

  <Step title="Generate Instagram Access Token">

1. Go to **Instagram Graph API → Settings → Access Tokens**
2. Click **Generate Access Token**
3. Select Instagram Business account
4. Copy generated token (store securely)
5. Note **Instagram Account ID** (numeric IGSC ID)

  </Step>

  <Step title="Configure OpenClaw">

```bash
openclaw config set channels.instagram.enabled true
openclaw config set channels.instagram.accounts.primary "your-instagram-account-id"
openclaw config set channels.instagram.webhook.verifyToken "<YOUR_VERIFY_TOKEN>"
openclaw config set channels.instagram.auth.accessToken "<YOUR_IG_ACCESS_TOKEN>"
openclaw config set channels.instagram.auth.appId "<YOUR_APP_ID>"
openclaw config set channels.instagram.auth.appSecret "<YOUR_APP_SECRET>"
```

  </Step>

  <Step title="Start the gateway">

```bash
openclaw gateway
```

  </Step>

  <Step title="Test webhook">

Send a test DM to your Instagram Business account. Verify in gateway logs:

```bash
openclaw logs --channel instagram
```

  </Step>
</Steps>

## Configuration Reference

### Minimal config

```json5
{
  channels: {
    instagram: {
      enabled: true,
      accounts: {
        primary: "your-instagram-account-id",
      },
      webhook: {
        path: "/webhooks/meta/instagram",
        verifyToken: "<YOUR_VERIFY_TOKEN>",
      },
      auth: {
        appId: "<YOUR_APP_ID>",
        appSecret: "<YOUR_APP_SECRET>",
        accessToken: "<YOUR_IG_ACCESS_TOKEN>",
      },
    },
  },
}
```

### Access control policies

```json5
{
  channels: {
    instagram: {
      // ... other config
      dmPolicy: "allow",           // "allow" | "deny"
      allowFrom: ["igsc-allowed-user-1", "igsc-allowed-user-2"],
      responseWindowHours: 24,     // Instagram 24h messaging window
    },
  },
}
```

### Multi-account setup (multiple brands)

```json5
{
  channels: {
    instagram: {
      accounts: {
        primary: "ig-account-id-1",
        secondary: "ig-account-id-2",
        campaign: "ig-account-id-3",
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

Instagram webhooks use HMAC-SHA1 signature verification (same as Messenger).

### Verification flow

1. Instagram sends `X-Hub-Signature` header with each webhook
2. Gateway computes HMAC using `appSecret`
3. Gateway compares signatures (constant-time)
4. Invalid signatures are rejected with 401

### Manual verification test

```bash
# Generate test payload
curl -X POST https://your-gateway-domain.com/webhooks/meta/instagram \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: sha1=<COMPUTED_HMAC>" \
  -d '{"object":"instagram","entry":[{"id":"ig-account-id","time":1234567890,"messaging":[]}]}'
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

- `instagram_basic` — Read basic Instagram account info
- `instagram_manage_messages` — Send/receive Instagram messages
- `pages_read_engagement` — Read Page engagement (required for Business linking)
- `pages_manage_metadata` — Manage linked Facebook Page

### Token refresh

Instagram access tokens expire after 60 days (long-lived). Gateway automatically refreshes tokens 5 days before expiry.

## Message Types

### Supported inbound

- Text messages
- Images, videos
- Stickers
- Emoji reactions
- Story mentions
- Message requests (pending until accepted)

### Supported outbound

- Text messages
- Images, videos
- Quick replies
- Story replies

### Not supported (Instagram restrictions)

- Unsolicited messages to users who haven't interacted first
- Messages outside 24h window (no message tags for Instagram)
- Broadcast messages
- Buttons/templates (Instagram doesn't support rich messaging like Messenger)

## 24-Hour Messaging Window

Instagram enforces a strict 24-hour session window:

- **User initiates**: 24h window opens for free-form replies
- **After 24h**: Cannot message user unless they message again
- **No message tags**: Unlike Messenger, Instagram doesn't support message tags for outside-window messaging

Gateway tracks session windows per IGSC (Instagram Secure Customer ID). Attempts to send outside window return error.

## Story Mentions

When users mention your Business account in their story:

1. Webhook triggers with `story_mention` event
2. Gateway receives story ID and user info
3. You have 24h to reply via story message

### Handle story mention

```typescript
// In your automation flow
if (message.content.type === "story_mention") {
  await sendInstagramMessage({
    accountId: "your-ig-account",
    to: message.from.id,
    content: {
      type: "story_reply",
      storyId: message.content.storyId,
      text: "Thanks for the mention!",
    },
  });
}
```

## Troubleshooting

### Webhook not receiving messages

1. Verify Instagram account is **Business** (not Personal/Creator)
2. Check Facebook Page is linked to Instagram account
3. Verify webhook URL shows green checkmark in Meta Dashboard
4. Check `verifyToken` matches in config
5. Check gateway logs: `openclaw logs --channel instagram --verbose`

### "Unsupported message type" error

Instagram has stricter message type support than Messenger. Verify:

- Not sending buttons/templates (not supported)
- Not sending outside 24h window
- User has active conversation (not blocked/restricted)

### Token expired

```bash
# Re-generate token in Meta Dashboard
openclaw config set channels.instagram.auth.accessToken "<NEW_TOKEN>"
openclaw gateway restart
```

### Message delivery failed

Check error codes:

- `#368` — Action blocked (user blocked account)
- `#130429` — Rate limited
- `#131046` — Outside 24h window
- `#2853004` — Instagram account not Business

## Testing

### Send test message

```bash
openclaw message send --channel instagram \
  --account "your-instagram-account-id" \
  --to "igsc-recipient" \
  --text "Hello from OpenClaw"
```

### Simulate inbound webhook

```bash
curl -X POST https://your-gateway-domain.com/webhooks/meta/instagram \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: sha1=<VALID_HMAC>" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "ig-account-id",
      "time": 1234567890,
      "messaging": [{
        "sender": {"id": "igsc-sender"},
        "recipient": {"id": "igsc-page"},
        "timestamp": 1234567890,
        "message": {"mid": "ig-mid-123", "text": "Hello"}
      }]
    }]
  }'
```

### Test story mention

```bash
curl -X POST https://your-gateway-domain.com/webhooks/meta/instagram \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: sha1=<VALID_HMAC>" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "ig-account-id",
      "time": 1234567890,
      "story_mention": [{
        "sender": {"id": "igsc-sender"},
        "recipient": {"id": "igsc-page"},
        "timestamp": 1234567890,
        "story_id": "story-123"
      }]
    }]
  }'
```

## Security Considerations

- **Never commit** `appSecret`, `accessToken`, or `verifyToken` to version control
- Rotate tokens every 90 days minimum
- Use separate Meta apps for production vs staging
- Monitor webhook logs for suspicious activity
- Instagram messages may contain sensitive content — enable encryption at rest

## Instagram vs Messenger Differences

| Feature | Instagram | Messenger |
|---------|-----------|-----------|
| Account type | Business only | Any Page |
| 24h window | Strict (no tags) | Flexible (with tags) |
| Rich messages | No (text/media only) | Yes (buttons, templates) |
| Story mentions | ✅ Supported | ❌ N/A |
| Message requests | Pending until accepted | Delivered immediately |
| Broadcast API | ❌ Not available | ✅ Available |

## Related

- [Messenger](/channels/messenger) — Facebook Messenger integration
- [Threads](/channels/threads) — Threads integration
- [WhatsApp](/channels/whatsapp) — WhatsApp integration
- [Meta Platforms Setup](/platforms/meta) — Complete Meta stack configuration
