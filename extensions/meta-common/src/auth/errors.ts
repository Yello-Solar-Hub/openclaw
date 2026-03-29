/**
 * Meta API Error handling
 */

/**
 * Meta Platform error codes
 */
export enum MetaErrorCode {
  // API Errors
  API_ERROR = 1,
  RATE_LIMIT = 4,
  TEMPORARY_ERROR = 17,

  // Auth Errors
  OAUTH_EXPIRED = 190,
  INVALID_TOKEN = 190,
  PERMISSION_DENIED = 200,

  // Resource Errors
  RESOURCE_NOT_FOUND = 803,
  DUPLICATE_MESSAGE = 368,
  MESSAGE_TOO_LONG = 369,

  // Webhook Errors
  WEBHOOK_INVALID = 1357001,
  WEBHOOK_NOT_SUBSCRIBED = 1357004,

  // Account Errors
  ACCOUNT_DISABLED = 368,
  PAGE_NOT_CONNECTED = 1357031,
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

/**
 * Meta API Error
 */
export class MetaApiError extends Error {
  public code: MetaErrorCode;
  public severity: ErrorSeverity;
  public retryable: boolean;
  public fbtraceId?: string;
  public rawError?: any;

  constructor(
    message: string,
    code: MetaErrorCode = MetaErrorCode.API_ERROR,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
  ) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.severity = severity;
    this.retryable = this.isRetryable(code);

    // Capture stack trace (Node.js only)
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, MetaApiError);
    }
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(code: MetaErrorCode): boolean {
    const retryableCodes = [
      MetaErrorCode.RATE_LIMIT,
      MetaErrorCode.TEMPORARY_ERROR,
      MetaErrorCode.API_ERROR,
    ];
    return retryableCodes.includes(code);
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(attempt: number): number {
    if (!this.retryable) return 0;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 60s)
    const baseDelay = 1000;
    const maxDelay = 60000;
    const delay = baseDelay * Math.pow(2, attempt);
    return Math.min(delay, maxDelay);
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      retryable: this.retryable,
      fbtraceId: this.fbtraceId,
      stack: this.stack,
    };
  }

  /**
   * Create from Graph API error response
   */
  static fromGraphError(error: any): MetaApiError {
    const metaError = new MetaApiError(
      error.message || "Unknown Graph API error",
      error.code || MetaErrorCode.API_ERROR,
    );

    metaError.fbtraceId = error.fbtrace_id;
    metaError.rawError = error;

    if (error.type === "OAuthException") {
      metaError.code = MetaErrorCode.OAUTH_EXPIRED;
    } else if (error.type === "PermissionsException") {
      metaError.code = MetaErrorCode.PERMISSION_DENIED;
    }

    return metaError;
  }
}

/**
 * Webhook validation error
 */
export class WebhookValidationError extends MetaApiError {
  constructor(message: string) {
    super(message, MetaErrorCode.WEBHOOK_INVALID, ErrorSeverity.WARNING);
    this.name = "WebhookValidationError";
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends MetaApiError {
  public retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message, MetaErrorCode.RATE_LIMIT, ErrorSeverity.WARNING);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof MetaApiError) {
    return error.retryable;
  }

  // Network errors are retryable
  if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
    return true;
  }

  return false;
}
