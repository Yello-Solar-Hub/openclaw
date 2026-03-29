---
summary: "Facebook Messenger channel support, access controls, webhook setup, and operations"
read_when:
  - Working on Messenger channel behavior or inbox routing
title: "Messenger"
---

# Facebook Messenger

Status: **Ready for Testing** — Plugin implementation complete, webhook handlers implemented, OAuth flow ready.

## Install (on demand)

- Onboarding (`openclaw onboard`) and `openclaw channels add --channel messenger`
  prompt to install the Messenger plugin the first time you select it.
- `openclaw channels login --channel messenger` also offers the install flow when
  the plugin is not present yet.
- Dev channel + git checkout: defaults to the local plugin path `@openclaw/messenger`.
- Stable/Beta: defaults to the npm package `@openclaw/messenger`.

Manual install stays available:

```bash
openclaw plugins install @openclaw/messenger
```

<CardGroup cols={3}>
  <Card title="Meta App Setup" icon="cog" href="#meta-app-configuration">
    Create Meta app, configure OAuth, webhooks.
  </Card>
  <Card title="Webhook verification" icon="shield-check" href="#webhook-verification">
    HMAC signature verification and verify tokens.
  </Card>
  <Card title="Channel troubleshooting" icon="wrench" href="/channels/troubleshooting">
    Cross-channel diagnostics and repair playbooks.
  </Card>
</CardGroup>

## Meta App Configuration

<Steps>
  <Step title="Create Meta App">

1. Access [Meta for Developers](https://developers.facebook.com/)
2. Create new app → Select **Business** use case
3. Add **Messenger** product to app
4. Note **App ID** and **App Secret** from Dashboard

  </Step>

  <Step title="Configure OAuth">

1. Go to **Settings → Basic** in Meta Dashboard
2. Add **Valid OAuth Redirect URIs**:
   ```
   https://your-gateway-domain.com/oauth/messenger/callback
   ```
3. Enable **Embedded Browser OAuth** for testing
4. Set **App Domain** to your gateway domain

  </Step>

  <Step title="Configure Webhooks">

1. Go to **Messenger → Settings → Webhooks**
2. Click **Add Callback URL**:
   - **Callback URL**: `https://your-gateway-domain.com/webhooks/meta/messenger`
   - **Verify Token**: `<YOUR_VERIFY_TOKEN>` (generate secure random string)
3. Subscribe to fields:
   - `messages`
   - `messaging_postbacks`
   - `messaging_optins`
   - `messaging_referrals`

  </Step>

  <Step title="Generate Page Access Token">

1. Go to **Messenger → Settings → Access Tokens**
2. Click **Generate Access Token**
3. Select Facebook Page to connect
4. Copy generated token (store securely)

  </Step>

  <Step title="Configure OpenClaw">

```bash
openclaw config set channels.messenger.enabled true
openclaw config set channels.messenger.accounts.primary "your-page-id"
openclaw config set channels.messenger.webhook.verifyToken "<YOUR_VERIFY_TOKEN>"
openclaw config set channels.messenger.auth.accessToken "<YOUR_PAGE_ACCESS_TOKEN>"
openclaw config set channels.messenger.auth.appId "<YOUR_APP_ID>"
openclaw config set channels.messenger.auth.appSecret "<YOUR_APP_SECRET>"
```

  </Step>

  <Step title="Start the gateway">

```bash
openclaw gateway
```

  </Step>

  <Step title="Test webhook">

Send a test message to your Facebook Page. Verify in gateway logs:

```bash
openclaw logs --channel messenger
```

  </Step>
</Steps>

## Configuration Reference

### Minimal config

```json5
{
  channels: {
    messenger: {
      enabled: true,
      accounts: {
        primary: "your-page-id",
      },
      webhook: {
        path: "/webhooks/meta/messenger",
        verifyToken: "<YOUR_VERIFY_TOKEN>",
      },
      auth: {
        appId: "<YOUR_APP_ID>",
        appSecret: "<YOUR_APP_SECRET>",
        accessToken: "<YOUR_PAGE_ACCESS_TOKEN>",
      },
    },
  },
}
```

### Access control policies

```json5
{
  channels: {
    messenger: {
      // ... other config
      dmPolicy: "allow",           // "allow" | "deny" | "pairing"
      allowFrom: ["psid-allowed-user-1", "psid-allowed-user-2"],
      responseWindowHours: 24,     // Meta 24h messaging window
      defaultReplyControl: "standard", // "standard" | "reply_only"
    },
  },
}
```

### Multi-account setup

```json5
{
  channels: {
    messenger: {
      accounts: {
        primary: "page-id-1",
        secondary: "page-id-2",
        support: "page-id-3",
      },
      // Per-account overrides
      accountConfigs: {
        support: {
          dmPolicy: "allow",
          responseWindowHours: 12,
        },
      },
    },
  },
}
```

## Webhook Verification

Messenger webhooks use HMAC-SHA1 signature verification.

### Verification flow

1. Meta sends `X-Hub-Signature` header with each webhook
2. Gateway computes HMAC using `appSecret`
3. Gateway compares signatures (constant-time)
4. Invalid signatures are rejected with 401

### Manual verification test

```bash
# Generate test payload
curl -X POST https://your-gateway-domain.com/webhooks/meta/messenger \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: sha1=<COMPUTED_HMAC>" \
  -d '{"object":"page","entry":[{"id":"page-id","time":1234567890,"messaging":[]}]}'
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

- `pages_manage_metadata` — Manage Pages you administer
- `pages_read_engagement` — Read Page engagement data
- `pages_messaging` — Send/receive messages via Page

### Token refresh

Access tokens expire after 60 days (long-lived) or 1-2 hours (short-lived).
Gateway automatically refreshes tokens 5 days before expiry.

## Message Types

### Supported inbound

- Text messages
- Images, videos, audio, files
- Stickers
- Location
- Reactions
- Postbacks (button clicks)
- Quick replies

### Supported outbound

- Text messages
- Images, videos, audio, files
- Buttons (postback, URL, phone)
- Quick replies
- Templates (generic, list)
- Reactions

### Not supported (Meta restrictions)

- Unsolicited messages outside 24h window (requires Message Tags)
- Broadcast without approved use case
- Marketing messages to users who opted out

## 24-Hour Messaging Window

Meta enforces a 24-hour session window for standard messages:

- **Within 24h**: Free-form messaging allowed
- **After 24h**: Only message tags allowed (non-promotional, event updates, etc.)

Gateway tracks session windows per PSID. Attempts to send outside window return error.

### Message Tags (outside 24h)

```json5
{
  channels: {
    messenger: {
      messageTags: {
        enabled: true,
        allowedTags: [
          "CONFIRMED_EVENT_UPDATE",
          "ISSUE_RESOLUTION",
          "APPLICATION_UPDATE",
          "TRANSPORTATION_UPDATE",
        ],
      },
    },
  },
}
```

## Troubleshooting

### Webhook not receiving messages

1. Verify webhook URL is publicly accessible
2. Check **Messenger → Settings → Webhooks** shows green checkmark
3. Verify `verifyToken` matches in Meta Dashboard and config
4. Check gateway logs: `openclaw logs --channel messenger --verbose`

### OAuth token expired

```bash
# Re-generate token in Meta Dashboard
openclaw config set channels.messenger.auth.accessToken "<NEW_TOKEN>"
openclaw gateway restart
```

### Message delivery failed

Check error codes:

- `#368` — Action blocked (user blocked Page)
- `#130429` — Rate limited
- `#131046` — Outside 24h window without tag

## Testing

### Send test message

```bash
openclaw message send --channel messenger \
  --account "your-page-id" \
  --to "psid-recipient" \
  --text "Hello from OpenClaw"
```

### Simulate inbound webhook

```bash
curl -X POST https://your-gateway-domain.com/webhooks/meta/messenger \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: sha1=<VALID_HMAC>" \
  -d '{
    "object": "page",
    "entry": [{
      "id": "page-id",
      "time": 1234567890,
      "messaging": [{
        "sender": {"id": "psid-sender"},
        "recipient": {"id": "psid-page"},
        "timestamp": 1234567890,
        "message": {"mid": "mid-123", "text": "Hello"}
      }]
    }]
  }'
```

## Security Considerations

- **Never commit** `appSecret`, `accessToken`, or `verifyToken` to version control
- Rotate tokens every 90 days minimum
- Use separate Meta apps for production vs staging
- Enable **App Secret Proof** for additional security
- Monitor webhook logs for suspicious activity

## Related

- [Instagram](/channels/instagram) — Instagram DM integration
- [Threads](/channels/threads) — Threads integration
- [WhatsApp](/channels/whatsapp) — WhatsApp integration
- [Meta Platforms Setup](/platforms/meta) — Complete Meta stack configuration
