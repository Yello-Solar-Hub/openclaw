/**
 * Meta Platform types
 * Shared types for Facebook Messenger, Instagram, and Threads plugins
 */

/**
 * Supported Meta platforms
 */
export type MetaPlatform = 'messenger' | 'instagram' | 'threads';

/**
 * Base interface for all Meta account configurations
 */
export interface MetaAccountConfig {
  /** Unique account identifier */
  accountId: string;
  /** Meta Graph API access token */
  accessToken: string;
  /** Meta App Secret for webhook validation */
  appSecret: string;
  /** Webhook verify token */
  verifyToken: string;
  /** Webhook callback path */
  webhookPath: string;
  /** Meta App ID */
  appId?: string;
  /** Graph API version (default: "v21.0") */
  apiVersion?: string;
}

/**
 * Facebook Messenger specific configuration
 */
export interface MessengerAccountConfig extends MetaAccountConfig {
  platform: 'messenger';
  /** Facebook Page ID */
  pageId: string;
  /** Enable persistent menu */
  persistentMenu?: boolean;
  /** Enable read receipts */
  sendReadReceipts?: boolean;
  /** Enable typing indicators */
  showTypingIndicator?: boolean;
}

/**
 * Instagram specific configuration
 */
export interface InstagramAccountConfig extends MetaAccountConfig {
  platform: 'instagram';
  /** Instagram Business Account ID */
  instagramAccountId: string;
  /** Linked Facebook Page ID */
  facebookPageId: string;
  /** DM response window in hours (default: 24) */
  responseWindowHours?: number;
  /** Enable auto-reply for first message */
  autoReply?: {
    enabled: boolean;
    message: string;
  };
}

/**
 * Threads specific configuration
 */
export interface ThreadsAccountConfig extends MetaAccountConfig {
  platform: 'threads';
  /** Threads User ID */
  threadsUserId: string;
  /** Default reply control */
  defaultReplyControl?: 'everyone' | 'mentioned' | 'none';
  /** Text character limit (default: 500) */
  textLimit?: number;
}

/**
 * Union type for all Meta account configs
 */
export type AnyMetaAccountConfig =
  | MessengerAccountConfig
  | InstagramAccountConfig
  | ThreadsAccountConfig;

/**
 * Sender information
 */
export interface Sender {
  /** Platform-specific sender ID */
  id: string;
  /** Sender name (if available) */
  name?: string;
  /** Profile picture URL (if available) */
  profilePic?: string;
  /** Locale (if available) */
  locale?: string;
  /** Timezone (if available) */
  timezone?: number;
}

/**
 * Media attachment types
 */
export type AttachmentType = 'image' | 'video' | 'audio' | 'file' | 'sticker';

/**
 * Media attachment
 */
export interface MediaAttachment {
  type: AttachmentType;
  /** URL or file path */
  url?: string;
  /** File ID (for reuse) */
  fileId?: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  size?: number;
  /** Caption text */
  caption?: string;
  /** Thumbnail URL (for video) */
  thumbnailUrl?: string;
  /** Duration in seconds (for audio/video) */
  duration?: number;
}

/**
 * Quick reply button
 */
export interface QuickReply {
  /** Button text (max 20 chars) */
  title: string;
  /** Payload sent when clicked (max 1000 chars) */
  payload: string;
  /** Icon URL (optional) */
  iconUrl?: string;
  /** External payload for webview (optional) */
  externalPayload?: string;
}

/**
 * Inbound message from any Meta platform
 */
export interface InboundMessage {
  /** Unique message ID */
  id: string;
  /** Platform source */
  platform: MetaPlatform;
  /** Account ID that received the message */
  accountId: string;
  /** Sender information */
  from: Sender;
  /** Recipient ID */
  to: string;
  /** Message text (if text message) */
  text?: string;
  /** Attachments (if media message) */
  attachments?: MediaAttachment[];
  /** Quick reply payload (if clicked) */
  quickReplyPayload?: string;
  /** Postback payload (if button clicked) */
  postbackPayload?: string;
  /** Message timestamp (Unix ms) */
  timestamp: number;
  /** Raw platform-specific payload */
  raw: Record<string, any>;
  /** Additional metadata */
  metadata: {
    mid?: string;
    seq?: number;
    isEcho?: boolean;
    replyTo?: string;
    [key: string]: any;
  };
}

/**
 * Outbound message to any Meta platform
 */
export interface OutboundMessage {
  /** Recipient ID */
  to: string;
  /** Platform target */
  platform: MetaPlatform;
  /** Account ID to send from */
  accountId: string;
  /** Message text */
  text?: string;
  /** Attachments */
  attachments?: MediaAttachment[];
  /** Quick replies */
  quickReplies?: QuickReply[];
  /** Message tag (for 24h rule bypass) */
  tag?: 'UTILITY' | 'ALERT' | 'RESPONSE' | 'HUMAN_AGENT';
  /** Reply to message ID (for threading) */
  replyToId?: string;
  /** Additional options */
  options?: {
    /** Show typing indicator */
    typing?: boolean;
    /** Send read receipt */
    readReceipt?: boolean;
    /** Message category */
    category?: string;
    [key: string]: any;
  };
}

/**
 * Message delivery status
 */
export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Delivery confirmation
 */
export interface DeliveryConfirmation {
  messageId: string;
  status: DeliveryStatus;
  timestamp: number;
  error?: string;
}

/**
 * Token information
 */
export interface TokenInfo {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
  accountId: string;
  encrypted: boolean;
}

/**
 * OAuth parameters
 */
export interface OAuthParams {
  appId: string;
  redirectUri: string;
  scope: string[];
  state?: string;
  responseType?: 'code' | 'token';
}

/**
 * Webhook subscription
 */
export interface WebhookSubscription {
  id: string;
  object: string;
  callbackUrl: string;
  fields: string[];
  active: boolean;
  createdAt: number;
}

/**
 * API response envelope
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
    type?: string;
    fbtraceId?: string;
  };
}

/**
 * Pagination cursor
 */
export interface PaginationCursor {
  before?: string;
  after?: string;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  paging: PaginationCursor;
}
