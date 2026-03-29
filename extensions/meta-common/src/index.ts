/**
 * @openclaw/meta-common
 * 
 * Shared utilities for Meta Platform plugins
 * (Facebook Messenger, Instagram, Threads)
 */

// Auth module
export {
  MetaAuthManager,
  createMetaAuthManager,
  type MetaAuthManagerOptions,
  MetaApiError,
  MetaErrorCode,
  ErrorSeverity,
  WebhookValidationError,
  RateLimitError,
  isRetryableError
} from './auth/index.js';

// HTTP module
export {
  MetaGraphApiClient,
  createGraphApiClient,
  type MetaGraphApiClientOptions,
  type RateLimitConfig,
  type MediaUploadResponse
} from './http/index.js';

// Webhook module
export {
  WebhookManager,
  createWebhookManager,
  type WebhookManagerOptions,
  type WebhookVerificationParams,
  SUBSCRIPTION_FIELDS
} from './webhook/index.js';

// Types
export type {
  MetaPlatform,
  MetaAccountConfig,
  MessengerAccountConfig,
  InstagramAccountConfig,
  ThreadsAccountConfig,
  AnyMetaAccountConfig,
  Sender,
  AttachmentType,
  MediaAttachment,
  QuickReply,
  InboundMessage,
  OutboundMessage,
  DeliveryStatus,
  DeliveryConfirmation,
  TokenInfo,
  OAuthParams,
  WebhookSubscription,
  ApiResponse,
  PaginationCursor,
  PaginatedResponse
} from './types/index.js';

// Schemas
export {
  metaAccountConfigSchema,
  messengerAccountConfigSchema,
  instagramAccountConfigSchema,
  threadsAccountConfigSchema,
  anyMetaAccountConfigSchema,
  senderSchema,
  mediaAttachmentSchema,
  quickReplySchema,
  inboundMessageSchema,
  outboundMessageSchema,
  tokenInfoSchema,
  oauthParamsSchema,
  webhookSubscriptionSchema
} from './types/schemas.js';

// Version
export const VERSION = '0.1.0';
