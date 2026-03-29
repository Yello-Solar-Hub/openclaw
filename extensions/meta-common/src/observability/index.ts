/**
 * Observability module for Meta Platforms stack
 * Provides metrics, logging, and audit trails for Messenger, Instagram, and Threads
 * 
 * @module @openclaw/meta-common/observability
 */

import { EventEmitter } from 'node:events';

/**
 * Metric types tracked across Meta platforms
 */
export interface MetaMetrics {
  // Inbound metrics
  inboundMessages: Counter;
  inboundMessagesByType: Record<string, Counter>;
  inboundMessagesByPlatform: Record<string, Counter>;
  
  // Outbound metrics
  outboundMessages: Counter;
  outboundMessagesByType: Record<string, Counter>;
  outboundMessagesByPlatform: Record<string, Counter>;
  
  // Webhook metrics
  webhookReceived: Counter;
  webhookVerified: Counter;
  webhookRejected: Counter;
  webhookLatency: Histogram;
  
  // OAuth metrics
  oauthTokenRefresh: Counter;
  oauthTokenExpiring: Gauge;
  
  // Error metrics
  errorsByType: Record<string, Counter>;
  errorsByPlatform: Record<string, Counter>;
  
  // Rate limiting
  rateLimitHits: Counter;
  rateLimitRetries: Counter;
  
  // Session windows
  sessionWindowsActive: Gauge;
  sessionWindowsExpired: Counter;
  
  // Delivery
  deliverySuccess: Counter;
  deliveryFailure: Counter;
  deliveryLatency: Histogram;
}

/**
 * Counter metric interface
 */
export interface Counter {
  value: number;
  inc(value?: number): void;
  reset(): void;
}

/**
 * Gauge metric interface
 */
export interface Gauge {
  value: number;
  set(value: number): void;
  inc(value?: number): void;
  dec(value?: number): void;
  reset(): void;
}

/**
 * Histogram metric interface
 */
export interface Histogram {
  observe(value: number): void;
  reset(): void;
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: number;
  platform: 'messenger' | 'instagram' | 'threads';
  action: 
    | 'webhook_received'
    | 'webhook_verified'
    | 'webhook_rejected'
    | 'message_inbound'
    | 'message_outbound'
    | 'oauth_token_refresh'
    | 'oauth_token_generated'
    | 'config_changed'
    | 'rate_limit_hit'
    | 'delivery_success'
    | 'delivery_failure';
  accountId: string;
  userId?: string;
  messageId?: string;
  details?: Record<string, unknown>;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Audit log emitter
 */
export class AuditLogger extends EventEmitter {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number = 10000;
  
  /**
   * Log audit entry
   */
  log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    
    this.logs.push(fullEntry);
    
    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Emit for external listeners
    this.emit('audit', fullEntry);
  }
  
  /**
   * Get recent logs
   */
  getRecent(limit: number = 100): AuditLogEntry[] {
    return this.logs.slice(-limit);
  }
  
  /**
   * Filter logs by criteria
   */
  filter(criteria: {
    platform?: string;
    action?: string;
    accountId?: string;
    success?: boolean;
    fromTimestamp?: number;
    toTimestamp?: number;
  }): AuditLogEntry[] {
    return this.logs.filter(log => {
      if (criteria.platform && log.platform !== criteria.platform) return false;
      if (criteria.action && log.action !== criteria.action) return false;
      if (criteria.accountId && log.accountId !== criteria.accountId) return false;
      if (criteria.success !== undefined && log.success !== criteria.success) return false;
      if (criteria.fromTimestamp && log.timestamp < criteria.fromTimestamp) return false;
      if (criteria.toTimestamp && log.timestamp > criteria.toTimestamp) return false;
      return true;
    });
  }
  
  /**
   * Export logs for external analysis
   */
  export(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }
    
    // CSV export
    const headers = ['timestamp', 'platform', 'action', 'accountId', 'userId', 'messageId', 'success', 'errorCode', 'errorMessage'];
    const rows = this.logs.map(log => 
      headers.map(h => JSON.stringify((log as any)[h] ?? '')).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }
  
  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }
}

/**
 * Create counter metric
 */
export function createCounter(name: string): Counter {
  let value = 0;
  
  return {
    get value() { return value; },
    inc(v: number = 1) { value += v; },
    reset() { value = 0; },
  };
}

/**
 * Create gauge metric
 */
export function createGauge(name: string): Gauge {
  let value = 0;
  
  return {
    get value() { return value; },
    set(v: number) { value = v; },
    inc(v: number = 1) { value += v; },
    dec(v: number = 1) { value -= v; },
    reset() { value = 0; },
  };
}

/**
 * Create histogram metric
 */
export function createHistogram(name: string): Histogram {
  const values: number[] = [];
  const maxValues = 1000;
  
  return {
    observe(value: number) {
      values.push(value);
      if (values.length > maxValues) {
        values.shift();
      }
    },
    reset() {
      values.length = 0;
    },
    get percentiles() {
      if (values.length === 0) {
        return { p50: 0, p95: 0, p99: 0 };
      }
      
      const sorted = [...values].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      
      return { p50, p95, p99 };
    },
  };
}

/**
 * Initialize metrics for Meta platforms
 */
export function createMetaMetrics(): MetaMetrics {
  return {
    // Inbound
    inboundMessages: createCounter('inbound_messages'),
    inboundMessagesByType: {},
    inboundMessagesByPlatform: {},
    
    // Outbound
    outboundMessages: createCounter('outbound_messages'),
    outboundMessagesByType: {},
    outboundMessagesByPlatform: {},
    
    // Webhook
    webhookReceived: createCounter('webhook_received'),
    webhookVerified: createCounter('webhook_verified'),
    webhookRejected: createCounter('webhook_rejected'),
    webhookLatency: createHistogram('webhook_latency'),
    
    // OAuth
    oauthTokenRefresh: createCounter('oauth_token_refresh'),
    oauthTokenExpiring: createGauge('oauth_token_expiring'),
    
    // Errors
    errorsByType: {},
    errorsByPlatform: {},
    
    // Rate limiting
    rateLimitHits: createCounter('rate_limit_hits'),
    rateLimitRetries: createCounter('rate_limit_retries'),
    
    // Session windows
    sessionWindowsActive: createGauge('session_windows_active'),
    sessionWindowsExpired: createCounter('session_windows_expired'),
    
    // Delivery
    deliverySuccess: createCounter('delivery_success'),
    deliveryFailure: createCounter('delivery_failure'),
    deliveryLatency: createHistogram('delivery_latency'),
  };
}

/**
 * Global audit logger instance
 */
export const auditLogger = new AuditLogger();

/**
 * Global metrics instance
 */
export const metrics = createMetaMetrics();

/**
 * Middleware for webhook observability
 */
export function createWebhookMiddleware(platform: string) {
  return {
    onReceived() {
      metrics.webhookReceived.inc();
      auditLogger.log({
        platform: platform as any,
        action: 'webhook_received',
        accountId: 'unknown',
        success: true,
      });
    },
    
    onVerified(accountId: string, latencyMs: number) {
      metrics.webhookVerified.inc();
      metrics.webhookLatency.observe(latencyMs);
      auditLogger.log({
        platform: platform as any,
        action: 'webhook_verified',
        accountId,
        success: true,
      });
    },
    
    onRejected(accountId: string, reason: string) {
      metrics.webhookRejected.inc();
      auditLogger.log({
        platform: platform as any,
        action: 'webhook_rejected',
        accountId,
        success: false,
        errorMessage: reason,
      });
    },
  };
}

/**
 * Middleware for message observability
 */
export function createMessageMiddleware(platform: string) {
  return {
    onInbound(accountId: string, userId: string, messageId: string, type: string) {
      metrics.inboundMessages.inc();
      metrics.inboundMessagesByPlatform[platform] ??= createCounter(`inbound_${platform}`);
      metrics.inboundMessagesByPlatform[platform].inc();
      metrics.inboundMessagesByType[type] ??= createCounter(`inbound_${type}`);
      metrics.inboundMessagesByType[type].inc();
      
      auditLogger.log({
        platform: platform as any,
        action: 'message_inbound',
        accountId,
        userId,
        messageId,
        success: true,
        details: { type },
      });
    },
    
    onOutbound(accountId: string, userId: string, messageId: string, type: string) {
      metrics.outboundMessages.inc();
      metrics.outboundMessagesByPlatform[platform] ??= createCounter(`outbound_${platform}`);
      metrics.outboundMessagesByPlatform[platform].inc();
      metrics.outboundMessagesByType[type] ??= createCounter(`outbound_${type}`);
      metrics.outboundMessagesByType[type].inc();
      
      auditLogger.log({
        platform: platform as any,
        action: 'message_outbound',
        accountId,
        userId,
        messageId,
        success: true,
        details: { type },
      });
    },
    
    onDeliverySuccess(accountId: string, userId: string, messageId: string, latencyMs: number) {
      metrics.deliverySuccess.inc();
      metrics.deliveryLatency.observe(latencyMs);
      
      auditLogger.log({
        platform: platform as any,
        action: 'delivery_success',
        accountId,
        userId,
        messageId,
        success: true,
        details: { latencyMs },
      });
    },
    
    onDeliveryFailure(accountId: string, userId: string, messageId: string, errorCode: string, errorMessage: string) {
      metrics.deliveryFailure.inc();
      metrics.errorsByPlatform[platform] ??= createCounter(`errors_${platform}`);
      metrics.errorsByPlatform[platform].inc();
      metrics.errorsByType[errorCode] ??= createCounter(`error_${errorCode}`);
      metrics.errorsByType[errorCode].inc();
      
      auditLogger.log({
        platform: platform as any,
        action: 'delivery_failure',
        accountId,
        userId,
        messageId,
        success: false,
        errorCode,
        errorMessage,
      });
    },
  };
}

/**
 * Export metrics in Prometheus format
 */
export function exportPrometheusMetrics(): string {
  const lines: string[] = [];
  
  // Helper to format metric
  const formatCounter = (name: string, counter: Counter, labels?: Record<string, string>) => {
    const labelStr = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : '';
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name}${labelStr} ${counter.value}`);
  };
  
  const formatGauge = (name: string, gauge: Gauge, labels?: Record<string, string>) => {
    const labelStr = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : '';
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name}${labelStr} ${gauge.value}`);
  };
  
  const formatHistogram = (name: string, histogram: Histogram, labels?: Record<string, string>) => {
    const labelStr = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : '';
    const { p50, p95, p99 } = histogram.percentiles;
    lines.push(`# TYPE ${name} summary`);
    lines.push(`${name}${labelStr}{quantile="0.5"} ${p50}`);
    lines.push(`${name}${labelStr}{quantile="0.95"} ${p95}`);
    lines.push(`${name}${labelStr}{quantile="0.99"} ${p99}`);
  };
  
  // Export all metrics
  formatCounter('meta_inbound_messages_total', metrics.inboundMessages);
  formatCounter('meta_outbound_messages_total', metrics.outboundMessages);
  formatCounter('meta_webhook_received_total', metrics.webhookReceived);
  formatCounter('meta_webhook_verified_total', metrics.webhookVerified);
  formatCounter('meta_webhook_rejected_total', metrics.webhookRejected);
  formatHistogram('meta_webhook_latency_seconds', metrics.webhookLatency);
  formatCounter('meta_oauth_token_refresh_total', metrics.oauthTokenRefresh);
  formatGauge('meta_oauth_token_expiring', metrics.oauthTokenExpiring);
  formatCounter('meta_rate_limit_hits_total', metrics.rateLimitHits);
  formatCounter('meta_rate_limit_retries_total', metrics.rateLimitRetries);
  formatGauge('meta_session_windows_active', metrics.sessionWindowsActive);
  formatCounter('meta_session_windows_expired_total', metrics.sessionWindowsExpired);
  formatCounter('meta_delivery_success_total', metrics.deliverySuccess);
  formatCounter('meta_delivery_failure_total', metrics.deliveryFailure);
  formatHistogram('meta_delivery_latency_seconds', metrics.deliveryLatency);
  
  return lines.join('\n');
}
