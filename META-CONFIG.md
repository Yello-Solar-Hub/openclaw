# Configuração Meta Platforms (Facebook, Instagram, Threads, WhatsApp)

## 📊 Status Atual no OpenClaw

### ✅ WhatsApp (Produção — Disponível Hoje)
- **Método**: WhatsApp Web via Baileys (QR Code)
- **Setup**: `openclaw channels login --channel whatsapp`
- **Credenciais**: Salvas automaticamente em `~/.openclaw/credentials/whatsapp/`
- **Status**: ✅ Produção (testes completos, documentado)
- **Documentação**: [docs/channels/whatsapp.md](docs/channels/whatsapp.md)

### ⏳ Facebook Messenger (Em Desenvolvimento — Build Pronto)
- **Método**: Messenger Platform API (webhooks)
- **Setup**: `openclaw channels login --channel messenger` (quando testes passarem)
- **Plugin**: `@openclaw/messenger`
- **Status**: ⏳ Código-fonte pronto, compilável, testes smoke adicionados
- **Documentação**: Em preparação

### ⏳ Instagram DM (Em Desenvolvimento — Build Pronto)
- **Método**: Instagram Graph API (webhooks)
- **Setup**: `openclaw channels login --channel instagram` (quando testes passarem)
- **Plugin**: `@openclaw/instagram`
- **Status**: ⏳ Código-fonte pronto, compilável, testes smoke adicionados
- **Documentação**: Em preparação

### ⏳ Threads (Em Desenvolvimento — Build Pronto)
- **Método**: Threads API (webhooks)
- **Setup**: `openclaw channels login --channel threads` (quando testes passarem)
- **Plugin**: `@openclaw/threads`
- **Status**: ⏳ Código-fonte pronto, compilável, testes smoke adicionados
- **Documentação**: Em preparação

---

## 🔐 Variáveis de Ambiente (Template)

Use `.env.meta.example` como referência (segredos **nunca** devem ser commitados):

```bash
# ========== Meta App Credentials ==========
META_APP_ID="seu-app-id"
META_APP_SECRET="seu-app-secret"

# ========== WhatsApp (Disponível) ==========
# Nenhuma env necessária (credenciais armazenadas localmente)

# ========== Messenger (Futuro) ==========
MESSENGER_PAGE_ID="sua-page-id"
MESSENGER_PAGE_ACCESS_TOKEN="seu-token"
MESSENGER_VERIFY_TOKEN="seu-token-webhook"

# ========== Instagram (Futuro) ==========
INSTAGRAM_BUSINESS_ACCOUNT_ID="seu-instagram-id"
INSTAGRAM_ACCESS_TOKEN="seu-token"
INSTAGRAM_VERIFY_TOKEN="seu-token-webhook"

# ========== Threads (Futuro) ==========
THREADS_ACCESS_TOKEN="seu-token"
THREADS_USER_ID="seu-threads-id"
THREADS_VERIFY_TOKEN="seu-token-webhook"

# ========== Webhook ==========
META_WEBHOOK_VERIFY_TOKEN="seu-verify-token-unico"
META_WEBHOOK_CALLBACK_URL="https://seu-dominio.com/webhooks/meta"
```

---

## Setup do WhatsApp (Disponível Agora)

### Passo 1: Instalar plugin do WhatsApp

```bash
pnpm openclaw plugins install @openclaw/whatsapp
```

### Passo 2: Fazer login com QR Code

```bash
pnpm openclaw channels login --channel whatsapp
```

1. Escaneie o QR Code com seu WhatsApp
2. Aguarde a confirmação de login
3. As credenciais são salvas em `~/.openclaw/credentials/whatsapp/`

### Passo 3: Configurar permissões

Edite `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "pairing", // ou "allowlist"
      allowFrom: ["+5519999999999"], // números permitidos
      groupPolicy: "allowlist",
    },
  },
}
```

### Passo 4: Iniciar o Gateway

```bash
pnpm openclaw gateway run
```

---

## Setup Futuro: Facebook Messenger

**Status**: Código-fonte pronto. Aguardando validação de testes.

Quando estiver pronto em produção (CLI via setup wizard):

```bash
pnpm openclaw channels login --channel messenger
```

### Configuração Técnica (Referência)

```json5
{
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
  },
}
```

### Meta Developers Setup

1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Crie um App do tipo "Business"
3. Adicione o produto "Messenger"
4. Configure webhook no dashboard:
   - Callback: `https://seu-dominio.com/webhooks/messenger`
   - Verify Token: `seu-token-unico`
   - Subscribe: `messages`, `messaging_postbacks`

---

## Setup Futuro: Instagram DM

**Status**: Código-fonte pronto. Aguardando validação de testes.

```bash
pnpm openclaw channels login --channel instagram
```

### Configuração Técnica (Referência)

```json5
{
  channels: {
    instagram: {
      accounts: {
        primary: {
          enabled: true,
          instagramAccountId: "${INSTAGRAM_ACCOUNT_ID}",
          facebookPageId: "${FACEBOOK_PAGE_ID}",
          accessToken: "${INSTAGRAM_ACCESS_TOKEN}",
          appSecret: "${META_APP_SECRET}",
          verifyToken: "${INSTAGRAM_VERIFY_TOKEN}",
          webhookPath: "/webhooks/instagram",
          responseWindowHours: 24
        }
      }
    },
  },
}
```

---

## Setup Futuro: Threads

**Status**: Código-fonte pronto. Aguardando validação de testes.

```bash
pnpm openclaw channels login --channel threads
```

### Configuração Técnica (Referência)

```json5
{
  channels: {
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
    },
  },
}
```

---

## Segurança & Boas Práticas

### ⚠️ Segredos Nunca Devem Ser Commitados
- Tokens de acesso (META, Messenger, Instagram, Threads)
- App Secrets
- Verify tokens de webhooks
- URLs reais de callback

### ✅ Como Manejar Credenciais

1. **Desenvolvimento Local**:
   ```bash
   cp .env.meta.example .env.meta
   # Edite .env.meta com SUAS credenciais (nunca commitar)
   ```

2. **Template Público** (.env.meta.example):
   ```bash
   # Apenas placeholders, sem valores reais
   META_APP_ID="seu-app-id"
   META_APP_SECRET="seu-app-secret"
   ```

3. **Produção**:
   - Use gerenciadore de secrets (HashiCorp Vault, AWS Secrets Manager, etc)
   - Rotacione tokens a cada 90 dias
   - Habilite verificação em duas etapas na Meta Business

### 🔄 Rotação de Tokens
Tokens long-lived expiram em 60 dias:
```bash
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id=YOUR_APP_ID&
  client_secret=YOUR_APP_SECRET&
  fb_exchange_token=OLD_TOKEN"
```

---

## Troubleshooting

### WhatsApp QR Code não aparece

```bash
# Verifique se o plugin está instalado
pnpm openclaw plugins list | grep whatsapp

# Reinstale se necessário
pnpm openclaw plugins reinstall @openclaw/whatsapp

# Tente login novamente
pnpm openclaw channels login --channel whatsapp --verbose
```

### Token Meta expirado

Tokens de longa duração expiram em 60 dias. Renove:

```bash
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id={app-id}&
  client_secret={app-secret}&
  fb_exchange_token={expired-token}"
```

### Webhook não recebe eventos

1. Verifique o callback URL no Meta Developers Portal
2. Confirme o verify token
3. Teste com `curl`:
   ```bash
   curl -X POST "https://api.yellosolarhub.com/webhooks/meta" \
     -H "Content-Type: application/json" \
     -d '{"object":"page","entry":[{"id":"123","changes":[]}]}
   ```

---

## Recursos

- [Meta Developers Portal](https://developers.facebook.com)
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Messenger Platform](https://developers.facebook.com/docs/messenger-platform)
- [Instagram API](https://developers.facebook.com/docs/instagram-api)
- [Threads API](https://developers.facebook.com/docs/threads)
- [OpenClaw WhatsApp Docs](https://docs.openclaw.ai/channels/whatsapp)

---

**Última atualização**: 2026-03-29
**OpenClaw Version**: 2026.3.28
