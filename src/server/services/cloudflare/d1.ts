import { RESOURCE_NAMES, type CloudflareClient, type ProgressCallback } from './types.js';
import { isNotFoundError } from './client.js';
import { METRICS_SQL } from '../../assets/workers/index.js';

/**
 * Create a D1 database for metrics storage
 * Returns the database ID if successful, null if creation failed (non-critical)
 */
export async function createD1Database(
  client: CloudflareClient,
  accountId: string,
  onProgress: ProgressCallback
): Promise<string | null> {
  onProgress({
    type: 'stdout',
    data: `Creating D1 database: ${RESOURCE_NAMES.D1_DATABASE}...\n`,
  });

  try {
    const response = await client.d1.database.create({
      account_id: accountId,
      name: RESOURCE_NAMES.D1_DATABASE,
    });

    const databaseId = response.uuid;
    if (!databaseId) {
      throw new Error('D1 database created but no UUID returned');
    }

    onProgress({
      type: 'stdout',
      data: `Created D1 database: ${databaseId}\n`,
    });

    // Create metrics table
    onProgress({ type: 'stdout', data: 'Creating metrics table...\n' });

    await client.d1.database.query(databaseId, {
      account_id: accountId,
      sql: METRICS_SQL,
    });

    onProgress({ type: 'stdout', data: 'Metrics table created successfully\n' });

    return databaseId;
  } catch (err) {
    onProgress({
      type: 'stderr',
      data: `Warning: Could not create D1 database (metrics will not be available): ${err}\n`,
    });
    return null;
  }
}

/**
 * Find and delete the bouncer's D1 database
 */
export async function findAndDeleteD1Database(
  client: CloudflareClient,
  accountId: string,
  onProgress: ProgressCallback
): Promise<void> {
  onProgress({ type: 'stdout', data: 'Looking for existing D1 databases...\n' });

  try {
    let deletedCount = 0;
    for await (const db of client.d1.database.list({ account_id: accountId })) {
      if (db.name === RESOURCE_NAMES.D1_DATABASE && db.uuid) {
        onProgress({
          type: 'stdout',
          data: `Deleting D1 database: ${db.uuid}...\n`,
        });
        await client.d1.database.delete(db.uuid, { account_id: accountId });
        deletedCount++;
      }
    }
    onProgress({
      type: 'stdout',
      data: deletedCount > 0
        ? `Deleted ${deletedCount} D1 database(s)\n`
        : 'No existing D1 database found\n',
    });
  } catch (err) {
    if (!isNotFoundError(err)) {
      onProgress({
        type: 'stderr',
        data: `Warning: Could not list/delete D1 databases: ${err}\n`,
      });
    }
  }
}
