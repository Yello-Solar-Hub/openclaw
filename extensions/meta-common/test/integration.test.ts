/**
 * Integration tests for Meta plugins
 * Run with: pnpm test -- extensions/meta-common/test/integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  MetaAuthManager,
  MetaGraphApiClient,
  WebhookManager,
  MetaApiError
} from '../src/index.js';

// Skip tests in CI without credentials
const shouldSkip = !process.env.TEST_META_APP_ID || !process.env.TEST_META_APP_SECRET;

describe('Meta Plugins Integration', () => {
  let authManager: MetaAuthManager;
  let webhookManager: WebhookManager;

  beforeAll(() => {
    authManager = new MetaAuthManager({
      appId: process.env.TEST_META_APP_ID || 'test',
      appSecret: process.env.TEST_META_APP_SECRET || 'test',
      redirectUri: 'https://example.com/callback'
    });
  });

  describe('MetaAuthManager', () => {
    it('should generate OAuth URL', () => {
      const url = authManager.generateOAuthUrl({
        appId: '123',
        redirectUri: 'https://example.com/callback',
        scope: ['pages_manage_metadata', 'pages_read_engagement']
      });

      expect(url).toContain('facebook.com/v21.0/dialog/oauth');
      expect(url).toContain('client_id=123');
      expect(url).toContain('scope=');
    });

    it('should include state parameter', () => {
      const url = authManager.generateOAuthUrl({
        appId: '123',
        redirectUri: 'https://example.com/callback',
        state: 'test-state-123',
        scope: []
      });

      expect(url).toContain('state=test-state-123');
    });
  });

  describe('WebhookManager', () => {
    it('should verify webhook subscription', () => {
      webhookManager = new WebhookManager({
        appId: 'test',
        appSecret: 'test-secret',
        accessToken: 'test-token'
      });

      const challenge = webhookManager.verifyWebhook({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'my-verify-token',
        'hub.challenge': 'challenge-123'
      }, 'my-verify-token');

      expect(challenge).toBe('challenge-123');
    });

    it('should reject invalid mode', () => {
      expect(() => {
        webhookManager.verifyWebhook({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'token',
          'hub.challenge': 'challenge'
        }, 'token');
      }).toThrow('Invalid hub.mode');
    });

    it('should reject token mismatch', () => {
      expect(() => {
        webhookManager.verifyWebhook({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'expected-token',
          'hub.challenge': 'challenge'
        }, 'wrong-token');
      }).toThrow('Verify token mismatch');
    });

    it('should validate HMAC signature', () => {
      const rawBody = '{"test":"body"}';
      const appSecret = 'test-secret-123';
      
      // Create valid signature
      const crypto = require('crypto');
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(rawBody)
        .digest('hex');

      const wm = new WebhookManager({
        appId: 'test',
        appSecret: appSecret,
        accessToken: 'test'
      });

      const isValid = wm.validateSignature(rawBody, expectedSignature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const wm = new WebhookManager({
        appId: 'test',
        appSecret: 'secret',
        accessToken: 'test'
      });

      const isValid = wm.validateSignature('{"test":"body"}', 'sha256=invalid');
      expect(isValid).toBe(false);
    });
  });

  describe('MetaGraphApiClient', () => {
    it('should create client with config', () => {
      const client = new MetaGraphApiClient({
        accessToken: 'test-token',
        apiVersion: 'v21.0'
      });

      expect(client.getAccessToken()).toBe('test-token');
    });

    it('should update access token', () => {
      const client = new MetaGraphApiClient({
        accessToken: 'old-token',
        apiVersion: 'v21.0'
      });

      client.setAccessToken('new-token');
      expect(client.getAccessToken()).toBe('new-token');
    });
  });

  describe('MetaApiError', () => {
    it('should create error with code', () => {
      const error = new MetaApiError('Test error', 190);
      
      expect(error.name).toBe('MetaApiError');
      expect(error.code).toBe(190);
      expect(error.message).toBe('Test error');
    });

    it('should detect retryable errors', () => {
      const rateLimitError = new MetaApiError('Rate limit', 4);
      expect(rateLimitError.retryable).toBe(true);

      const authError = new MetaApiError('Auth error', 190);
      expect(authError.retryable).toBe(false);
    });

    it('should calculate retry delay', () => {
      const error = new MetaApiError('Rate limit', 4);
      
      expect(error.getRetryDelay(0)).toBe(1000);
      expect(error.getRetryDelay(1)).toBe(2000);
      expect(error.getRetryDelay(2)).toBe(4000);
      expect(error.getRetryDelay(5)).toBe(60000); // capped
    });
  });
});
