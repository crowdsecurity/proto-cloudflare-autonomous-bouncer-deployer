import {
  DEFAULTS as DefaultValues,
  type CloudflareClient,
  type ZoneState,
  type ProgressCallback,
} from './types.js';

/**
 * Discover all zones accessible with the given Cloudflare token
 * Returns zones that have A or AAAA DNS records (i.e., zones that serve web traffic)
 */
export async function discoverZones(
  client: CloudflareClient,
  onProgress: ProgressCallback
): Promise<ZoneState[]> {
  const zones: ZoneState[] = [];

  onProgress({ type: 'stdout', data: 'Fetching Cloudflare accounts...\n' });

  // List all accounts accessible with the token
  const accounts: Array<{ id: string; name: string }> = [];
  for await (const account of client.accounts.list()) {
    accounts.push({ id: account.id, name: account.name });
  }

  onProgress({
    type: 'stdout',
    data: `Found ${accounts.length} account(s)\n`,
  });

  // List zones for each account
  for (const account of accounts) {
    onProgress({
      type: 'stdout',
      data: `Fetching zones for account: ${account.name}...\n`,
    });

    try {
      // List all zones in the account
      for await (const zone of client.zones.list({ account: { id: account.id } })) {
        // Check if zone has A or AAAA records (serves web traffic)
        let hasWebRecords = false;
        try {
          for await (const record of client.dns.records.list({ zone_id: zone.id })) {
            if (record.type === 'A' || record.type === 'AAAA') {
              hasWebRecords = true;
              break;
            }
          }
        } catch (_err) {
          // If we can't list DNS records, assume the zone is usable
          hasWebRecords = true;
        }

        if (!hasWebRecords) {
          onProgress({
            type: 'stdout',
            data: `  Skipping zone ${zone.name} (no A/AAAA records)\n`,
          });
          continue;
        }

        // Clean up account name (remove "'s Account" suffix)
        const accountName = account.name.replace(/'s Account$/, '');

        zones.push({
          id: zone.id,
          domain: zone.name,
          accountId: account.id,
          accountName: accountName,
          selected: true,
          actions: [...DefaultValues.ACTIONS],
          defaultAction: DefaultValues.DEFAULT_ACTION,
          routesToProtect: [`*${zone.name}/*`],
          turnstile: { ...DefaultValues.TURNSTILE_CONFIG },
        });

        onProgress({
          type: 'stdout',
          data: `  Found zone: ${zone.name}\n`,
        });
      }
    } catch (err) {
      onProgress({
        type: 'stderr',
        data: `  Warning: Could not list zones for account ${account.name}: ${err}\n`,
      });
    }
  }

  onProgress({
    type: 'stdout',
    data: `\nDiscovered ${zones.length} zone(s) with web traffic\n`,
  });

  return zones;
}
