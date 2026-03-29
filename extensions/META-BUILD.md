# Meta Plugins - Build Guide

## Status da Compilação

### ✅ meta-common
Compilando com sucesso:
```bash
cd extensions/meta-common
pnpm exec tsc -p tsconfig.json
```

Output: `dist/` gerado com todos os arquivos JS + DTS

### ⏳ messenger / instagram / threads

Estes plugins dependem de tipos do core OpenClaw (`openclaw/plugin-sdk/core`) que causam erros de compilação devido à estrutura de workspace monorepo.

## Soluções

### Opção 1: Build Como Parte do Root (Recomendado)

Os plugins Meta devem ser compilados como parte do build root do OpenClaw, não isoladamente. O `tsdown-build.mjs` já resolve dependências do core.

**Passos:**
1. Adicionar plugins ao `tsdown.config.ts` root
2. Rodar `pnpm build` no root
3. tsdown resolve imports do core automaticamente

### Opção 2: Standalone Build (Workaround)

Criar versões standalone dos plugins com tipos inline:

```bash
# Criar pasta build-temp
mkdir -p extensions/meta-plugins-bundle

# Copiar apenas arquivos que não dependem do core
cp -r extensions/meta-common/dist extensions/meta-plugins-bundle/

# Copiar manifests
cp extensions/messenger/openclaw.plugin.json extensions/meta-plugins-bundle/
cp extensions/instagram/openclaw.plugin.json extensions/meta-plugins-bundle/
cp extensions/threads/openclaw.plugin.json extensions/meta-plugins-bundle/
```

### Opção 3: Runtime Loading (Produção)

Em produção, os plugins são carregados via:
1. npm install @openclaw/messenger (quando publicado)
2. Plugin SDK carrega em runtime
3. TypeScript compilação não é necessária em runtime

## Publicação NPM

Para publicar os plugins:

```bash
# 1. Build
cd extensions/meta-common && pnpm build

# 2. Update version
# Edit package.json version

# 3. Publish
cd extensions/meta-common
npm publish --access public

# Repetir para messenger, instagram, threads
```

## Configuração de Produção

No `openclaw.json` do usuário:

```json5
{
  channels: {
    messenger: {
      accounts: {
        primary: {
          enabled: true,
          pageId: "123456789",
          accessToken: "${MESSENGER_TOKEN}",
          appSecret: "${META_APP_SECRET}",
          verifyToken: "${VERIFY_TOKEN}",
          webhookPath: "/webhooks/messenger"
        }
      }
    }
  }
}
```

## Webhook Setup

1. **Meta Developers Portal** > App > Webhooks
2. **Callback URL**: `https://seu-dominio.com/webhooks/messenger`
3. **Verify Token**: `openclaw-meta-webhook-verify`
4. **Subscribe fields**: `messages`, `messaging_postbacks`

## Testes

```bash
# Testar recebimento
curl -X POST http://localhost:18789/webhooks/messenger \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=TEST" \
  -d '{"object":"page","entry":[{"id":"123","messaging":[{"sender":{"id":"456"},"message":{"text":"test"}}]}]}'

# Expected: 200 OK ou 403 (signature invalid)
```

## Troubleshooting

### Erro: Module not found: openclaw/plugin-sdk/core

**Solução:** Build deve ser feito no contexto do workspace root.

### Erro: Webhook 403

**Solução:** Verificar signature validation com app secret correto.

### Erro: Token inválido

**Solução:** Gerar novo Page Access Token no Graph API Explorer.
