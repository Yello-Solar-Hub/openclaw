# Meta Plugins - Produção Guide

## 🚀 Deploy em Produção

### 1. Pré-requisitos

- [ ] Meta App aprovado em review
- [ ] HTTPS com certificado válido
- [ ] Domínio verificado no Meta Developers
- [ ] Variáveis de ambiente configuradas
- [ ] Backup de credentials configurado

### 2. Configurar Meta App

#### Developers Portal

1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Crie/Selecione seu App
3. Adicione produtos:
   - Messenger
   - Instagram (se aplicável)
   - Threads (se aplicável)

#### App Review

Para produção, seu app precisa passar por review:

**Messenger:**
- `pages_manage_metadata`
- `pages_read_engagement`
- `pages_messaging`

**Instagram:**
- `instagram_basic`
- `instagram_manage_messages`

**Threads:**
- `threads_basic`
- `threads_manage_messages`

### 3. Configurar Webhooks

#### URL do Webhook

```
https://api.yellosolarhub.com/webhooks/messenger
https://api.yellosolarhub.com/webhooks/instagram
https://api.yellosolarhub.com/webhooks/threads
```

#### Verify Token

Use tokens únicos por ambiente:

```bash
# Produção
MESSENGER_VERIFY_TOKEN="prod-verify-$(openssl rand -hex 16)"
INSTAGRAM_VERIFY_TOKEN="prod-verify-$(openssl rand -hex 16)"
THREADS_VERIFY_TOKEN="prod-verify-$(openssl rand -hex 16)"

# Staging
MESSENGER_VERIFY_TOKEN="staging-verify-$(openssl rand -hex 16)"
```

#### Subscription Fields

**Messenger:**
- `messages`
- `messaging_postbacks`
- `messaging_optins`
- `messaging_referrals`

**Instagram:**
- `messages`
- `messaging_postbacks`

**Threads:**
- `mentions`
- `replies`

### 4. Variáveis de Ambiente

```bash
# .env.production

# Meta App
META_APP_ID="1463820658272259"
META_APP_SECRET="seu-app-secret"

# Messenger
MESSENGER_PAGE_ID="sua-page-id"
MESSENGER_PAGE_ACCESS_TOKEN="seu-page-access-token"
MESSENGER_VERIFY_TOKEN="seu-verify-token"

# Instagram
INSTAGRAM_BUSINESS_ACCOUNT_ID="seu-instagram-id"
INSTAGRAM_ACCESS_TOKEN="seu-token"
INSTAGRAM_VERIFY_TOKEN="seu-verify-token"

# Threads
THREADS_USER_ID="seu-threads-id"
THREADS_ACCESS_TOKEN="seu-token"
THREADS_VERIFY_TOKEN="seu-verify-token"

# Gateway
OPENCLAW_GATEWAY_TOKEN="seu-gateway-token"
```

### 5. Configuração OpenClaw

```json5
// ~/.openclaw/openclaw.production.json
{
  gateway: {
    bind: "0.0.0.0",
    port: 18789,
    auth: {
      token: "${OPENCLAW_GATEWAY_TOKEN}"
    },
    tls: {
      enabled: true,
      cert: "/etc/ssl/certs/openclaw.crt",
      key: "/etc/ssl/private/openclaw.key"
    }
  },
  channels: {
    messenger: {
      accounts: {
        primary: {
          enabled: true,
          pageId: "${MESSENGER_PAGE_ID}",
          accessToken: "${MESSENGER_PAGE_ACCESS_TOKEN}",
          appSecret: "${META_APP_SECRET}",
          verifyToken: "${MESSENGER_VERIFY_TOKEN}",
          webhookPath: "/webhooks/messenger",
          sendReadReceipts: true,
          showTypingIndicator: true
        }
      },
      dmPolicy: "open",
      allowFrom: ["*"]
    },
    instagram: {
      accounts: {
        primary: {
          enabled: true,
          instagramAccountId: "${INSTAGRAM_BUSINESS_ACCOUNT_ID}",
          facebookPageId: "${MESSENGER_PAGE_ID}",
          accessToken: "${INSTAGRAM_ACCESS_TOKEN}",
          appSecret: "${META_APP_SECRET}",
          verifyToken: "${INSTAGRAM_VERIFY_TOKEN}",
          webhookPath: "/webhooks/instagram",
          responseWindowHours: 24
        }
      }
    },
    threads: {
      accounts: {
        primary: {
          enabled: true,
          threadsUserId: "${THREADS_USER_ID}",
          accessToken: "${THREADS_ACCESS_TOKEN}",
          appSecret: "${META_APP_SECRET}",
          verifyToken: "${THREADS_VERIFY_TOKEN}",
          webhookPath: "/webhooks/threads",
          defaultReplyControl: "everyone"
        }
      }
    }
  }
}
```

### 6. Deploy

#### Systemd (Linux)

```ini
# /etc/systemd/system/openclaw.service
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/opt/openclaw
Environment=NODE_ENV=production
EnvironmentFile=/etc/openclaw/.env
ExecStart=/usr/bin/node dist/index.js gateway run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable openclaw
sudo systemctl start openclaw
sudo systemctl status openclaw
```

#### Docker

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod

COPY dist/ ./dist/
COPY extensions/meta-common/dist/ ./extensions/meta-common/dist/

EXPOSE 18789

CMD ["node", "dist/index.js", "gateway", "run"]
```

```bash
docker build -t openclaw:latest .
docker run -d --name openclaw \
  -p 18789:18789 \
  -v /etc/openclaw:/root/.openclaw \
  --restart unless-stopped \
  openclaw:latest
```

### 7. Health Checks

#### Endpoint de Saúde

```bash
curl https://api.yellosolarhub.com/health

# Expected:
# {"status":"ok","gateway":"running","timestamp":1234567890}
```

#### Monitoramento de Webhooks

```bash
# Testar webhook
curl -X GET "https://api.yellosolarhub.com/webhooks/messenger?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=test"

# Expected: "test" (200 OK)
```

### 8. Logs

#### Systemd

```bash
journalctl -u openclaw -f
journalctl -u openclaw --since "1 hour ago"
```

#### Docker

```bash
docker logs -f openclaw
docker logs --tail 100 openclaw
```

#### Arquivo

```bash
tail -f ~/.openclaw/logs/openclaw.log
grep "ERROR" ~/.openclaw/logs/openclaw.log
```

---

## 📊 Monitoramento

### Métricas Principais

| Métrica | Descrição | Alerta |
|---------|-----------|--------|
| `meta_webhook_received_total` | Webhooks recebidos | - |
| `meta_webhook_errors_total` | Erros de webhook | > 1% |
| `meta_messages_sent_total` | Mensagens enviadas | - |
| `meta_messages_received_total` | Mensagens recebidas | - |
| `meta_delivery_latency_seconds` | Latência de entrega | p95 > 5s |
| `meta_token_expiry_seconds` | Tempo até expiração do token | < 7 dias |
| `meta_rate_limit_hits_total` | Rate limits atingidos | > 10/hora |

### Prometheus Exporter

```typescript
// src/infra/metrics-meta.ts
import { Counter, Histogram } from 'prom-client';

export const metaWebhookReceived = new Counter({
  name: 'meta_webhook_received_total',
  help: 'Total webhooks received from Meta',
  labelNames: ['platform', 'account_id']
});

export const metaWebhookErrors = new Counter({
  name: 'meta_webhook_errors_total',
  help: 'Total webhook errors',
  labelNames: ['platform', 'error_type']
});

export const metaMessagesSent = new Counter({
  name: 'meta_messages_sent_total',
  help: 'Total messages sent',
  labelNames: ['platform', 'account_id']
});

export const metaDeliveryLatency = new Histogram({
  name: 'meta_delivery_latency_seconds',
  help: 'Message delivery latency',
  labelNames: ['platform'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});
```

### Dashboard Grafana

Importar dashboard JSON:

```json
{
  "dashboard": {
    "title": "Meta Platforms",
    "panels": [
      {
        "title": "Webhooks Received",
        "targets": [{
          "expr": "rate(meta_webhook_received_total[5m])"
        }]
      },
      {
        "title": "Delivery Latency (p95)",
        "targets": [{
          "expr": "histogram_quantile(0.95, rate(meta_delivery_latency_seconds_bucket[5m]))"
        }]
      },
      {
        "title": "Token Expiry",
        "targets": [{
          "expr": "meta_token_expiry_seconds / 86400"
        }]
      }
    ]
  }
}
```

### Alertas (PagerDuty)

```yaml
# alertmanager.yml
groups:
  - name: meta-platforms
    rules:
      - alert: MetaWebhookErrors
        expr: rate(meta_webhook_errors_total[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Meta webhook error rate high"
          
      - alert: MetaTokenExpiring
        expr: meta_token_expiry_seconds < 604800
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Meta token expiring in less than 7 days"
          
      - alert: MetaDeliveryLatency
        expr: histogram_quantile(0.95, rate(meta_delivery_latency_seconds_bucket[5m])) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Meta delivery latency p95 > 5s"
```

---

## 🔐 Segurança

### Rotação de Tokens

```bash
#!/bin/bash
# scripts/rotate-meta-tokens.sh

# 1. Generate new token via Graph API
NEW_TOKEN=$(curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=$APP_ID&client_secret=$APP_SECRET&fb_exchange_token=$OLD_TOKEN" | jq -r '.access_token')

# 2. Update .env
sed -i "s/MESSENGER_PAGE_ACCESS_TOKEN=.*/MESSENGER_PAGE_ACCESS_TOKEN=\"$NEW_TOKEN\"/" .env

# 3. Reload config
curl -X POST http://localhost:18789/config/reload -H "Authorization: Bearer $GATEWAY_TOKEN"

# 4. Verify
curl -X GET http://localhost:18789/channels/status -H "Authorization: Bearer $GATEWAY_TOKEN"
```

### Audit Log

```json5
{
  "timestamp": "2026-03-29T12:00:00Z",
  "event": "meta.token.rotated",
  "actor": "system",
  "platform": "messenger",
  "accountId": "primary",
  "ip": "127.0.0.1",
  "result": "success"
}
```

### PII Redaction

```typescript
// Logs automaticamente redactam:
// - Access tokens
// - App secrets
// - Verify tokens
// - User IDs

logger.info('Message received', {
  platform: 'messenger',
  // from: '12345' // ❌ Não logar
  from: '[REDACTED]' // ✅
});
```

---

## 🧪 Testes em Produção (Safe)

### Smoke Tests

```bash
#!/bin/bash
# scripts/smoke-test-meta.sh

set -e

echo "Testing Messenger webhook..."
curl -X GET "https://api.yellosolarhub.com/webhooks/messenger?hub.mode=subscribe&hub.verify_token=$TOKEN&hub.challenge=test" | grep -q "test"

echo "Testing gateway health..."
curl -s https://api.yellosolarhub.com/health | jq -r '.status' | grep -q "ok"

echo "✅ All smoke tests passed"
```

### Canary Deploy

```bash
# 1. Deploy para 10% do tráfego
kubectl set image deployment/openclaw openclaw=openclaw:v2026.3.29-canary --replicas=1

# 2. Monitorar erros
kubectl logs -f deployment/openclaw-canary | grep ERROR

# 3. Se OK, rollout completo
kubectl rollout status deployment/openclaw

# 4. Se erro, rollback
kubectl rollout undo deployment/openclaw
```

---

## 📞 Suporte

### Contatos de Emergência

- **On-call**: #oncall-meta-platforms
- **Escalation**: pagerduty-meta-escalation
- **Meta Developer Support**: developers.facebook.com/support

### Runbook: Webhook Down

1. Verificar status do webhook:
   ```bash
   curl https://api.yellosolarhub.com/webhooks/messenger
   ```

2. Checar logs:
   ```bash
   journalctl -u openclaw -n 100
   ```

3. Verificar token:
   ```bash
   curl -X GET "https://graph.facebook.com/v21.0/me?access_token=$TOKEN"
   ```

4. Re-registrar webhook se necessário:
   ```bash
   node scripts/register-meta-webhooks.js
   ```

5. Notificar stakeholders se > 15min

---

**Última atualização:** 2026-03-29  
**Versão:** 1.0.0  
**Status:** Produção Ready
