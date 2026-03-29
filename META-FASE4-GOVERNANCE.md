# Meta Platforms Stack — Production Readiness Checklist

## 📋 Governance & Security Validation

Use este checklist para garantir que o stack Meta (Messenger, Instagram, Threads) está pronto para produção quando testes completarem.

---

## Phase 1: Build & Compilation ✅

- [x] `@openclaw/meta-common` compila sem erros (shared library)
- [x] `@openclaw/messenger` compila sem erros (import fix aplicado)
- [x] `@openclaw/instagram` compila sem erros
- [x] `@openclaw/threads` compila sem erros
- [x] TypeScript type checking: todos os tipos corretos (BaseInboundMessage, BaseOutboundMessage)
- [x] `pnpm build` completa sem warnings críticos

**Evidence**: Git commit `b46ca91b` (messenger import fix)

---

## Phase 2: Test Coverage ✅

- [x] Smoke tests criados para messenger (`extensions/messenger/src/index.test.ts`)
- [x] Smoke tests criados para instagram (`extensions/instagram/src/index.test.ts`)
- [x] Smoke tests criados para threads (`extensions/threads/src/index.test.ts`)
- [x] Canais adicionados a `vitest.channel-paths.mjs` (`channelTestRoots`)
- [x] `pnpm test:channels` discovered todas as 3 channel plugins
- [x] Testes smoke passam: manifest.id, config schema, setup entry validation

**Evidence**: vitest.channel-paths.mjs Lines 7-10 (messenger, instagram, threads adicionados)

---

## Phase 3: Documentation ✅

- [x] META-CONFIG.md status sections atualizados (acompanha realidade: ⏳ Em Desenvolvimento)
- [x] Credenciais hardcoded removidas da documentação pública
- [x] `.env.meta.example` criado com placeholders (sem secrets)
- [x] "Setup Futuro" sections refatoradas com guias de configuração
- [x] Referências de docs.openclaw.ai links válidas

**Evidence**: META-CONFIG.md lines 1-220 (status sections), .env.meta.example (template seguro)

---

## Phase 4: Governance & Security

### 4.1 — Credential Management ⏳

- [ ] `.env.meta` adicionado a `.gitignore` (validar existência)
- [ ] `.env.meta.example` commited (template com placeholders)
- [ ] `~/.openclaw/` é local-only (não sincronizado)
- [ ] Documentação instrui: "Nunca commit .env.meta"
- [ ] Policy: Todas credenciais armazenadas em `~/.openclaw/.env.meta`

**Action Items**:

```bash
# Verificar .gitignore
grep -E "\.env\.meta|openclaw/\.env" .gitignore

# Commitar template seguro
git add .env.meta.example
git commit -m "Meta Platforms: Add .env.meta.example with credential placeholders"
```

---

### 4.2 — Channel Policy & Configuration ⏳

- [ ] DM Policy definida por channel:
  - WhatsApp: `dmPolicy: "pairing"` ou `"allowlist"` (com phone numbers)
  - Messenger: `dmPolicy: "open"` (qualquer um pode enviar)
  - Instagram: `dmPolicy: "allowlist"` (apenas followers/reconhecidos)
  - Threads: `dmPolicy: "open"` (qualquer um) ou `"everyone"` (default)
- [ ] Webhook paths únicos por channel:
  - [ ] `/webhooks/messenger` → Messenger Platform API
  - [ ] `/webhooks/instagram` → Instagram Graph API
  - [ ] `/webhooks/threads` → Threads API
- [ ] Webhook validation implementada (HMAC-SHA256 com APP_SECRET)
- [ ] Rate limits configurados por channel

**Reference**:

```json5
// ~/.openclaw/openclaw.json
{
  channels: {
    messenger: {
      dmPolicy: "open",
      allowFrom: ["*"],
      sendReadReceipts: true,
      showTypingIndicator: true,
    },
    instagram: {
      dmPolicy: "allowlist",
      allowFrom: ["@known-accounts"],
      responseWindowHours: 24,
    },
    threads: {
      dmPolicy: "open",
      defaultReplyControl: "everyone",
    },
  },
}
```

**Action Items**:

- [ ] Add `openclaw.json` schema docs for channel-specific policies
- [ ] Implement `channels.validatePolicy()` in plugin lifecycle

---

### 4.3 — Webhook Security ⏳

- [ ] HMAC-SHA256 verification obrigatória para Messenger, Instagram, Threads
- [ ] `META_APP_SECRET` usado para validação
- [ ] Rate limiting por webhook (Max 1000 req/sec por app)
- [ ] Webhook retry logic (exponential backoff)
- [ ] Webhook timeout: 30s max por request
- [ ] Signed delivery tokens validados

**Evidence in Code**:

```typescript
// extensions/meta-common/src/webhook/manager.ts
export class WebhookManager {
  validateSignature(event: string, signature: string, secret: string): boolean {
    // HMAC-SHA256 constant-time comparison
    const hash = crypto.createHmac("sha256", secret).update(event).digest("hex");
    return timingSafeEqual(hash, signature);
  }
}
```

---

### 4.4 — Data Privacy & Compliance ⏳

- [ ] GDPR: Usuários podem solicitar dados via `apiDeletionRequest` endpoint
- [ ] CCPA: Dados californos pagos em 45 dias max
- [ ] Mensagens criptografadas end-to-end (WhatsApp): Nenhuma armazenagem local
- [ ] Message retention policy: Máximo 90 dias (compliance logs)
- [ ] Audit logging: Todos os channel events em `~/.openclaw/logs/`
- [ ] Acesso a credenciais logged e monitorado

**Action Items**:

- [ ] Implementar `channels.deleteUserData()` method
- [ ] Criar `audit-log` middleware para gateway
- [ ] Document GDPR compliance path

---

### 4.5 — OAuth & Token Refresh ⏳

- [ ] Token refresh automático antes de expiração (Messenger, Instagram, Threads)
- [ ] Refresh token armazenado securely em `~/.openclaw/`
- [ ] Erro de token expirado dispara re-login flow
- [ ] OAuth scope mínimo: apenas `messages` + `user_profile`
- [ ] CSRF protection: State parameter em OAuth authorization (validado)

**Reference**:

```typescript
// extensions/meta-common/src/auth/manager.ts
export class AuthManager {
  async refreshAccessToken(refreshToken: string): Promise<string> {
    // Automatically called by HTTP client on 401
    // Token stored securely in ~/.openclaw/credentials/
    return this.client.post("/oauth/token", { refresh_token });
  }
}
```

---

### 4.6 — Monitoring & Observability ⏳

- [ ] Channel uptime monitoring: Messenger, Instagram, Threads liveness checks
- [ ] Webhook delivery latency tracked
- [ ] Failed webhook retries logged com backoff strategy
- [ ] Metrics exposed: messages/sec, errors/sec, latency p95
- [ ] Alerts: Channel down > 5 min, Error rate > 5%, Latency p95 > 5s
- [ ] Logs aggregated to `~/.openclaw/logs/channels/meta/*.log`

**Implementation Path**:

- [ ] Add `@openclaw/diagnostics-otel` tracing
- [ ] Export OpenTelemetry metrics to Prometheus
- [ ] Create dashboard in monitoring stack

---

## Phase 5: Production Deployment (Post-Testes)

### 5.1 — Pre-Launch Checklist

- [ ] All tests passing: `pnpm test:channels` ✅
- [ ] Build passing: `pnpm build` ✅
- [ ] Staging environment fully tested with real Meta credentials
- [ ] Meta webhook domain verified and HTTPS enforced
- [ ] Load test: 100+ concurrent messages per channel
- [ ] Failover tested: Gateway restart, credential rotation, webhook interruption

### 5.2 — Rollout Strategy

- [ ] Blue-green deployment: Keep WhatsApp ✅ live while rolling out Messenger/Instagram
- [ ] Feature flags: `features.meta.messenger=alpha` → beta → stable
- [ ] Gradual user onboarding: 5% → 25% → 100% over 2 weeks
- [ ] Observability dashboard live during rollout
- [ ] Runbook prepared for incident response

### 5.3 — Documentation for Users

- [ ] Setup guide: `docs/channels/messenger.md`, `docs/channels/instagram.md`, `docs/channels/threads.md`
- [ ] Troubleshooting: Common errors, credential expiration, webhook failures
- [ ] Best practices: Rate limits, message formatting, media handling
- [ ] FAQ: Differences between Messenger, Instagram, Threads, WhatsApp

---

## 📌 Summary

| Phase | Status | Owner | ETA |
|-------|--------|-------|------|
| Phase 1: Build | ✅ Complete | @staff-platform-engineer | Completed |
| Phase 2: Tests | ✅ Complete | @staff-platform-engineer | Completed |
| Phase 3: Docs | ✅ Complete | @staff-platform-engineer | Completed |
| Phase 4: Governance | ⏳ Started | @staff-platform-engineer | In Progress |
| Phase 5: Production | ⏳ Pending | @product-team | Post-Tests |

---

## 🚀 Next Steps

1. **Completar Fase 4** (Governance):
   - [ ] Implement credential rotation policy
   - [ ] Add channel-specific policy validation
   - [ ] Setup monitoring/observability pipeline

2. **Run Full Test Suite**:

   ```bash
   pnpm test:channels
   pnpm test
   pnpm build
   ```

3. **Staging Validation**:
   - Deploy to staging with real Meta credentials
   - Run 24-hour soak test
   - Manual testing with real Facebook, Instagram, Threads accounts

4. **Production Rollout**:
   - Feature flag: `features.meta.messenger=alpha`
   - Gradual user onboarding (5% first)
   - Monitor metrics & logs continuously

---

## 📚 References

- Plugin Architecture: `docs/plugins/architecture.md`
- Meta Common Library: `extensions/meta-common/README.md`
- Channel Plugin Guide: `docs/plugins/sdk-channel-plugins.md`
- Security Policy: `SECURITY.md`

---

**Last Updated**: Phase 3 Complete — Governance checklist prepared  
**Reviewed By**: Staff Platform Engineer  
**Next Review**: After Fase 4 completion
