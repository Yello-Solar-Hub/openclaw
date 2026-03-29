/**
 * Tests for Meta Observability module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCounter,
  createGauge,
  createHistogram,
  createMetaMetrics,
  AuditLogger,
  auditLogger,
  metrics,
  createWebhookMiddleware,
  createMessageMiddleware,
  exportPrometheusMetrics,
} from '../src/observability/index.js';

describe('Meta Observability', () => {
  beforeEach(() => {
    // Reset global state
    auditLogger.clear();
    const freshMetrics = createMetaMetrics();
    Object.assign(metrics, freshMetrics);
  });

  describe('Counter', () => {
    it('should increment counter', () => {
      const counter = createCounter('test_counter');
      
      expect(counter.value).toBe(0);
      
      counter.inc();
      expect(counter.value).toBe(1);
      
      counter.inc(5);
      expect(counter.value).toBe(6);
    });

    it('should reset counter', () => {
      const counter = createCounter('test_counter');
      
      counter.inc(10);
      expect(counter.value).toBe(10);
      
      counter.reset();
      expect(counter.value).toBe(0);
    });
  });

  describe('Gauge', () => {
    it('should set gauge value', () => {
      const gauge = createGauge('test_gauge');
      
      expect(gauge.value).toBe(0);
      
      gauge.set(42);
      expect(gauge.value).toBe(42);
    });

    it('should increment and decrement', () => {
      const gauge = createGauge('test_gauge');
      
      gauge.inc(5);
      expect(gauge.value).toBe(5);
      
      gauge.dec(2);
      expect(gauge.value).toBe(3);
    });

    it('should reset gauge', () => {
      const gauge = createGauge('test_gauge');
      
      gauge.set(100);
      gauge.reset();
      expect(gauge.value).toBe(0);
    });
  });

  describe('Histogram', () => {
    it('should observe values', () => {
      const histogram = createHistogram('test_histogram');
      
      histogram.observe(10);
      histogram.observe(20);
      histogram.observe(30);
      
      const { p50, p95, p99 } = histogram.percentiles;
      
      expect(p50).toBe(20);
      expect(p95).toBe(30);
      expect(p99).toBe(30);
    });

    it('should calculate percentiles correctly', () => {
      const histogram = createHistogram('test_histogram');
      
      // Add 100 values
      for (let i = 1; i <= 100; i++) {
        histogram.observe(i);
      }
      
      const { p50, p95, p99 } = histogram.percentiles;
      
      expect(p50).toBeGreaterThanOrEqual(50);
      expect(p50).toBeLessThanOrEqual(51);
      expect(p95).toBeGreaterThanOrEqual(95);
      expect(p99).toBeGreaterThanOrEqual(99);
    });

    it('should handle empty histogram', () => {
      const histogram = createHistogram('test_histogram');
      
      const { p50, p95, p99 } = histogram.percentiles;
      
      expect(p50).toBe(0);
      expect(p95).toBe(0);
      expect(p99).toBe(0);
    });

    it('should limit stored values', () => {
      const histogram = createHistogram('test_histogram');
      
      // Add 1500 values (more than maxValues=1000)
      for (let i = 0; i < 1500; i++) {
        histogram.observe(i);
      }
      
      // Should only keep last 1000
      const { p50, p95, p99 } = histogram.percentiles;
      
      expect(p50).toBeGreaterThan(400); // Should be around 900
      expect(p99).toBeLessThanOrEqual(1499);
    });
  });

  describe('AuditLogger', () => {
    it('should log audit entries', () => {
      const logger = new AuditLogger();
      
      logger.log({
        platform: 'messenger',
        action: 'webhook_received',
        accountId: 'account-123',
        success: true,
      });
      
      const logs = logger.getRecent(10);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].platform).toBe('messenger');
      expect(logs[0].action).toBe('webhook_received');
      expect(logs[0].accountId).toBe('account-123');
      expect(logs[0].success).toBe(true);
      expect(logs[0].timestamp).toBeDefined();
    });

    it('should limit log storage', () => {
      const logger = new AuditLogger();
      logger.maxLogs = 100;
      
      // Add 150 logs
      for (let i = 0; i < 150; i++) {
        logger.log({
          platform: 'messenger',
          action: 'message_inbound',
          accountId: `account-${i}`,
          success: true,
        });
      }
      
      const logs = logger.getRecent(200);
      expect(logs).toHaveLength(100);
      expect(logs[0].accountId).toBe('account-50'); // First 50 were trimmed
    });

    it('should filter logs', () => {
      const logger = new AuditLogger();
      
      logger.log({
        platform: 'messenger',
        action: 'webhook_received',
        accountId: 'account-1',
        success: true,
      });
      
      logger.log({
        platform: 'instagram',
        action: 'webhook_received',
        accountId: 'account-2',
        success: false,
      });
      
      logger.log({
        platform: 'messenger',
        action: 'message_inbound',
        accountId: 'account-1',
        success: true,
      });
      
      // Filter by platform
      const messengerLogs = logger.filter({ platform: 'messenger' });
      expect(messengerLogs).toHaveLength(2);
      
      // Filter by success
      const failedLogs = logger.filter({ success: false });
      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0].platform).toBe('instagram');
      
      // Filter by action
      const webhookLogs = logger.filter({ action: 'webhook_received' });
      expect(webhookLogs).toHaveLength(2);
    });

    it('should export to JSON', () => {
      const logger = new AuditLogger();
      
      logger.log({
        platform: 'messenger',
        action: 'webhook_received',
        accountId: 'account-123',
        success: true,
      });
      
      const json = logger.export('json');
      const parsed = JSON.parse(json);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0].platform).toBe('messenger');
    });

    it('should export to CSV', () => {
      const logger = new AuditLogger();
      
      logger.log({
        platform: 'messenger',
        action: 'webhook_received',
        accountId: 'account-123',
        success: true,
      });
      
      const csv = logger.export('csv');
      const lines = csv.split('\n');
      
      expect(lines[0]).toContain('timestamp,platform,action,accountId');
      expect(lines[1]).toContain('messenger,webhook_received,account-123');
    });

    it('should emit events', () => {
      const logger = new AuditLogger();
      let emitted: any = null;
      
      logger.on('audit', (entry) => {
        emitted = entry;
      });
      
      logger.log({
        platform: 'messenger',
        action: 'webhook_received',
        accountId: 'account-123',
        success: true,
      });
      
      expect(emitted).not.toBeNull();
      expect(emitted.platform).toBe('messenger');
    });
  });

  describe('MetaMetrics', () => {
    it('should initialize all metrics', () => {
      const m = createMetaMetrics();
      
      expect(m.inboundMessages).toBeDefined();
      expect(m.outboundMessages).toBeDefined();
      expect(m.webhookReceived).toBeDefined();
      expect(m.webhookVerified).toBeDefined();
      expect(m.webhookRejected).toBeDefined();
      expect(m.webhookLatency).toBeDefined();
      expect(m.oauthTokenRefresh).toBeDefined();
      expect(m.oauthTokenExpiring).toBeDefined();
      expect(m.rateLimitHits).toBeDefined();
      expect(m.rateLimitRetries).toBeDefined();
      expect(m.sessionWindowsActive).toBeDefined();
      expect(m.sessionWindowsExpired).toBeDefined();
      expect(m.deliverySuccess).toBeDefined();
      expect(m.deliveryFailure).toBeDefined();
      expect(m.deliveryLatency).toBeDefined();
    });
  });

  describe('Webhook Middleware', () => {
    it('should track webhook received', () => {
      const middleware = createWebhookMiddleware('messenger');
      
      middleware.onReceived();
      
      expect(metrics.webhookReceived.value).toBe(1);
      expect(auditLogger.getRecent(1)[0].action).toBe('webhook_received');
    });

    it('should track webhook verified with latency', () => {
      const middleware = createWebhookMiddleware('messenger');
      
      middleware.onVerified('account-123', 45);
      
      expect(metrics.webhookVerified.value).toBe(1);
      expect(metrics.webhookLatency.percentiles.p50).toBe(45);
      
      const log = auditLogger.getRecent(1)[0];
      expect(log.action).toBe('webhook_verified');
      expect(log.accountId).toBe('account-123');
      expect(log.success).toBe(true);
    });

    it('should track webhook rejected', () => {
      const middleware = createWebhookMiddleware('messenger');
      
      middleware.onRejected('account-123', 'Invalid signature');
      
      expect(metrics.webhookRejected.value).toBe(1);
      
      const log = auditLogger.getRecent(1)[0];
      expect(log.action).toBe('webhook_rejected');
      expect(log.success).toBe(false);
      expect(log.errorMessage).toBe('Invalid signature');
    });
  });

  describe('Message Middleware', () => {
    it('should track inbound message', () => {
      const middleware = createMessageMiddleware('messenger');
      
      middleware.onInbound('account-123', 'user-456', 'msg-789', 'text');
      
      expect(metrics.inboundMessages.value).toBe(1);
      expect(metrics.inboundMessagesByPlatform['messenger'].value).toBe(1);
      expect(metrics.inboundMessagesByType['text'].value).toBe(1);
      
      const log = auditLogger.getRecent(1)[0];
      expect(log.action).toBe('message_inbound');
      expect(log.userId).toBe('user-456');
      expect(log.messageId).toBe('msg-789');
    });

    it('should track outbound message', () => {
      const middleware = createMessageMiddleware('instagram');
      
      middleware.onOutbound('account-123', 'user-456', 'msg-789', 'image');
      
      expect(metrics.outboundMessages.value).toBe(1);
      expect(metrics.outboundMessagesByPlatform['instagram'].value).toBe(1);
      expect(metrics.outboundMessagesByType['image'].value).toBe(1);
    });

    it('should track delivery success with latency', () => {
      const middleware = createMessageMiddleware('threads');
      
      middleware.onDeliverySuccess('account-123', 'user-456', 'msg-789', 120);
      
      expect(metrics.deliverySuccess.value).toBe(1);
      expect(metrics.deliveryLatency.percentiles.p50).toBe(120);
      
      const log = auditLogger.getRecent(1)[0];
      expect(log.action).toBe('delivery_success');
      expect(log.success).toBe(true);
    });

    it('should track delivery failure', () => {
      const middleware = createMessageMiddleware('messenger');
      
      middleware.onDeliveryFailure('account-123', 'user-456', 'msg-789', '#131046', 'Outside 24h window');
      
      expect(metrics.deliveryFailure.value).toBe(1);
      expect(metrics.errorsByPlatform['messenger'].value).toBe(1);
      expect(metrics.errorsByType['#131046'].value).toBe(1);
      
      const log = auditLogger.getRecent(1)[0];
      expect(log.action).toBe('delivery_failure');
      expect(log.success).toBe(false);
      expect(log.errorCode).toBe('#131046');
    });
  });

  describe('Prometheus Export', () => {
    it('should export metrics in Prometheus format', () => {
      // Set some metrics
      metrics.inboundMessages.inc(10);
      metrics.outboundMessages.inc(5);
      metrics.webhookReceived.inc(100);
      
      const output = exportPrometheusMetrics();
      
      expect(output).toContain('# TYPE meta_inbound_messages_total counter');
      expect(output).toContain('meta_inbound_messages_total 10');
      expect(output).toContain('# TYPE meta_outbound_messages_total counter');
      expect(output).toContain('meta_outbound_messages_total 5');
      expect(output).toContain('# TYPE meta_webhook_received_total counter');
      expect(output).toContain('meta_webhook_received_total 100');
    });

    it('should export histogram percentiles', () => {
      metrics.webhookLatency.observe(50);
      metrics.webhookLatency.observe(100);
      metrics.webhookLatency.observe(150);
      
      const output = exportPrometheusMetrics();
      
      expect(output).toContain('# TYPE meta_webhook_latency_seconds summary');
      expect(output).toContain('{quantile="0.5"}');
      expect(output).toContain('{quantile="0.95"}');
      expect(output).toContain('{quantile="0.99"}');
    });

    it('should export gauge metrics', () => {
      metrics.sessionWindowsActive.set(42);
      
      const output = exportPrometheusMetrics();
      
      expect(output).toContain('# TYPE meta_session_windows_active gauge');
      expect(output).toContain('meta_session_windows_active 42');
    });
  });
});
