import {
  RESOURCE_NAMES,
  type CloudflareClient,
  type ZoneState,
  type TurnstileWidgetState,
  type ProgressCallback,
} from './types.js';

/**
 * Create Turnstile widgets for zones that have Turnstile enabled
 */
export async function createTurnstileWidgets(
  client: CloudflareClient,
  accountId: string,
  zones: ZoneState[],
  onProgress: ProgressCallback
): Promise<Map<string, TurnstileWidgetState>> {
  const widgets = new Map<string, TurnstileWidgetState>();

  const zonesWithTurnstile = zones.filter((z) => z.turnstile.enabled);
  if (zonesWithTurnstile.length === 0) {
    onProgress({
      type: 'stdout',
      data: 'No zones with Turnstile enabled, skipping widget creation\n',
    });
    return widgets;
  }

  onProgress({ type: 'stdout', data: 'Creating Turnstile widgets...\n' });

  for (const zone of zonesWithTurnstile) {
    onProgress({
      type: 'stdout',
      data: `  Creating Turnstile widget for: ${zone.domain}...\n`,
    });

    try {
      const response = await client.turnstile.widgets.create({
        account_id: accountId,
        name: RESOURCE_NAMES.TURNSTILE_WIDGET,
        domains: [zone.domain],
        mode: zone.turnstile.mode,
      });

      widgets.set(zone.domain, {
        siteKey: response.sitekey,
        secret: response.secret,
      });

      onProgress({
        type: 'stdout',
        data: `  Created Turnstile widget for ${zone.domain}: ${response.sitekey}\n`,
      });
    } catch (err) {
      onProgress({
        type: 'stderr',
        data: `  Warning: Could not create Turnstile widget for ${zone.domain}: ${err}\n`,
      });
    }
  }

  onProgress({
    type: 'stdout',
    data: `Created ${widgets.size} Turnstile widget(s)\n`,
  });

  return widgets;
}

/**
 * Delete all Turnstile widgets created by the bouncer
 */
export async function deleteTurnstileWidgets(
  client: CloudflareClient,
  accountId: string,
  onProgress: ProgressCallback
): Promise<void> {
  onProgress({ type: 'stdout', data: 'Looking for existing Turnstile widgets...\n' });

  try {
    let deletedCount = 0;
    for await (const widget of client.turnstile.widgets.list({
      account_id: accountId,
    })) {
      if (widget.name === RESOURCE_NAMES.TURNSTILE_WIDGET) {
        onProgress({
          type: 'stdout',
          data: `  Deleting Turnstile widget: ${widget.sitekey}...\n`,
        });
        await client.turnstile.widgets.delete(widget.sitekey, {
          account_id: accountId,
        });
        deletedCount++;
      }
    }

    if (deletedCount === 0) {
      onProgress({
        type: 'stdout',
        data: 'No existing Turnstile widgets found\n',
      });
    } else {
      onProgress({
        type: 'stdout',
        data: `Deleted ${deletedCount} Turnstile widget(s)\n`,
      });
    }
  } catch (err) {
    onProgress({
      type: 'stderr',
      data: `Warning: Could not list/delete Turnstile widgets: ${err}\n`,
    });
  }
}
