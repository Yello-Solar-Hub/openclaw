/**
 * Tests for MetaAuthManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetaAuthManager } from '../src/auth/manager.js';

describe('MetaAuthManager', () => {
  let authManager: MetaAuthManager;

  const mockOptions = {
    appId: 'test-app-id',
    appSecret: 'test-app-secret',
    redirectUri: 'https://example.com/callback'
  };

  beforeEach(() => {
    authManager = new MetaAuthManager(mockOptions);
  });

  describe('generateOAuthUrl', () => {
    it('should generate valid OAuth URL with required params', () => {
      const url = authManager.generateOAuthUrl({
        appId: '123',
        redirectUri: 'https://example.com/callback',
        scope: ['pages_manage_metadata', 'pages_read_engagement']
      });

      expect(url).toContain('https://www.facebook.com/v21.0/dialog/oauth');
      expect(url).toContain('client_id=123');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('scope=pages_manage_metadata%2Cpages_read_engagement');
    });

    it('should include state parameter when provided', () => {
      const url = authManager.generateOAuthUrl({
        ...mockOptions,
        state: 'random-state-123'
      });

      expect(url).toContain('state=random-state-123');
    });

    it('should default to code response type', () => {
      const url = authManager.generateOAuthUrl(mockOptions);
      expect(url).toContain('response_type=code');
    });

    it('should support token response type', () => {
      const url = authManager.generateOAuthUrl({
        ...mockOptions,
        responseType: 'token'
      });
      expect(url).toContain('response_type=token');
    });
  });

  describe('needsRefresh', () => {
    it('should return true for expiring tokens', () => {
      const expiringToken = {
        accessToken: 'test-token',
        expiresAt: Date.now() + 5 * 24 * 60 * 60 * 1000, // 5 days
        scopes: ['pages_manage_metadata'],
        accountId: '123',
        encrypted: false
      };

      expect(authManager.needsRefresh(expiringToken)).toBe(true);
    });

    it('should return false for valid tokens', () => {
      const validToken = {
        accessToken: 'test-token',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        scopes: ['pages_manage_metadata'],
        accountId: '123',
        encrypted: false
      };

      expect(authManager.needsRefresh(validToken)).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should track cache size', () => {
      expect(authManager.getCacheSize()).toBe(0);
    });

    it('should clear cache', () => {
      authManager.clearCache();
      expect(authManager.getCacheSize()).toBe(0);
    });
  });
});
