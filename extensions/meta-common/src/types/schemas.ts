/**
 * Zod schemas for Meta Platform configurations
 */

import { z } from "zod";

/**
 * Base Meta account config schema
 */
export const metaAccountConfigSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  accessToken: z.string().min(1, "Access token is required"),
  appSecret: z.string().min(1, "App secret is required"),
  verifyToken: z.string().min(1, "Verify token is required"),
  webhookPath: z.string().default("/webhooks/meta"),
  appId: z.string().optional(),
  apiVersion: z.string().default("v21.0"),
});

/**
 * Messenger account config schema
 */
export const messengerAccountConfigSchema = metaAccountConfigSchema.extend({
  platform: z.literal("messenger"),
  pageId: z.string().min(1, "Page ID is required"),
  persistentMenu: z.boolean().default(false),
  sendReadReceipts: z.boolean().default(true),
  showTypingIndicator: z.boolean().default(true),
});

/**
 * Instagram account config schema
 */
export const instagramAccountConfigSchema = metaAccountConfigSchema.extend({
  platform: z.literal("instagram"),
  instagramAccountId: z.string().min(1, "Instagram Account ID is required"),
  facebookPageId: z.string().min(1, "Facebook Page ID is required"),
  responseWindowHours: z.number().default(24),
  autoReply: z
    .object({
      enabled: z.boolean().default(false),
      message: z.string().default(""),
    })
    .optional(),
});

/**
 * Threads account config schema
 */
export const threadsAccountConfigSchema = metaAccountConfigSchema.extend({
  platform: z.literal("threads"),
  threadsUserId: z.string().min(1, "Threads User ID is required"),
  defaultReplyControl: z.enum(["everyone", "mentioned", "none"]).default("everyone"),
  textLimit: z.number().default(500),
});

/**
 * Union schema for any Meta account config
 */
export const anyMetaAccountConfigSchema = z.discriminatedUnion("platform", [
  messengerAccountConfigSchema,
  instagramAccountConfigSchema,
  threadsAccountConfigSchema,
]);

/**
 * Sender schema
 */
export const senderSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  profilePic: z.string().url().optional(),
  locale: z.string().optional(),
  timezone: z.number().optional(),
});

/**
 * Media attachment schema
 */
export const mediaAttachmentSchema = z.object({
  type: z.enum(["image", "video", "audio", "file", "sticker"]),
  url: z.string().optional(),
  fileId: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  caption: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  duration: z.number().optional(),
});

/**
 * Quick reply schema
 */
export const quickReplySchema = z.object({
  title: z.string().max(20),
  payload: z.string().max(1000),
  iconUrl: z.string().url().optional(),
  externalPayload: z.string().optional(),
});

/**
 * Inbound message schema
 */
export const inboundMessageSchema = z.object({
  id: z.string(),
  platform: z.enum(["messenger", "instagram", "threads"]),
  accountId: z.string(),
  from: senderSchema,
  to: z.string(),
  text: z.string().optional(),
  attachments: z.array(mediaAttachmentSchema).optional(),
  quickReplyPayload: z.string().optional(),
  postbackPayload: z.string().optional(),
  timestamp: z.number(),
  raw: z.record(z.string(), z.any()),
  metadata: z.record(z.string(), z.any()),
});

/**
 * Outbound message schema
 */
export const outboundMessageSchema = z.object({
  to: z.string(),
  platform: z.enum(["messenger", "instagram", "threads"]),
  accountId: z.string(),
  text: z.string().optional(),
  attachments: z.array(mediaAttachmentSchema).optional(),
  quickReplies: z.array(quickReplySchema).optional(),
  tag: z.enum(["UTILITY", "ALERT", "RESPONSE", "HUMAN_AGENT"]).optional(),
  replyToId: z.string().optional(),
  options: z.record(z.string(), z.any()).optional(),
});

/**
 * Token info schema
 */
export const tokenInfoSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.number(),
  scopes: z.array(z.string()),
  accountId: z.string(),
  encrypted: z.boolean(),
});

/**
 * OAuth params schema
 */
export const oauthParamsSchema = z.object({
  appId: z.string(),
  redirectUri: z.string().url(),
  scope: z.array(z.string()),
  state: z.string().optional(),
  responseType: z.enum(["code", "token"]).default("code"),
});

/**
 * Webhook subscription schema
 */
export const webhookSubscriptionSchema = z.object({
  id: z.string(),
  object: z.string(),
  callbackUrl: z.string().url(),
  fields: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.number(),
});

// Export types inferred from schemas
export type MetaAccountConfigInput = z.infer<typeof metaAccountConfigSchema>;
export type MessengerAccountConfigInput = z.infer<typeof messengerAccountConfigSchema>;
export type InstagramAccountConfigInput = z.infer<typeof instagramAccountConfigSchema>;
export type ThreadsAccountConfigInput = z.infer<typeof threadsAccountConfigSchema>;
export type AnyMetaAccountConfigInput = z.infer<typeof anyMetaAccountConfigSchema>;
