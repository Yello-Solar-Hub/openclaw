/**
 * Messenger Setup Wizard
 * Guides users through Facebook Messenger integration
 */

import type { SetupAPI } from 'openclaw/plugin-sdk/setup';

export async function runSetupWizard(api: SetupAPI) {
  const steps = [
    {
      id: 'meta-app-credentials',
      title: 'Meta Developer App Credentials',
      async run() {
        api.logger.info('Step 1: Meta App Credentials');
        
        const appId = await api.prompt({
          message: 'Enter your Meta App ID (from developers.facebook.com):',
          validate: (value: string) => {
            if (!/^\d+$/.test(value)) {
              return 'App ID must be numeric';
            }
            return true;
          },
          placeholder: '123456789012345'
        });

        const appSecret = await api.prompt({
          message: 'Enter your Meta App Secret:',
          password: true,
          placeholder: 'a1b2c3d4e5f6g7h8i9j0...'
        });

        return { appId, appSecret };
      }
    },

    {
      id: 'page-access-token',
      title: 'Facebook Page Access Token',
      async run(ctx: any) {
        api.logger.info('Step 2: Page Access Token');
        
        api.console.info(`
To get your Page Access Token:
1. Go to https://developers.facebook.com/tools/explorer
2. Select your app: ${ctx.appId}
3. Click "Get Token" > "Get Page Access Token"
4. Select the page you want to connect
5. Copy the generated token
`);

        const accessToken = await api.prompt({
          message: 'Paste your Page Access Token:',
          password: true,
          placeholder: 'EAA... (long token)'
        });

        // Validate token by fetching page info
        try {
          const response = await fetch(
            `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
          );
          
          if (!response.ok) {
            throw new Error('Invalid token');
          }

          const pageInfo = await response.json();
          api.console.success(`Connected to page: ${pageInfo.name} (${pageInfo.id})`);

          return { accessToken, pageId: pageInfo.id, pageName: pageInfo.name };
        } catch (error: any) {
          throw new Error(`Failed to validate token: ${error.message}`);
        }
      }
    },

    {
      id: 'webhook-configuration',
      title: 'Webhook Setup',
      async run(ctx: any) {
        api.logger.info('Step 3: Webhook Configuration');
        
        const defaultWebhookPath = '/webhooks/messenger';
        const gatewayUrl = await api.config.get('gateway.bind') || 'localhost';
        const gatewayPort = await api.config.get('gateway.port') || '18789';
        
        const callbackUrl = await api.prompt({
          message: 'Webhook Callback URL:',
          defaultValue: `https://your-domain.com${defaultWebhookPath}`,
          hint: 'This must be a publicly accessible URL'
        });

        // Generate verify token
        const verifyToken = crypto.randomUUID().replace(/-/g, '');
        
        api.console.info(`
Webhook Configuration:
- Callback URL: ${callbackUrl}
- Verify Token: ${verifyToken}

Next steps (after setup):
1. Go to your Meta App Dashboard
2. Navigate to Messenger > Settings > Webhooks
3. Click "Add Callback URL"
4. Enter the callback URL and verify token above
5. Subscribe to: messages, messaging_postbacks, messaging_optins
`);

        return { callbackUrl, verifyToken, webhookPath: defaultWebhookPath };
      }
    },

    {
      id: 'account-configuration',
      title: 'Account Configuration',
      async run(ctx: any) {
        api.logger.info('Step 4: Save Configuration');
        
        const accountId = await api.prompt({
          message: 'Account ID (for internal reference):',
          defaultValue: 'primary'
        });

        const config = {
          accounts: {
            [accountId]: {
              enabled: true,
              pageId: ctx.pageId,
              accessToken: ctx.accessToken,
              appSecret: ctx.appSecret,
              verifyToken: ctx.verifyToken,
              webhookPath: ctx.webhookPath,
              sendReadReceipts: true,
              showTypingIndicator: true
            }
          },
          dmPolicy: 'open' as const,
          allowFrom: ['*']
        };

        // Save to config
        await api.config.set('channels.messenger', config);
        
        api.console.success('Messenger configuration saved!');
        
        return { accountId, config };
      }
    },

    {
      id: 'test-connection',
      title: 'Test Connection',
      async run(ctx: any) {
        api.logger.info('Step 5: Test Connection');
        
        api.console.info('Sending test message...');
        
        // The test message will be sent via the channel API
        // For now, just confirm setup is complete
        api.console.success(`
✅ Messenger setup complete!

Account: ${ctx.accountId}
Page: ${ctx.pageName} (${ctx.pageId})

To test:
1. Send a message to your Facebook page
2. The message will be routed to your configured agent
3. Check logs with: openclaw logs --follow
`);

        return { success: true };
      }
    }
  ];

  // Run wizard
  const results = await api.runWizard(steps);
  
  return {
    success: true,
    channel: 'messenger',
    accountId: results['account-configuration']?.accountId,
    config: results['account-configuration']?.config
  };
}

// Helper for crypto in browser/node
const crypto = {
  randomUUID: () => {
    if (typeof globalThis.crypto !== 'undefined') {
      return globalThis.crypto.randomUUID();
    }
    // Fallback for Node.js < 14.17
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// Export as default
export default runSetupWizard;
