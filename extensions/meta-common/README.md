# @openclaw/meta-common

Shared utilities for Meta Platform plugins (Facebook Messenger, Instagram, Threads).

## Installation

```bash
pnpm add @openclaw/meta-common
```

## Features

- 🔐 **OAuth 2.0 Flow** - Complete authentication flow with token refresh
- 🌐 **Graph API Client** - HTTP client with rate limiting and retry logic
- 🪝 **Webhook Manager** - Registration, verification, and signature validation
- 📝 **TypeScript Types** - Full type safety for all Meta Platform APIs
- ✅ **Zod Schemas** - Runtime validation for configurations

## Usage

### Authentication

```typescript
import { MetaAuthManager } from '@openclaw/meta-common';

const auth = new MetaAuthManager({
  appId: 'your-app-id',
  appSecret: 'your-app-secret',
  redirectUri: 'https://your-domain.com/callback'
});

// Generate OAuth URL
const oauthUrl = auth.generateOAuthUrl({
  scope: ['pages_manage_metadata', 'pages_read_engagement']
});

// Exchange code for token
const tokenInfo = await auth.exchangeCodeForToken(code);

// Validate token
const isValid = await auth.validateToken(tokenInfo.accessToken);
```

### Graph API Client

```typescript
import { MetaGraphApiClient } from '@openclaw/meta-common';

const client = new MetaGraphApiClient({
  accessToken: 'your-access-token',
  apiVersion: 'v21.0'
});

// GET request
const pageInfo = await client.get('/123456789', {
  fields: 'name,picture,followers_count'
});

// POST request
await client.post('/123456789/messages', {
  recipient: { id: 'user-id' },
  message: { text: 'Hello!' }
});

// Upload media
const mediaId = await client.uploadMedia('image', imageUrl, '123456789');
```

### Webhook Manager

```typescript
import { WebhookManager } from '@openclaw/meta-common';

const webhook = new WebhookManager({
  appId: 'your-app-id',
  appSecret: 'your-app-secret',
  accessToken: 'your-access-token'
});

// Verify webhook subscription (GET request)
const challenge = webhook.verifyWebhook({
  'hub.mode': 'subscribe',
  'hub.verify_token': 'your-verify-token',
  'hub.challenge': 'challenge-string'
}, 'your-verify-token');

// Validate signature
const isValid = webhook.validateSignature(rawBody, signature);

// Register webhook
await webhook.registerWebhook(
  'https://your-domain.com/webhooks/messenger',
  'your-verify-token',
  'page'
);
```

## API Reference

### MetaAuthManager

- `generateOAuthUrl(params)` - Generate OAuth authorization URL
- `exchangeCodeForToken(code)` - Exchange code for access token
- `refreshLongLivedToken(token)` - Get 60-day token
- `validateToken(token)` - Validate and get token info
- `needsRefresh(tokenInfo)` - Check if token needs refresh
- `revokeToken(token)` - Revoke access token

### MetaGraphApiClient

- `get(path, params)` - GET request
- `post(path, data, params)` - POST request
- `delete(path, params)` - DELETE request
- `uploadMedia(type, file, accountId)` - Upload image/video
- `getPaginated(path, params, limit)` - Get paginated results

### WebhookManager

- `verifyWebhook(params, expectedToken)` - Verify subscription
- `validateSignature(body, signature)` - Validate HMAC signature
- `registerWebhook(url, token, object, fields)` - Register webhook
- `unsubscribeWebhook(id)` - Remove webhook
- `listSubscriptions()` - List all webhooks
- `isSubscribed(url, object)` - Check subscription status

## Types

```typescript
import type {
  MetaPlatform,
  InboundMessage,
  OutboundMessage,
  MetaAccountConfig,
  MessengerAccountConfig,
  InstagramAccountConfig,
  ThreadsAccountConfig
} from '@openclaw/meta-common';
```

## Error Handling

```typescript
import { MetaApiError, MetaErrorCode, isRetryableError } from '@openclaw/meta-common';

try {
  await client.post('/messages', data);
} catch (error) {
  if (error instanceof MetaApiError) {
    console.log('Error code:', error.code);
    console.log('Retryable:', error.retryable);
    
    if (error.code === MetaErrorCode.RATE_LIMIT) {
      // Handle rate limit
    }
  }
  
  if (isRetryableError(error)) {
    // Retry logic
  }
}
```

## Rate Limiting

The Graph API client includes automatic rate limiting with exponential backoff:

- Default max retries: 5
- Base delay: 1 second
- Max delay: 60 seconds
- Backoff factor: 2

Configure custom limits:

```typescript
const client = new MetaGraphApiClient({
  accessToken: 'token',
  rateLimit: {
    maxRetries: 10,
    baseDelayMs: 500,
    maxDelayMs: 30000
  }
});
```

## License

MIT
