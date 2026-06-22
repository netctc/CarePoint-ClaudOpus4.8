import { prisma } from '../lib/prisma';
import { dispatchProviderCredentialNotifications } from '../lib/provider-credential-notification-dispatcher';

function arg(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function main() {
  const limit = Number(arg('limit', process.env.PROVIDER_CREDENTIAL_NOTIFICATION_BATCH_SIZE ?? '25')) || 25;
  const force = arg('force', 'false') === 'true';
  const includeManual = arg('includeManual', 'false') === 'true';
  const result = await dispatchProviderCredentialNotifications({ limit, force, includeManual });
  console.log(JSON.stringify({ event: 'provider_credential_notification_dispatch_complete', ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: 'provider_credential_notification_dispatch_failed', error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
