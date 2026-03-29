/**
 * Instagram Setup Wizard
 */
import type { SetupAPI } from 'openclaw/plugin-sdk/setup';

export async function runSetupWizard(api: SetupAPI) {
  api.console.info('Instagram DM Setup Wizard');
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
To get Instagram Business Account ID:
1. Go to https://developers.facebook.com/tools/explorer
2. Select your app: ${appId}
3. GET /me?fields=instagram_business_account
4. Copy the instagram_business_account.id
`);

  const instagramAccountId = await api.prompt({
    message: 'Enter your Instagram Business Account ID:',
    validate: (v: string) => /^\d+$/.test(v) ? true : 'Must be numeric'
  });

  api.console.info(`
To get Page Access Token with instagram_basic permission:
1. Go to https://developers.facebook.com/tools/explorer
2. Get Token > Get Page Access Token
3. Select permissions: instagram_basic, instagram_manage_messages
4. Copy the token
`);

  const accessToken = await api.prompt({
    message: 'Enter your Page Access Token:',
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
        instagramAccountId,
        facebookPageId: 'linked_via_oauth',
        accessToken,
        appSecret,
        verifyToken,
        webhookPath: '/webhooks/instagram',
        responseWindowHours: 24
      }
    }
  };

  await api.config.set('channels.instagram', config);

  api.console.success(`
✅ Instagram setup complete!

Account: ${accountId}
Instagram Account ID: ${instagramAccountId}

Next steps:
1. Configure webhook in Meta Developers Portal
2. Callback URL: https://your-domain.com/webhooks/instagram
3. Verify Token: ${verifyToken}
4. Subscribe to: messages
`);

  return { success: true, channel: 'instagram', accountId, config };
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
