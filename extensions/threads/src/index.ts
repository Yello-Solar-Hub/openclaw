/**
 * Threads API Plugin for OpenClaw
 * 
 * @package @openclaw/threads
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
  threadsUserId: z.string().min(1, 'Threads User ID is required'),
  accessToken: z.string().min(1, 'Access token is required'),
  appSecret: z.string().min(1, 'App secret is required'),
  verifyToken: z.string().min(1, 'Verify token is required'),
  webhookPath: z.string().default('/webhooks/threads'),
  defaultReplyControl: z.enum(['everyone', 'mentioned', 'none']).default('everyone')
});

const channelConfigSchema = buildChannelConfigSchema(accountSchema);

// ============================================================================
// Plugin Entry
// ============================================================================

export default defineChannelPluginEntry({
  manifest: {
    id: 'threads',
    name: 'Threads',
    version: '0.1.0',
    configSchema: () => channelConfigSchema,
    setupEntry: './setup-entry'
  },

  async register(api: PluginAPI) {
    const accounts = new Map<string, { id: string; config: any; client: MetaGraphApiClient }>();
    const webhookManagers = new Map<string, WebhookManager>();

    async function initializeAccounts() {
      const config = await api.config.get('channels.threads');
      const accountsConfig = config?.accounts || {};

      for (const [accountId, accountConfig] of Object.entries(accountsConfig)) {
        if (!accountConfig.enabled) continue;

        const validated = accountSchema.safeParse(accountConfig);
        if (!validated.success) {
          api.logger.warn(`Invalid config for Threads account ${accountId}:`, validated.error);
          continue;
        }

        const client = new MetaGraphApiClient({
          accessToken: validated.data.accessToken,
          apiVersion: 'v1.0' // Threads API v1.0
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

    // Parse inbound Threads mention/reply
    function parseInboundMessage(accountId: string, payload: any): BaseInboundMessage | null {
      const entry = payload.entry?.[0];
      if (!entry) return null;

      // Handle mentions
      if (entry.changes?.[0]?.field === 'mentions') {
        const change = entry.changes[0];
        return {
          id: change.value?.id || `th_${Date.now()}`,
          platform: 'threads',
          accountId,
          from: { id: change.value?.user_id || 'unknown' },
          to: accountId,
          text: change.value?.text,
          timestamp: Date.now(),
          raw: payload,
          metadata: { type: 'mention' }
        };
      }

      return null;
    }

    const threadsPlugin = createChatChannelPlugin({
      id: 'threads',
      label: 'Threads',
      setupEntry: './setup-entry',

      async inbound(params) {
        const { accountId, rawPayload } = params;
        const message = parseInboundMessage(accountId, rawPayload);
        if (!message) return null;

        return {
          id: message.id,
          from: message.from.id,
          text: message.text,
          metadata: { platform: 'threads', accountId }
        };
      },

      async outbound(params) {
        const { accountId, message } = params;
        const account = accounts.get(accountId);
        
        if (!account) {
          throw new Error(`Threads account ${accountId} not found`);
        }

        // Publish thread via Threads API
        const { threadsUserId } = account.config;
        
        // Create media container (if text only, use TEXT type)
        const createResponse = await account.client.post(`/${threadsUserId}/threads`, {
          text: message.text,
          reply_control: account.config.defaultReplyControl
        });

        const creationId = createResponse.id;

        // Publish the thread
        const publishResponse = await account.client.post(`/${threadsUserId}/threads_publish`, {
          creation_id: creationId
        });

        return {
          success: true,
          messageId: publishResponse.id,
          timestamp: Date.now()
        };
      },

      async getStatus(accountId) {
        const account = accounts.get(accountId);
        if (!account) return { status: 'not_configured' };

        try {
          await account.client.get(`/me?fields=id,username`);
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
    api.registerChannel(threadsPlugin);

    // Webhook handlers
    api.registerHttpHandler({
      path: '/webhooks/threads',
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
      path: '/webhooks/threads',
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
          if (body.object !== 'threads') {
            res.statusCode = 404;
            return 'Not found';
          }

          // Process mentions and replies
          for (const entry of body.entry || []) {
            for (const account of accounts.values()) {
              if (account.config.threadsUserId === entry.id) {
                const message = parseInboundMessage(account.id, { entry: [entry] });
                if (message) {
                  await api.routeMessage({
                    channelId: 'threads',
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
          api.logger.error('Threads webhook error:', error);
          res.statusCode = 500;
          return 'Internal server error';
        }
      }
    });
  }
});
