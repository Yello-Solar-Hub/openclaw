/**
 * Meta Authentication Module
 */

export { MetaAuthManager, createMetaAuthManager, type MetaAuthManagerOptions } from './manager.js';
export { 
  MetaApiError, 
  MetaErrorCode, 
  ErrorSeverity,
  WebhookValidationError,
  RateLimitError,
  isRetryableError 
} from './errors.js';
