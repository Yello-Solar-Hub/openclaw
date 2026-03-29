/**
 * Instagram DM Plugin for OpenClaw
 * 
 * @package @openclaw/instagram
 */

import {
  defineChannelPluginEntry,
  createChatChannelPlugin,
  type PluginAPI
} from 'openclaw/plugin-sdk/core';
import { buildChannelConfigSchema } from 'openclaw/plugin-sdk/channel-config-schema';
import { z } from 'zod';
import {
  MetaGraphApiClient,
  WebhookManager,
  type InboundMessage as BaseInboundMessage
} from '@openclaw/meta-common';

// ============================================================================
// Config Schema
// ============================================================================

const accountSchema = z.object({
  enabled: z.boolean().default(true),
  instagramAccountId: z.string().min(1, 'Instagram Account ID is required'),
  facebookPageId: z.string().min(1, 'Facebook Page ID is required'),
  accessToken: z.string().min(1, 'Access token is required'),
  appSecret: z.string().min(1, 'App secret is required'),
  verifyToken: z.string().min(1, 'Verify token is required'),
  webhookPath: z.string().default('/webhooks/instagram'),
  responseWindowHours: z.number().default(24)
});

const channelConfigSchema = buildChannelConfigSchema(accountSchema);

// ============================================================================
// Plugin Entry
// ============================================================================

export default defineChannelPluginEntry({
  manifest: {
    id: 'instagram',
    name: 'Instagram DM',
    version: '0.1.0',
    configSchema: () => channelConfigSchema,
    setupEntry: './setup-entry'
  },

  async register(api: PluginAPI) {
    const accounts = new Map<string, { id: string; config: any; client: MetaGraphApiClient }>();
    const webhookManagers = new Map<string, WebhookManager>();

    // Initialize accounts from config
    async function initializeAccounts() {
      const config = await api.config.get('channels.instagram');
      const accountsConfig = config?.accounts || {};

      for (const [accountId, accountConfig] of Object.entries(accountsConfig)) {
        if (!accountConfig.enabled) continue;

        const validated = accountSchema.safeParse(accountConfig);
        if (!validated.success) {
          api.logger.warn(`Invalid config for Instagram account ${accountId}:`, validated.error);
          continue;
        }

        const client = new MetaGraphApiClient({
          accessToken: validated.data.accessToken,
          apiVersion: 'v21.0'
        });

        const webhook = new WebhookManager({
          appId: 'unknown',
          appSecret: validated.data.appSecret,
          accessToken: validated.data.accessToken
        });

        accounts.set(accountId, {
          id: accountId,
          config: validated.data,
          client
        });

        webhookManagers.set(accountId, webhook);
      }
    }

    // Parse inbound Instagram message
    function parseInboundMessage(accountId: string, payload: any): BaseInboundMessage | null {
      const entry = payload.entry?.[0];
      if (!entry || entry.id !== 'instagram') return null;

      const messaging = entry.messaging?.[0];
      if (!messaging) return null;

      const sender = messaging.sender;
      const message = messaging.message || {};

      return {
        id: message.mid || `ig_${Date.now()}`,
        platform: 'instagram',
        accountId,
        from: { id: sender.id },
        to: messaging.recipient.id,
        text: message.text,
        timestamp: messaging.timestamp || Date.now(),
        raw: payload,
        metadata: {}
      };
    }

    // Create channel plugin
    const instagramPlugin = createChatChannelPlugin({
      id: 'instagram',
      label: 'Instagram',
      setupEntry: './setup-entry',

      async inbound(params) {
        const { accountId, rawPayload } = params;
        const message = parseInboundMessage(accountId, rawPayload);
        
        if (!message) return null;

        return {
          id: message.id,
          from: message.from.id,
          text: message.text,
          metadata: { platform: 'instagram', accountId }
        };
      },

      async outbound(params) {
        const { accountId, message } = params;
        const account = accounts.get(accountId);
        
        if (!account) {
          throw new Error(`Instagram account ${accountId} not found`);
        }

        // Send via Instagram Graph API
        const result = await account.client.post(`/me/messages`, {
          recipient: { id: message.to },
          message: { text: message.text }
        });

        return {
          success: true,
          messageId: result.message_id,
          timestamp: Date.now()
        };
      },

      async getStatus(accountId) {
        const account = accounts.get(accountId);
        if (!account) return { status: 'not_configured' };

        try {
          await account.client.get(`/me?fields=id,name`);
          return { status: 'connected', accountId: account.id };
        } catch (error: any) {
          return { status: 'error', error: error.message };
        }
      },

      async login() {
        return { success: false, message: 'Use setup wizard' };
      },

      async logout(accountId) {
        accounts.delete(accountId);
        webhookManagers.delete(accountId);
        return { success: true };
      }
    });

    await initializeAccounts();
    api.registerChannel(instagramPlugin);

    // Webhook handlers
    api.registerHttpHandler({
      path: '/webhooks/instagram',
      method: 'GET',
      handler: async (req, res) => {
        const mode = req.query?.['hub.mode'];
        const token = req.query?.['hub.verify_token'];
        const challenge = req.query?.['hub.challenge'];

        if (mode === 'subscribe') {
          for (const account of accounts.values()) {
            if (account.config.verifyToken === token) {
              res.statusCode = 200;
              return challenge;
            }
          }
        }

        res.statusCode = 403;
        return 'Forbidden';
      }
    });

    api.registerHttpHandler({
      path: '/webhooks/instagram',
      method: 'POST',
      handler: async (req, res) => {
        try {
          const signature = req.headers['x-hub-signature-256'];
          const rawBody = JSON.stringify(req.body);

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
            res.statusCode = 403;
            return 'Invalid signature';
          }

          const body = req.body;
          if (body.object !== 'instagram') {
            res.statusCode = 404;
            return 'Not found';
          }

          // Process messages
          for (const entry of body.entry || []) {
            for (const account of accounts.values()) {
              if (account.config.instagramAccountId === entry.id) {
                const message = parseInboundMessage(account.id, { entry: [entry] });
                if (message) {
                  await api.routeMessage({
                    channelId: 'instagram',
                    accountId: account.id,
                    message
                  });
                }
              }
            }
          }

          res.statusCode = 200;
          return 'OK';
        } catch (error: any) {
          api.logger.error('Instagram webhook error:', error);
          res.statusCode = 500;
          return 'Internal server error';
        }
      }
    });
  }
});
