/**
 * Meta Webhook Manager
 * Handles webhook registration, verification, and signature validation
 */

import crypto from 'crypto';
import { MetaGraphApiClient } from '../http/client.js';
import { WebhookValidationError } from '../auth/errors.js';
import type { WebhookSubscription } from '../types/index.js';

/**
 * Webhook Manager options
 */
export interface WebhookManagerOptions {
  /** Meta App ID */
  appId: string;
  /** Meta App Secret */
  appSecret: string;
  /** Access token with manage_pages permission */
  accessToken: string;
  /** API version */
  apiVersion?: string;
}

/**
 * Webhook verification params (from GET request)
 */
export interface WebhookVerificationParams {
  'hub.mode': string;
  'hub.verify_token': string;
  'hub.challenge': string;
  'hub.id'?: string;
}

/**
 * Webhook subscription fields by platform
 */
export const SUBSCRIPTION_FIELDS: Record<string, string[]> = {
  messenger: [
    'messages',
    'messaging_postbacks',
    'messaging_optins',
    'messaging_referrals',
    'messaging_handovers',
    'messaging_policy_enforcement'
  ],
  instagram: [
    'messages',
    'messaging_postbacks',
    'ig_follows',
    'ig_comments',
    'ig_likes',
    'ig_mentions'
  ],
  threads: [
    'mentions',
    'replies',
    'reposts',
    'quotes',
    'likes',
    'follows'
  ]
};

/**
 * Meta Webhook Manager
 */
export class WebhookManager {
  private appId: string;
  private appSecret: string;
  private client: MetaGraphApiClient;

  constructor(options: WebhookManagerOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.client = new MetaGraphApiClient({
      accessToken: options.accessToken,
      apiVersion: options.apiVersion
    });
  }

  /**
   * Verify webhook subscription (GET request)
   * Facebook sends GET request to verify the callback URL
   */
  verifyWebhook(params: WebhookVerificationParams, expectedToken: string): string {
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    if (mode !== 'subscribe') {
      throw new WebhookValidationError(`Invalid hub.mode: ${mode}`);
    }

    if (token !== expectedToken) {
      throw new WebhookValidationError('Verify token mismatch');
    }

    // Return challenge to confirm subscription
    return challenge;
  }

  /**
   * Validate webhook signature (HMAC-SHA256)
   * Facebook sends X-Hub-Signature-256 header
   */
  validateSignature(rawBody: string, signature: string): boolean {
    if (!signature || !signature.startsWith('sha256=')) {
      return false;
    }

    const signatureHash = signature.substring('sha256='.length);
    const expectedHash = crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody, 'utf-8')
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  }

  /**
   * Register webhook subscription
   */
  async registerWebhook(
    callbackUrl: string,
    verifyToken: string,
    object: 'page' | 'instagram' | 'threads' = 'page',
    fields?: string[]
  ): Promise<WebhookSubscription> {
    const subscriptionFields = fields || SUBSCRIPTION_FIELDS[object] || [];

    try {
      const response = await this.client.post(`/${this.appId}/subscriptions`, {
        object,
        callback_url: callbackUrl,
        verify_token: verifyToken,
        fields: subscriptionFields.join(','),
        active: true
      });

      return {
        id: response.id,
        object,
        callbackUrl: callbackUrl,
        fields: subscriptionFields,
        active: true,
        createdAt: Date.now()
      };
    } catch (error: any) {
      // Check if already subscribed
      if (error.code === 1357001) {
        // Update existing subscription
        return this.updateWebhook(callbackUrl, verifyToken, object, fields);
      }
      throw error;
    }
  }

  /**
   * Update existing webhook subscription
   */
  async updateWebhook(
    callbackUrl: string,
    verifyToken: string,
    object: 'page' | 'instagram' | 'threads' = 'page',
    fields?: string[]
  ): Promise<WebhookSubscription> {
    const subscriptionFields = fields || SUBSCRIPTION_FIELDS[object] || [];

    const response = await this.client.post(`/${this.appId}/subscriptions`, {
      object,
      callback_url: callbackUrl,
      verify_token: verifyToken,
      fields: subscriptionFields.join(',')
    });

    return {
      id: response.id || 'existing',
      object,
      callbackUrl: callbackUrl,
      fields: subscriptionFields,
      active: true,
      createdAt: Date.now()
    };
  }

  /**
   * Unsubscribe webhook
   */
  async unsubscribeWebhook(subscriptionId: string, object?: string): Promise<void> {
    await this.client.delete(`/${this.appId}/subscriptions`, {
      params: {
        object: object || 'page',
        subscription_id: subscriptionId
      }
    });
  }

  /**
   * List all webhook subscriptions
   */
  async listSubscriptions(): Promise<WebhookSubscription[]> {
    const response = await this.client.get(`/${this.appId}/subscriptions`);
    
    return (response.data || []).map((sub: any) => ({
      id: sub.id,
      object: sub.object,
      callbackUrl: sub.callback_url,
      fields: sub.fields || [],
      active: sub.active ?? true,
      createdAt: sub.time ? new Date(sub.time).getTime() : Date.now()
    }));
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<WebhookSubscription | null> {
    const subscriptions = await this.listSubscriptions();
    return subscriptions.find(s => s.id === subscriptionId) || null;
  }

  /**
   * Check if webhook is subscribed
   */
  async isSubscribed(callbackUrl: string, object?: string): Promise<boolean> {
    const subscriptions = await this.listSubscriptions();
    return subscriptions.some(
      s => s.callbackUrl === callbackUrl && (!object || s.object === object)
    );
  }

  /**
   * Refresh all subscriptions (re-register)
   */
  async refreshSubscriptions(
    callbackUrl: string,
    verifyToken: string,
    objects: Array<'page' | 'instagram' | 'threads'> = ['page']
  ): Promise<WebhookSubscription[]> {
    const subscriptions: WebhookSubscription[] = [];

    for (const object of objects) {
      try {
        const sub = await this.registerWebhook(callbackUrl, verifyToken, object);
        subscriptions.push(sub);
      } catch (error: any) {
        console.error(`Failed to register webhook for ${object}:`, error.message);
      }
    }

    return subscriptions;
  }

  /**
   * Delete all subscriptions
   */
  async deleteAllSubscriptions(): Promise<void> {
    const subscriptions = await this.listSubscriptions();
    
    for (const sub of subscriptions) {
      try {
        await this.unsubscribeWebhook(sub.id, sub.object);
      } catch (error: any) {
        console.error(`Failed to delete subscription ${sub.id}:`, error.message);
      }
    }
  }

  /**
   * Update access token
   */
  setAccessToken(token: string): void {
    this.client.setAccessToken(token);
  }
}

/**
 * Create WebhookManager instance
 */
export function createWebhookManager(options: WebhookManagerOptions): WebhookManager {
  return new WebhookManager(options);
}
