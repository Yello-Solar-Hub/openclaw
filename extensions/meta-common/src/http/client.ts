/**
 * Meta Graph API Client
 * HTTP client for interacting with Facebook Graph API
 */

import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { MetaApiError, MetaErrorCode, RateLimitError, isRetryableError } from "../auth/errors.js";

/**
 * Default Graph API version
 */
const DEFAULT_API_VERSION = "v21.0";

/**
 * Default base URL
 */
const GRAPH_API_BASE = "https://graph.facebook.com";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  factor: number;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  factor: 2,
};

/**
 * Meta Graph API Client options
 */
export interface MetaGraphApiClientOptions {
  /** Access token for API requests */
  accessToken: string;
  /** API version (default: v21.0) */
  apiVersion?: string;
  /** Base URL (default: https://graph.facebook.com) */
  baseUrl?: string;
  /** Rate limit configuration */
  rateLimit?: Partial<RateLimitConfig>;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * Media upload response
 */
export interface MediaUploadResponse {
  id: string;
  post_id?: string;
}

/**
 * Meta Graph API Client
 */
export class MetaGraphApiClient {
  private client: AxiosInstance;
  private accessToken: string;
  private apiVersion: string;
  private rateLimitConfig: RateLimitConfig;

  constructor(options: MetaGraphApiClientOptions) {
    this.accessToken = options.accessToken;
    this.apiVersion = options.apiVersion || DEFAULT_API_VERSION;
    this.rateLimitConfig = {
      ...DEFAULT_RATE_LIMIT_CONFIG,
      ...options.rateLimit,
    };

    // Create axios instance with defaults
    this.client = axios.create({
      baseURL: options.baseUrl || GRAPH_API_BASE,
      timeout: options.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "OpenClaw/2026.3.28",
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => this.handleApiError(error),
    );
  }

  /**
   * Make GET request
   */
  async get<T = any>(path: string, params?: Record<string, any>): Promise<T> {
    const response = await this.request<T>("GET", path, { params });
    return response.data;
  }

  /**
   * Make POST request
   */
  async post<T = any>(path: string, data?: any, params?: Record<string, any>): Promise<T> {
    const response = await this.request<T>("POST", path, { data, params });
    return response.data;
  }

  /**
   * Make DELETE request
   */
  async delete<T = any>(path: string, params?: Record<string, any>): Promise<T> {
    const response = await this.request<T>("DELETE", path, { params });
    return response.data;
  }

  /**
   * Make generic request with retry logic
   */
  private async request<T = any>(
    method: string,
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<any> {
    let lastError: any;
    let attempt = 0;

    while (attempt <= this.rateLimitConfig.maxRetries) {
      try {
        // Ensure access token is included
        const defaultParams: Record<string, any> = {
          access_token: this.accessToken,
        };

        if (config?.params) {
          Object.assign(defaultParams, config.params);
        }

        const response = await this.client.request<T>({
          method,
          url: `/${this.apiVersion}${path.startsWith("/") ? path : `/${path}`}`,
          ...config,
          params: defaultParams,
        });

        return response;
      } catch (error: any) {
        lastError = error;

        // Check if retryable
        if (!isRetryableError(error) && !(error instanceof MetaApiError && error.retryable)) {
          throw error;
        }

        // Check if rate limited
        if (error instanceof RateLimitError && error.retryAfter) {
          const delay = error.retryAfter * 1000;
          await this.sleep(delay);
          attempt++;
          continue;
        }

        // Exponential backoff
        const delay =
          this.rateLimitConfig.baseDelayMs * Math.pow(this.rateLimitConfig.factor, attempt);
        const cappedDelay = Math.min(delay, this.rateLimitConfig.maxDelayMs);

        await this.sleep(cappedDelay);
        attempt++;
      }
    }

    throw lastError;
  }

  /**
   * Upload media file
   */
  async uploadMedia(
    containerType: "image" | "video" | "file",
    fileOrUrl: Buffer | string,
    accountId: string,
  ): Promise<MediaUploadResponse> {
    const endpoint = `/${accountId}/${containerType === "video" ? "videos" : "photos"}`;

    if (typeof fileOrUrl === "string") {
      // URL upload
      const params: Record<string, any> = {
        access_token: this.accessToken,
      };

      if (containerType === "image") {
        params.image_url = fileOrUrl;
      } else if (containerType === "video") {
        params.file_url = fileOrUrl;
      }

      return this.post(endpoint, params);
    } else {
      // Buffer upload - note: requires Node.js environment
      // In browser, use URL upload instead
      throw new Error("Buffer upload not supported in this environment. Use URL upload instead.");
    }
  }

  /**
   * Get paginated results
   */
  async getPaginated<T = any>(
    path: string,
    params?: Record<string, any>,
    limit?: number,
  ): Promise<{ data: T[]; paging: any }> {
    const allData: T[] = [];
    let nextUrl: string | null = path;

    while (nextUrl && (!limit || allData.length < limit)) {
      const result: any = await this.get(nextUrl, params);

      if (result.data) {
        allData.push(...result.data);
      }

      nextUrl = result.paging?.next || null;

      if (limit && allData.length >= limit) {
        break;
      }
    }

    return {
      data: limit ? allData.slice(0, limit) : allData,
      paging: { hasPrevious: false, hasNext: false },
    };
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): never {
    // Axios timeout
    if (error.code === "ECONNABORTED") {
      throw new MetaApiError("Request timeout", MetaErrorCode.TEMPORARY_ERROR);
    }

    // Network errors
    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
      throw new MetaApiError("Network error", MetaErrorCode.TEMPORARY_ERROR);
    }

    // Graph API error response
    if (error.response?.data?.error) {
      const graphError = error.response.data.error;

      // Rate limit
      if (graphError.code === MetaErrorCode.RATE_LIMIT) {
        const retryAfter =
          error.response.headers?.["retry-after"] || graphError.error_subcode || 60;
        throw new RateLimitError(graphError.message, retryAfter);
      }

      throw MetaApiError.fromGraphError(graphError);
    }

    // Unknown error
    throw new MetaApiError(error.message || "Unknown API error", MetaErrorCode.API_ERROR);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update access token
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Get current access token
   */
  getAccessToken(): string {
    return this.accessToken;
  }
}

/**
 * Create MetaGraphApiClient instance
 */
export function createGraphApiClient(options: MetaGraphApiClientOptions): MetaGraphApiClient {
  return new MetaGraphApiClient(options);
}
