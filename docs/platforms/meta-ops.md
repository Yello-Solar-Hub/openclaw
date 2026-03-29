---
summary: "Meta Platforms observability guide covering metrics, logging, auditing, and monitoring for production operations"
read_when:
  - Setting up monitoring for Meta platform channels
  - Troubleshooting production issues
  - Configuring alerts and dashboards
title: "Meta Operations & Observability"
---

# Meta Platforms: Operations & Observability

Production operations guide for Meta Platforms stack (Messenger, Instagram, Threads).

<CardGroup cols={3}>
  <Card title="Metrics" icon="chart-bar" href="#metrics">
    Key metrics, Prometheus export, dashboards.
  </Card>
  <Card title="Logging" icon="file-lines" href="#logging">
    Log levels, export, analysis patterns.
  </Card>
  <Card title="Auditing" icon="shield-halved" href="#audit-trails">
    Audit trails, compliance, security monitoring.
  </Card>
</CardGroup>

## Metrics

### @openclaw/meta-common/observability

Gateway exports comprehensive metrics for all Meta platforms via ` @openclaw/meta-common/observability`:

```typescript
import { metrics, auditLogger, exportPrometheusMetrics } from '@openclaw/meta-common/observability';

// Access metrics programmatically
console.log('Inbound messages:', metrics.inboundMessages.value);
console.log('Webhook latency P95:', metrics.webhookLatency.percentiles.p95);

// Export Prometheus format
const prometheusOutput = exportPrometheusMetrics();
```

### Key Metrics

#### Inbound Messages

| Metric | Type | Description |
|--------|------|-------------|
| `meta_inbound_messages_total` | Counter | Total inbound messages received |
| `meta_inbound_messages_by_platform` | Counter[] | Inbound messages per platform (messenger, instagram, threads) |
| `meta_inbound_messages_by_type` | Counter[] | Inbound messages per type (text, image, video, etc.) |

#### Outbound Messages

| Metric | Type | Description |
|--------|------|-------------|
| `meta_outbound_messages_total` | Counter | Total outbound messages sent |
| `meta_outbound_messages_by_platform` | Counter[] | Outbound messages per platform |
| `meta_outbound_messages_by_type` | Counter[] | Outbound messages per type |

#### Webhooks

| Metric | Type | Description |
|--------|------|-------------|
| `meta_webhook_received_total` | Counter | Total webhooks received |
| `meta_webhook_verified_total` | Counter | Webhooks with valid signature |
| `meta_webhook_rejected_total` | Counter | Webhooks rejected (invalid signature) |
| `meta_webhook_latency_seconds` | Histogram | Webhook processing latency (p50, p95, p99) |

#### OAuth

| Metric | Type | Description |
|--------|------|-------------|
| `meta_oauth_token_refresh_total` | Counter | Token refresh events |
| `meta_oauth_token_expiring` | Gauge | Tokens expiring within 7 days |

#### Rate Limiting

| Metric | Type | Description |
|--------|------|-------------|
| `meta_rate_limit_hits_total` | Counter | Rate limit errors (429) |
| `meta_rate_limit_retries_total` | Counter | Retry attempts after rate limit |

#### Session Windows

| Metric | Type | Description |
|--------|------|-------------|
| `meta_session_windows_active` | Gauge | Active 24h session windows |
| `meta_session_windows_expired_total` | Counter | Expired session windows |

#### Delivery

| Metric | Type | Description |
|--------|------|-------------|
| `meta_delivery_success_total` | Counter | Successful message deliveries |
| `meta_delivery_failure_total` | Counter | Failed message deliveries |
| `meta_delivery_latency_seconds` | Histogram | Delivery latency (p50, p95, p99) |

#### Errors

| Metric | Type | Description |
|--------|------|-------------|
| `meta_errors_by_platform` | Counter[] | Errors per platform |
| `meta_errors_by_code` | Counter[] | Errors per error code |

### Prometheus Integration

Gateway exposes `/metrics` endpoint for Prometheus scraping:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'openclaw-gateway'
    static_configs:
      - targets: ['gateway-host:18789']
    metrics_path: '/metrics'
```

**Sample Prometheus output**:

```
# TYPE meta_inbound_messages_total counter
meta_inbound_messages_total 15234

# TYPE meta_webhook_latency_seconds summary
meta_webhook_latency_seconds{quantile="0.5"} 45
meta_webhook_latency_seconds{quantile="0.95"} 120
meta_webhook_latency_seconds{quantile="0.99"} 350

# TYPE meta_session_windows_active gauge
meta_session_windows_active 847
```

### Grafana Dashboards

Import pre-built Grafana dashboard from `docs/assets/meta-platforms-dashboard.json`:

```bash
# Import dashboard
curl -X POST http://grafana/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @docs/assets/meta-platforms-dashboard.json
```

**Dashboard panels**:

- Inbound/Outbound messages (time series)
- Webhook latency heatmap
- Error rate by platform
- Session window trends
- Delivery success rate
- OAuth token expiry timeline

## Logging

### Log Levels

Gateway uses structured logging with levels:

| Level | When | Example |
|-------|------|---------|
| `error` | Failures requiring attention | Webhook verification failed, delivery failed |
| `warn` | Recoverable issues | Rate limit hit, token expiring soon |
| `info` | Normal operations | Message sent, webhook received |
| `debug` | Detailed diagnostics | Payload contents, HTTP headers |
| `verbose` | Everything | Full request/response dumps |

### Log Format

```json
{
  "timestamp": "2026-03-29T10:15:30.123Z",
  "level": "info",
  "channel": "messenger",
  "event": "webhook_received",
  "accountId": "page-id-123",
  "messageId": "mid-456",
  "latencyMs": 45,
  "details": {
    "signature": "sha1=abc123...",
    "payloadSize": 1024
  }
}
```

### Log Commands

```bash
# View recent logs
openclaw logs --channel messenger --tail 100

# Verbose logging for debugging
openclaw logs --channel instagram --verbose

# Filter by event type
openclaw logs --channel threads --filter "webhook"
openclaw logs --channel messenger --filter "oauth"
openclaw logs --channel instagram --filter "delivery"

# Filter by level
openclaw logs --channel messenger --level error
openclaw logs --channel threads --level warn

# Export logs
openclaw logs --channel messenger --export json > logs.json
openclaw logs --channel instagram --export csv > logs.csv

# Real-time tail
openclaw logs --channel messenger --follow
```

### Log Analysis

#### Find webhook failures

```bash
openclaw logs --channel messenger --filter "webhook_rejected" --level error
```

#### Find delivery issues

```bash
openclaw logs --channel instagram --filter "delivery_failure" --level error
```

#### Track OAuth events

```bash
openclaw logs --channel threads --filter "oauth" --level info
```

#### High latency detection

```bash
openclaw logs --channel messenger --filter "latencyMs > 500" --level warn
```

### Log Aggregation

Forward logs to external systems:

#### Syslog

```bash
# Configure syslog forwarding
openclaw config set logging.syslog.enabled true
openclaw config set logging.syslog.host "syslog.example.com"
openclaw config set logging.syslog.port 514
```

#### JSON file export

```bash
# Enable JSON file logging
openclaw config set logging.file.enabled true
openclaw config set logging.file.path "/var/log/openclaw/gateway.json"
openclaw config set logging.file.format "json"
```

#### HTTP endpoint

```bash
# Forward to HTTP endpoint (e.g., Datadog, Splunk)
openclaw config set logging.http.enabled true
openclaw config set logging.http.url "https://logs.example.com/ingest"
openclaw config set logging.http.apiKey "<API_KEY>"
```

## Audit Trails

### Audit Log Events

| Event | Description | When |
|-------|-------------|------|
| `webhook_received` | Webhook POST received | Every webhook POST |
| `webhook_verified` | Signature verified | Valid HMAC signature |
| `webhook_rejected` | Signature verification failed | Invalid HMAC |
| `message_inbound` | Message received from user | Inbound message parsed |
| `message_outbound` | Message sent to user | Outbound message dispatched |
| `oauth_token_refresh` | Token refreshed | Auto-refresh before expiry |
| `oauth_token_generated` | New token generated | Manual OAuth flow |
| `config_changed` | Configuration modified | Config update via CLI |
| `rate_limit_hit` | Rate limit exceeded | 429 from Meta API |
| `delivery_success` | Message delivered | Delivery confirmation |
| `delivery_failure` | Delivery failed | Error from Meta API |

### Audit Log Access

```typescript
import { auditLogger } from '@openclaw/meta-common/observability';

// Get recent logs
const recent = auditLogger.getRecent(100);

// Filter by criteria
const failures = auditLogger.filter({
  platform: 'messenger',
  success: false,
  fromTimestamp: Date.now() - 3600000, // Last hour
});

// Export for analysis
const jsonExport = auditLogger.export('json');
const csvExport = auditLogger.export('csv');
```

### CLI Access

```bash
# View audit logs
openclaw audit list --channel messenger --limit 50

# Filter by event
openclaw audit list --channel instagram --event webhook_rejected

# Filter by time range
openclaw audit list --channel threads --from "2026-03-29T00:00:00Z" --to "2026-03-29T23:59:59Z"

# Export audit logs
openclaw audit export --format json --output audit.json
openclaw audit export --format csv --output audit.csv
```

### Compliance

Audit logs support compliance requirements:

- **GDPR**: Track all user data access and processing
- **SOC 2**: Maintain audit trails for security events
- **PCI DSS**: Log all payment-related message handling

**Retention policy**:

```bash
# Configure audit log retention
openclaw config set audit.retentionDays 90
openclaw config set audit.maxEntries 100000
```

### Security Monitoring

Alert on suspicious patterns:

```bash
# Multiple webhook rejections (potential attack)
openclaw audit list --event webhook_rejected --from "1h" | wc -l
# Alert if > 10 in 1 hour

# Unusual outbound volume (potential spam)
openclaw audit list --event message_outbound --from "1h" | wc -l
# Alert if > 1000 in 1 hour

# Failed delivery spikes
openclaw audit list --event delivery_failure --from "1h" | wc -l
# Alert if > 50 in 1 hour
```

## Alerting

### Recommended Alerts

#### Webhook Failures

```yaml
# Prometheus alert rule
- alert: MetaWebhookFailures
  expr: rate(meta_webhook_rejected_total[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Meta webhook signature failures"
    description: "Webhook rejections detected on {{ $labels.platform }}"
```

#### High Error Rate

```yaml
- alert: MetaHighErrorRate
  expr: rate(meta_delivery_failure_total[5m]) / rate(meta_outbound_messages_total[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High message delivery failure rate"
    description: "{{ $value | humanizePercentage }} failure rate on {{ $labels.platform }}"
```

#### Token Expiry

```yaml
- alert: MetaTokenExpiring
  expr: meta_oauth_token_expiring > 0
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: "Meta OAuth tokens expiring soon"
    description: "{{ $value }} tokens expiring within 7 days"
```

#### Rate Limiting

```yaml
- alert: MetaRateLimiting
  expr: rate(meta_rate_limit_hits_total[5m]) > 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Meta API rate limiting detected"
    description: "Rate limit hits on {{ $labels.platform }}"
```

#### Session Window Saturation

```yaml
- alert: MetaSessionWindowSaturation
  expr: meta_session_windows_active > 1000
  for: 10m
  labels:
    severity: info
  annotations:
    summary: "High number of active session windows"
    description: "{{ $value }} active session windows"
```

### Alert Destinations

Configure alert notifications:

```bash
# Email alerts
openclaw config set alerts.email.enabled true
openclaw config set alerts.email.recipients "ops@example.com"

# Slack alerts
openclaw config set alerts.slack.enabled true
openclaw config set alerts.slack.webhookUrl "https://hooks.slack.com/..."
openclaw config set alerts.slack.channel "#openclaw-alerts"

# PagerDuty alerts
openclaw config set alerts.pagerduty.enabled true
openclaw config set alerts.pagerduty.routingKey "<ROUTING_KEY>"
```

## Troubleshooting

### Common Issues

#### Webhook 401 Errors

**Symptoms**: `meta_webhook_rejected_total` increasing

**Diagnosis**:
```bash
openclaw logs --channel messenger --filter "webhook_rejected" --level error
```

**Causes**:
- `verifyToken` mismatch
- `appSecret` changed
- HMAC computation bug

**Fix**:
```bash
# Verify config matches Meta Dashboard
openclaw config get channels.messenger.webhook.verifyToken
# Compare with developers.facebook.com
```

#### High Latency

**Symptoms**: `meta_webhook_latency_seconds{p95} > 500ms`

**Diagnosis**:
```bash
openclaw logs --channel instagram --filter "latencyMs > 500" --level warn
```

**Causes**:
- Network issues
- Meta API slowness
- Gateway resource exhaustion

**Fix**:
- Check network connectivity
- Monitor gateway CPU/memory
- Scale gateway horizontally

#### Token Refresh Failures

**Symptoms**: `meta_oauth_token_refresh_total` flat, tokens expiring

**Diagnosis**:
```bash
openclaw logs --channel threads --filter "oauth" --level error
```

**Causes**:
- `appSecret` rotated
- OAuth endpoint unreachable
- Invalid refresh token

**Fix**:
```bash
# Manual re-auth
openclaw channels login --channel threads
```

#### Delivery Failures Spike

**Symptoms**: `meta_delivery_failure_total` increasing

**Diagnosis**:
```bash
openclaw audit list --event delivery_failure --from "1h"
```

**Causes**:
- User blocked account
- 24h window violation
- Meta API outage

**Fix**:
- Check error codes in audit logs
- Verify session window tracking
- Check Meta API status

### Diagnostic Playbook

```bash
# 1. Check overall health
openclaw channels status --channel messenger
openclaw channels status --channel instagram
openclaw channels status --channel threads

# 2. Check recent errors
openclaw logs --channel messenger --level error --tail 50

# 3. Check metrics
curl http://gateway-host:18789/metrics | grep meta_

# 4. Check audit logs
openclaw audit list --channel messenger --event delivery_failure --limit 20

# 5. Test webhook
curl -X POST https://gateway-host/webhooks/meta/messenger \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: sha1=test" \
  -d '{"object":"page","entry":[]}'

# 6. Check token expiry
openclaw config get channels.messenger.auth.accessToken --verbose
```

## Performance Tuning

### Webhook Concurrency

```bash
# Adjust webhook worker threads
openclaw config set channels.messenger.webhook.workers 4
openclaw config set channels.instagram.webhook.workers 4
openclaw config set channels.threads.webhook.workers 4
```

### Rate Limit Buffers

```bash
# Configure rate limit headroom
openclaw config set channels.messenger.rateLimitBuffer 0.8
openclaw config set channels.instagram.rateLimitBuffer 0.8
openclaw config set channels.threads.rateLimitBuffer 0.8
```

### Connection Pooling

```bash
# HTTP client connection pool
openclaw config set metaCommon.httpPoolSize 50
openclaw config set metaCommon.httpKeepAlive true
```

## Related

- [Messenger](/channels/messenger) — Messenger setup
- [Instagram](/channels/instagram) — Instagram setup
- [Threads](/channels/threads) — Threads setup
- [Meta Platforms](/platforms/meta) — Unified Meta setup
- [Logging](/logging) — General logging guide
