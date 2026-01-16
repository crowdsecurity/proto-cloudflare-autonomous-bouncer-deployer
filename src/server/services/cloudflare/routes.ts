import type { CloudflareClient, ZoneState, ProgressCallback } from './types.js';

/**
 * Create worker routes for all zones
 */
export async function createWorkerRoutes(
  client: CloudflareClient,
  zones: ZoneState[],
  scriptName: string,
  onProgress: ProgressCallback
): Promise<void> {
  onProgress({ type: 'stdout', data: 'Creating worker routes...\n' });

  for (const zone of zones) {
    for (const route of zone.routesToProtect) {
      onProgress({
        type: 'stdout',
        data: `  Creating route: ${route} -> ${scriptName}...\n`,
      });

      await client.workers.routes.create({
        zone_id: zone.id,
        pattern: route,
        script: scriptName,
      });
    }
  }

  onProgress({ type: 'stdout', data: 'All worker routes created\n' });
}

/**
 * Delete worker routes for all zones that are bound to the bouncer script
 */
export async function deleteWorkerRoutes(
  client: CloudflareClient,
  zones: ZoneState[],
  scriptName: string,
  onProgress: ProgressCallback
): Promise<void> {
  onProgress({ type: 'stdout', data: 'Deleting worker routes...\n' });

  for (const zone of zones) {
    onProgress({
      type: 'stdout',
      data: `  Checking routes for zone: ${zone.domain}...\n`,
    });

    try {
      for await (const route of client.workers.routes.list({ zone_id: zone.id })) {
        if (route.script === scriptName) {
          onProgress({
            type: 'stdout',
            data: `  Deleting route: ${route.pattern}...\n`,
          });
          await client.workers.routes.delete(route.id, { zone_id: zone.id });
        }
      }
    } catch (err) {
      onProgress({
        type: 'stderr',
        data: `  Warning: Could not list routes for zone ${zone.domain}: ${err}\n`,
      });
    }
  }

  onProgress({ type: 'stdout', data: 'Worker routes deleted\n' });
}
