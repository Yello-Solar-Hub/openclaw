/**
 * Facebook Messenger Plugin for OpenClaw
 *
 * @package @openclaw/messenger
 */

import {
  MetaGraphApiClient,
  WebhookManager,
  MetaApiError,
  type InboundMessage as BaseInboundMessage,
  type OutboundMessage as BaseOutboundMessage,
} from "@openclaw/meta-common";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk/channel-config-schema";
import {
  defineChannelPluginEntry,
  createChatChannelPlugin,
  type PluginAPI,
  type ChannelSendResult,
  type InboundChatMessage,
  type OutboundChatMessage,
} from "openclaw/plugin-sdk/core";
import { z } from "zod";

// ============================================================================
// Config Schema
// ============================================================================

const accountSchema = z.object({
  enabled: z.boolean().default(true),
  pageId: z.string().min(1, "Page ID is required"),
  accessToken: z.string().min(1, "Access token is required"),
  appSecret: z.string().min(1, "App secret is required"),
  verifyToken: z.string().min(1, "Verify token is required"),
  webhookPath: z.string().default("/webhooks/messenger"),
  sendReadReceipts: z.boolean().default(true),
  showTypingIndicator: z.boolean().default(true),
});

const channelConfigSchema = buildChannelConfigSchema(accountSchema);

// ============================================================================
// Types
// ============================================================================

interface MessengerAccount {
  id: string;
  config: z.infer<typeof accountSchema>;
  client: MetaGraphApiClient;
}

interface InboundMessage extends BaseInboundMessage {
  platform: "messenger";
}

interface OutboundMessage extends BaseOutboundMessage {
  platform: "messenger";
}

// ============================================================================
// Plugin Entry
// ============================================================================

export default defineChannelPluginEntry({
  manifest: {
    id: "messenger",
    name: "Facebook Messenger",
    version: "0.1.0",
    configSchema: () => channelConfigSchema,
    setupEntry: "./setup-entry",
  },

  async register(api: PluginAPI) {
    const accounts = new Map<string, MessengerAccount>();
    const webhookManagers = new Map<string, WebhookManager>();

    // Initialize accounts from config
    async function initializeAccounts() {
      const config = await api.config.get("channels.messenger");
      const accountsConfig = config?.accounts || {};

      for (const [accountId, accountConfig] of Object.entries(accountsConfig)) {
        if (!accountConfig.enabled) continue;

        const validated = accountSchema.safeParse(accountConfig);
        if (!validated.success) {
          api.logger.warn(`Invalid config for Messenger account ${accountId}:`, validated.error);
          continue;
        }

        const client = new MetaGraphApiClient({
          accessToken: validated.data.accessToken,
          apiVersion: "v21.0",
        });

        const webhook = new WebhookManager({
          appId: "unknown",
          appSecret: validated.data.appSecret,
          accessToken: validated.data.accessToken,
        });

        accounts.set(accountId, {
          id: accountId,
          config: validated.data,
          client,
        });

        webhookManagers.set(accountId, webhook);
      }
    }

    // Parse inbound Messenger message
    function parseInboundMessage(accountId: string, payload: any): InboundMessage | null {
      const messaging = payload.entry?.[0]?.messaging?.[0];
      if (!messaging) return null;

      const sender = messaging.sender;
      const recipient = messaging.recipient;
      const message = messaging.message || {};

      // Skip echo messages (messages sent by the page itself)
      if (messaging.message?.is_echo) return null;

      // Parse attachments
      const attachments =
        message.attachments?.map((att: any) => ({
          type: att.type as "image" | "video" | "audio" | "file",
          url: att.payload?.url,
          fileId: att.payload?.fbid,
          mimeType: att.payload?.mime_type,
        })) || [];

      return {
        id: messaging.message?.mid || `msg_${Date.now()}`,
        platform: "messenger",
        accountId,
        from: {
          id: sender.id,
          name: sender.name,
          profilePic: sender.profile_pic,
        },
        to: recipient.id,
        text: message.text,
        attachments: attachments.length > 0 ? attachments : undefined,
        quickReplyPayload: message.quick_reply?.payload,
        postbackPayload: message.postback?.payload,
        timestamp: messaging.timestamp || Date.now(),
        raw: payload,
        metadata: {
          mid: message.mid,
          seq: message.seq,
          isEcho: message.is_echo,
        },
      };
    }

    // Send message via Messenger
    async function sendMessage(
      account: MessengerAccount,
      message: OutboundMessage,
    ): Promise<ChannelSendResult> {
      try {
        // Show typing indicator if enabled
        if (account.config.showTypingIndicator && message.text) {
          await account.client.post("/me/messages", {
            recipient: { id: message.to },
            sender_action: "typing_on",
          });

          // Turn off typing after 1s
          setTimeout(async () => {
            await account.client.post("/me/messages", {
              recipient: { id: message.to },
              sender_action: "typing_off",
            });
          }, 1000);
        }

        // Build message payload
        const payload: any = {
          recipient: { id: message.to },
          message: {},
        };

        // Text content
        if (message.text) {
          payload.message.text = message.text;
        }

        // Attachments
        if (message.attachments?.[0]) {
          const att = message.attachments[0];
          payload.message.attachment = {
            type: att.type,
            payload: {
              url: att.url || att.fileId,
            },
          };

          if (att.caption) {
            payload.message.text = att.caption;
          }
        }

        // Quick replies
        if (message.quickReplies?.length) {
          payload.message.quick_replies = message.quickReplies.map((qr) => ({
            content_type: "text",
            title: qr.title,
            payload: qr.payload,
          }));
        }

        // Message tag (for 24h rule)
        if (message.tag) {
          payload.messaging_type = message.tag;
        }

        // Send message
        const result = await account.client.post("/me/messages", payload);

        // Mark as read if enabled
        if (account.config.sendReadReceipts) {
          await account.client.post("/me/messages", {
            recipient: { id: message.to },
            sender_action: "mark_seen",
          });
        }

        return {
          success: true,
          messageId: result.message_id,
          timestamp: Date.now(),
          raw: result,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code?.toString(),
          raw: error,
        };
      }
    }

    // Create channel plugin
    const messengerPlugin = createChatChannelPlugin({
      id: "messenger",
      label: "Messenger",
      setupEntry: "./setup-entry",

      async inbound(params) {
        const { accountId, rawPayload } = params;

        const account = accounts.get(accountId);
        if (!account) {
          throw new Error(`Messenger account ${accountId} not found`);
        }

        const message = parseInboundMessage(accountId, rawPayload);
        if (!message) {
          return null;
        }

        return {
          id: message.id,
          from: message.from.id,
          text: message.text,
          attachments: message.attachments,
          metadata: {
            platform: "messenger",
            accountId: message.accountId,
            raw: message.raw,
          },
        };
      },

      async outbound(params) {
        const { accountId, message } = params;

        const account = accounts.get(accountId);
        if (!account) {
          throw new Error(`Messenger account ${accountId} not found`);
        }

        const result = await sendMessage(account, {
          ...message,
          platform: "messenger",
          accountId,
        });

        return result;
      },

      async getStatus(accountId) {
        const account = accounts.get(accountId);
        if (!account) {
          return { status: "not_configured" };
        }

        try {
          // Validate token
          await account.client.get(`/me?fields=id,name`);
          return {
            status: "connected",
            accountId: account.id,
            pageId: account.config.pageId,
            lastChecked: Date.now(),
          };
        } catch (error: any) {
          return {
            status: "error",
            error: error.message,
          };
        }
      },

      async login(accountId) {
        // For Messenger, login is handled via OAuth setup wizard
        // This is just a status check
        return {
          success: accounts.has(accountId),
          message: accounts.has(accountId) ? "Already configured" : "Please run setup wizard first",
        };
      },

      async logout(accountId) {
        const account = accounts.get(accountId);
        if (account) {
          accounts.delete(accountId);
          webhookManagers.delete(accountId);
        }

        return {
          success: true,
          message: "Logged out from Messenger",
        };
      },
    });

    // Initialize accounts on start
    await initializeAccounts();

    // Register channel
    api.registerChannel(messengerPlugin);

    // Expose webhook handler for HTTP server
    api.registerHttpHandler({
      path: "/webhooks/messenger",
      method: "GET",
      handler: async (req, res) => {
        // Webhook verification
        const mode = req.query?.["hub.mode"];
        const token = req.query?.["hub.verify_token"];
        const challenge = req.query?.["hub.challenge"];

        if (mode === "subscribe") {
          // Find account with matching verify token
          for (const [accountId, account] of accounts.entries()) {
            if (account.config.verifyToken === token) {
              api.logger.info(`Webhook verified for Messenger account ${accountId}`);
              res.statusCode = 200;
              return challenge;
            }
          }
        }

        res.statusCode = 403;
        return "Forbidden";
      },
    });

    api.registerHttpHandler({
      path: "/webhooks/messenger",
      method: "POST",
      handler: async (req, res) => {
        try {
          const signature = req.headers["x-hub-signature-256"];
          const rawBody = JSON.stringify(req.body);

          // Validate signature
          let validSignature = false;
          for (const webhook of webhookManagers.values()) {
            try {
              if (webhook.validateSignature(rawBody, signature as string)) {
                validSignature = true;
                break;
              }
            } catch {
              continue;
            }
          }

          if (!validSignature) {
            api.logger.warn("Invalid webhook signature");
            res.statusCode = 403;
            return "Invalid signature";
          }

          // Process webhook
          const body = req.body;

          if (body.object !== "page") {
            res.statusCode = 404;
            return "Not found";
          }

          // Find account by page ID
          const pageId = body.entry?.[0]?.id;
          let targetAccount: MessengerAccount | undefined;

          for (const account of accounts.values()) {
            if (account.config.pageId === pageId) {
              targetAccount = account;
              break;
            }
          }

          if (!targetAccount) {
            api.logger.warn(`No Messenger account found for page ${pageId}`);
            res.statusCode = 200;
            return "OK";
          }

          // Parse and route message
          const message = parseInboundMessage(targetAccount.id, body);

          if (message) {
            api.logger.debug(`Received Messenger message from ${message.from.id}`);

            // Route to agent
            await api.routeMessage({
              channelId: "messenger",
              accountId: targetAccount.id,
              message,
            });
          }

          res.statusCode = 200;
          return "OK";
        } catch (error: any) {
          api.logger.error("Webhook error:", error);
          res.statusCode = 500;
          return "Internal server error";
        }
      },
    });
  },
});
