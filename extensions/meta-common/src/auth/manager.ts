/**
 * Meta Authentication Manager
 * Handles OAuth flow, token lifecycle, and validation
 */

import axios from 'axios';
import type { TokenInfo, OAuthParams } from '../types/index.js';
import { MetaApiError, MetaErrorCode } from './errors.js';

/**
 * Meta OAuth endpoints
 */
const META_OAUTH_BASE = 'https://www.facebook.com/v21.0/dialog/oauth';
const META_TOKEN_BASE = 'https://graph.facebook.com/v21.0/oauth/access_token';

/**
 * Token refresh threshold (refresh 7 days before expiry)
 */
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Long-lived token duration (60 days)
 */
const LONG_LIVED_TOKEN_DURATION_MS = 60 * 24 * 60 * 60 * 1000;

export interface MetaAuthManagerOptions {
  /** App ID */
  appId: string;
  /** App Secret */
  appSecret: string;
  /** Redirect URI for OAuth */
  redirectUri: string;
  /** Token storage path */
  tokenStoragePath?: string;
}

/**
 * Meta Authentication Manager
 */
export class MetaAuthManager {
  private appId: string;
  private appSecret: string;
  private redirectUri: string;
  private tokenCache: Map<string, TokenInfo> = new Map();

  constructor(options: MetaAuthManagerOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.redirectUri = options.redirectUri;
  }

  /**
   * Generate OAuth authorization URL
   */
  generateOAuthUrl(params: OAuthParams): string {
    const url = new URL(META_OAUTH_BASE);
    url.searchParams.set('client_id', params.appId || this.appId);
    url.searchParams.set('redirect_uri', params.redirectUri || this.redirectUri);
    
    if (params.scope && params.scope.length > 0) {
      url.searchParams.set('scope', params.scope.join(','));
    }
    
    if (params.state) {
      url.searchParams.set('state', params.state);
    }
    
    if (params.responseType === 'token') {
      url.searchParams.set('response_type', 'token');
    } else {
      url.searchParams.set('response_type', 'code');
    }

    return url.toString();
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri?: string): Promise<TokenInfo> {
    try {
      const response = await axios.get(META_TOKEN_BASE, {
        params: {
          client_id: this.appId,
          redirect_uri: redirectUri || this.redirectUri,
          client_secret: this.appSecret,
          code
        }
      });

      if (!response.data.access_token) {
        throw new MetaApiError('No access_token in response', MetaErrorCode.OAUTH_EXPIRED);
      }

      // Short-lived token, exchange for long-lived
      return await this.refreshLongLivedToken(response.data.access_token);
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new MetaApiError(
          error.response.data.error.message,
          error.response.data.error.code || MetaErrorCode.OAUTH_EXPIRED
        );
      }
      throw error;
    }
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  async refreshLongLivedToken(shortLivedToken: string): Promise<TokenInfo> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v21.0/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: this.appId,
            client_secret: this.appSecret,
            fb_exchange_token: shortLivedToken
          }
        }
      );

      if (!response.data.access_token) {
        throw new MetaApiError('No access_token in response', MetaErrorCode.OAUTH_EXPIRED);
      }

      // Parse expires_in if available, otherwise assume 60 days
      const expiresIn = response.data.expires_in || (LONG_LIVED_TOKEN_DURATION_MS / 1000);
      const expiresAt = Date.now() + (expiresIn * 1000);

      // Parse scopes if available
      const scopes = response.data.scope?.split(',') || [];

      const tokenInfo: TokenInfo = {
        accessToken: response.data.access_token,
        expiresAt,
        scopes,
        accountId: 'unknown',
        encrypted: false
      };

      // Cache the token
      this.tokenCache.set(tokenInfo.accessToken, tokenInfo);

      return tokenInfo;
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new MetaApiError(
          error.response.data.error.message,
          error.response.data.error.code || MetaErrorCode.OAUTH_EXPIRED
        );
      }
      throw error;
    }
  }

  /**
   * Validate token and get info
   */
  async validateToken(token: string): Promise<TokenInfo> {
    // Check cache first
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    try {
      const response = await axios.get(
        `https://graph.facebook.com/debug_token`,
        {
          params: {
            input_token: token,
            access_token: `${this.appId}|${this.appSecret}`
          }
        }
      );

      const data = response.data.data;
      
      if (!data || !data.is_valid) {
        throw new MetaApiError('Token is invalid', MetaErrorCode.OAUTH_EXPIRED);
      }

      const tokenInfo: TokenInfo = {
        accessToken: token,
        expiresAt: data.expires_at ? data.expires_at * 1000 : Date.now() + LONG_LIVED_TOKEN_DURATION_MS,
        scopes: data.scopes || [],
        accountId: data.user_id || data.app_id || 'unknown',
        encrypted: false
      };

      // Cache the token
      this.tokenCache.set(token, tokenInfo);

      return tokenInfo;
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new MetaApiError(
          error.response.data.error.message,
          error.response.data.error.code || MetaErrorCode.OAUTH_EXPIRED
        );
      }
      throw error;
    }
  }

  /**
   * Check if token needs refresh
   */
  needsRefresh(tokenInfo: TokenInfo): boolean {
    const now = Date.now();
    return tokenInfo.expiresAt - now < REFRESH_THRESHOLD_MS;
  }

  /**
   * Get token info, refreshing if necessary
   */
  async getValidToken(tokenInfo: TokenInfo): Promise<TokenInfo> {
    if (this.needsRefresh(tokenInfo)) {
      // Token expiring soon, refresh it
      return await this.refreshLongLivedToken(tokenInfo.accessToken);
    }
    return tokenInfo;
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await axios.get(`https://graph.facebook.com/v21.0/permissions`, {
        params: {
          access_token: token
        }
      });

      // Remove from cache
      this.tokenCache.delete(token);
    } catch (error: any) {
      // Ignore revocation errors
      console.warn('Failed to revoke token:', error.message);
    }
  }

  /**
   * Get account info using token
   */
  async getAccountInfo(token: string, accountId: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v21.0/${accountId}`,
        {
          params: {
            access_token: token,
            fields: 'id,name,picture,locale,timezone'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new MetaApiError(
          error.response.data.error.message,
          error.response.data.error.code
        );
      }
      throw error;
    }
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.tokenCache.size;
  }
}

/**
 * Create MetaAuthManager instance
 */
export function createMetaAuthManager(options: MetaAuthManagerOptions): MetaAuthManager {
  return new MetaAuthManager(options);
}
