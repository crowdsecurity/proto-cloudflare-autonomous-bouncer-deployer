import { createCloudflareClient } from './client.js';
import { discoverZones } from './zones.js';
import {
  createKVNamespace,
  writeBanTemplate,
  writeTurnstileConfig,
  findAndDeleteKVNamespace,
} from './kv.js';
import { createD1Database, findAndDeleteD1Database } from './d1.js';
import {
  uploadMainWorker,
  uploadDecisionsSyncWorker,
  createCronTrigger,
  deleteWorkerScripts,
} from './workers.js';
import { createWorkerRoutes, deleteWorkerRoutes } from './routes.js';
import { createTurnstileWidgets, deleteTurnstileWidgets } from './turnstile.js';
import { sessionManager } from '../session.js';
import {
  RESOURCE_NAMES,
  DEFAULTS,
  type ZoneState,
  type ZoneInfo,
  type ProgressCallback,
  type CloudflareClient,
} from './types.js';

// Re-export types for convenience
export type { ProgressCallback, ZoneInfo, ZoneState } from './types.js';

/**
 * Main Cloudflare service that orchestrates all operations
 */
export class CloudflareService {
  /**
   * Discover zones from Cloudflare and store in session
   */
  async discoverAndStoreZones(
    socketId: string,
    cloudflareToken: string,
    crowdsecLapiUrl: string,
    crowdsecLapiKey: string,
    onProgress: ProgressCallback
  ): Promise<ZoneInfo[]> {
    const client = createCloudflareClient(cloudflareToken);

    // Create or update session
    let session = sessionManager.get(socketId);
    if (!session) {
      session = sessionManager.create(socketId, cloudflareToken);
    } else {
      session.cloudflareToken = cloudflareToken;
    }
    session.crowdsecLapiUrl = crowdsecLapiUrl;
    session.crowdsecLapiKey = crowdsecLapiKey;

    // Discover zones
    const zones = await discoverZones(client, onProgress);
    sessionManager.setZones(socketId, zones);

    // Return zones in ZoneInfo format for the frontend
    return sessionManager.getAllZones(socketId);
  }

  /**
   * Update selected zones in session
   */
  updateSelectedZones(socketId: string, selectedZoneIds: string[]): void {
    sessionManager.updateSelectedZones(socketId, selectedZoneIds);
  }

  /**
   * Get all zones from session
   */
  getZones(socketId: string): ZoneInfo[] {
    return sessionManager.getAllZones(socketId);
  }

  /**
   * Deploy bouncer infrastructure
   */
  async deploy(socketId: string, onProgress: ProgressCallback): Promise<void> {
    const session = sessionManager.get(socketId);
    if (!session) {
      throw new Error('Session not found. Please start the configuration process again.');
    }

    if (!session.cloudflareToken) {
      throw new Error('Cloudflare token not found in session');
    }

    if (!session.crowdsecLapiUrl || !session.crowdsecLapiKey) {
      throw new Error('CrowdSec LAPI credentials not found in session');
    }

    const client = createCloudflareClient(session.cloudflareToken);
    const selectedZonesByAccount = sessionManager.getSelectedZonesByAccount(socketId);

    if (selectedZonesByAccount.size === 0) {
      throw new Error('No zones selected for deployment');
    }

    // Deploy to each account
    for (const [accountId, zones] of selectedZonesByAccount) {
      const accountName = zones[0]?.accountName || accountId;
      onProgress({
        type: 'stdout',
        data: `\n=== Deploying to account: ${accountName} ===\n`,
      });

      try {
        // 1. Clean up existing infrastructure first (idempotent)
        await this.cleanupAccountInfrastructure(
          client,
          accountId,
          zones,
          onProgress
        );

        // 2. Create KV namespace
        const kvNamespaceId = await createKVNamespace(client, accountId, onProgress);
        sessionManager.updateDeploymentState(socketId, { kvNamespaceId });

        // 3. Create D1 database (optional, for metrics)
        const d1DatabaseId = await createD1Database(client, accountId, onProgress);
        if (d1DatabaseId) {
          sessionManager.updateDeploymentState(socketId, { d1DatabaseId });
        }

        // 4. Write ban template
        await writeBanTemplate(
          client,
          accountId,
          kvNamespaceId,
          DEFAULTS.BAN_TEMPLATE,
          onProgress
        );

        // 5. Upload main worker
        await uploadMainWorker(
          client,
          accountId,
          RESOURCE_NAMES.MAIN_WORKER,
          kvNamespaceId,
          d1DatabaseId,
          zones,
          onProgress
        );

        // 6. Create worker routes
        await createWorkerRoutes(
          client,
          zones,
          RESOURCE_NAMES.MAIN_WORKER,
          onProgress
        );

        // 7. Upload decisions sync worker
        await uploadDecisionsSyncWorker(
          client,
          accountId,
          RESOURCE_NAMES.SYNC_WORKER,
          kvNamespaceId,
          session.crowdsecLapiUrl,
          session.crowdsecLapiKey,
          session.cloudflareToken,
          onProgress
        );

        // 8. Create cron trigger for sync worker
        await createCronTrigger(
          client,
          accountId,
          RESOURCE_NAMES.SYNC_WORKER,
          DEFAULTS.CRON_SCHEDULE,
          onProgress
        );

        // 9. Create Turnstile widgets
        const widgets = await createTurnstileWidgets(
          client,
          accountId,
          zones,
          onProgress
        );

        // 10. Write Turnstile config to KV
        if (widgets.size > 0) {
          await writeTurnstileConfig(
            client,
            accountId,
            kvNamespaceId,
            widgets,
            onProgress
          );
        }
      } catch (err) {
        onProgress({
          type: 'error',
          data: `Deployment failed for account ${accountName}: ${err}`,
        });
        throw err;
      }
    }

    onProgress({
      type: 'stdout',
      data: '\n=== Deployment completed successfully! ===\n',
    });
  }

  /**
   * Clear bouncer infrastructure
   */
  async clear(socketId: string, onProgress: ProgressCallback): Promise<void> {
    const session = sessionManager.get(socketId);
    if (!session) {
      throw new Error('Session not found. Please start the configuration process again.');
    }

    if (!session.cloudflareToken) {
      throw new Error('Cloudflare token not found in session');
    }

    const client = createCloudflareClient(session.cloudflareToken);

    // Get all zones (not just selected) for cleanup
    const allZones = session.accounts.flatMap((a) => a.zones);

    if (allZones.length === 0) {
      throw new Error('No zones found in session. Please discover zones first.');
    }

    // Group by account
    const zonesByAccount = new Map<string, ZoneState[]>();
    for (const zone of allZones) {
      const existing = zonesByAccount.get(zone.accountId) || [];
      existing.push(zone);
      zonesByAccount.set(zone.accountId, existing);
    }

    // Clear each account
    for (const [accountId, zones] of zonesByAccount) {
      const accountName = zones[0]?.accountName || accountId;
      onProgress({
        type: 'stdout',
        data: `\n=== Clearing account: ${accountName} ===\n`,
      });

      try {
        await this.cleanupAccountInfrastructure(
          client,
          accountId,
          zones,
          onProgress
        );
      } catch (err) {
        onProgress({
          type: 'stderr',
          data: `Warning: Cleanup failed for account ${accountName}: ${err}\n`,
        });
        // Continue with other accounts
      }
    }

    onProgress({
      type: 'stdout',
      data: '\n=== Infrastructure cleared successfully! ===\n',
    });
  }

  /**
   * Clean up all bouncer infrastructure for an account
   * Order matters: routes first, then workers, then storage
   */
  private async cleanupAccountInfrastructure(
    client: CloudflareClient,
    accountId: string,
    zones: ZoneState[],
    onProgress: ProgressCallback
  ): Promise<void> {
    onProgress({ type: 'stdout', data: 'Cleaning up existing infrastructure...\n' });

    // 1. Delete Turnstile widgets
    await deleteTurnstileWidgets(client, accountId, onProgress);

    // 2. Delete worker routes
    await deleteWorkerRoutes(client, zones, RESOURCE_NAMES.MAIN_WORKER, onProgress);

    // 3. Delete workers
    await deleteWorkerScripts(
      client,
      accountId,
      [RESOURCE_NAMES.MAIN_WORKER, RESOURCE_NAMES.SYNC_WORKER],
      onProgress
    );

    // 4. Delete KV namespaces
    await findAndDeleteKVNamespace(client, accountId, onProgress);

    // 5. Delete D1 databases
    await findAndDeleteD1Database(client, accountId, onProgress);

    onProgress({ type: 'stdout', data: 'Cleanup complete\n' });
  }
}

// Export singleton instance
export const cloudflareService = new CloudflareService();
