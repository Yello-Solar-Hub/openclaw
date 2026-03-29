/**
 * Threads Setup Wizard
 */
import type { SetupAPI } from 'openclaw/plugin-sdk/setup';

export async function runSetupWizard(api: SetupAPI) {
  api.console.info('Threads API Setup Wizard');
  api.console.info('========================');
  
  const appId = await api.prompt({
    message: 'Enter your Meta App ID:',
    validate: (v: string) => /^\d+$/.test(v) ? true : 'Must be numeric'
  });

  const appSecret = await api.prompt({
    message: 'Enter your Meta App Secret:',
    password: true
  });

  api.console.info(`
To get Threads User ID:
1. Go to https://developers.facebook.com/tools/explorer
2. Select your app: ${appId}
3. GET /me?fields=threads
4. Copy the threads.id
`);

  const threadsUserId = await api.prompt({
    message: 'Enter your Threads User ID:',
    validate: (v: string) => /^\d+$/.test(v) ? true : 'Must be numeric'
  });

  api.console.info(`
To get Threads Access Token:
1. Go to https://developers.facebook.com/tools/explorer
2. Get Token with permissions: threads_basic, threads_manage_messages
3. Copy the token
`);

  const accessToken = await api.prompt({
    message: 'Enter your Threads Access Token:',
    password: true
  });

  const verifyToken = crypto.randomUUID().replace(/-/g, '');
  
  const accountId = await api.prompt({
    message: 'Account ID (internal reference):',
    defaultValue: 'primary'
  });

  const config = {
    accounts: {
      [accountId]: {
        enabled: true,
        threadsUserId,
        accessToken,
        appSecret,
        verifyToken,
        webhookPath: '/webhooks/threads',
        defaultReplyControl: 'everyone' as const
      }
    }
  };

  await api.config.set('channels.threads', config);

  api.console.success(`
✅ Threads setup complete!

Account: ${accountId}
Threads User ID: ${threadsUserId}

Next steps:
1. Configure webhook in Meta Developers Portal
2. Callback URL: https://your-domain.com/webhooks/threads
3. Verify Token: ${verifyToken}
4. Subscribe to: mentions
`);

  return { success: true, channel: 'threads', accountId, config };
}

const crypto = {
  randomUUID: () => {
    if (typeof globalThis.crypto !== 'undefined') {
      return globalThis.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

export default runSetupWizard;
