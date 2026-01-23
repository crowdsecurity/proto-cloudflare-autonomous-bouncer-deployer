import {
  RESOURCE_NAMES,
  DEFAULTS,
  type CloudflareClient,
  type ProgressCallback,
  type TurnstileWidgetState,
} from './types.js';
import { isNotFoundError } from './client.js';

/**
 * Create a KV namespace for the bouncer
 */
export async function createKVNamespace(
  client: CloudflareClient,
  accountId: string,
  onProgress: ProgressCallback
): Promise<string> {
  onProgress({
    type: 'stdout',
    data: `Creating KV namespace: ${RESOURCE_NAMES.KV_NAMESPACE}...\n`,
  });

  const response = await client.kv.namespaces.create({
    account_id: accountId,
    title: RESOURCE_NAMES.KV_NAMESPACE,
  });

  const namespaceId = response.id;
  onProgress({
    type: 'stdout',
    data: `Created KV namespace: ${namespaceId}\n`,
  });

  return namespaceId;
}

/**
 * Write the ban template to KV
 */
export async function writeBanTemplate(
  client: CloudflareClient,
  accountId: string,
  namespaceId: string,
  template: string = DEFAULTS.BAN_TEMPLATE,
  onProgress: ProgressCallback
): Promise<void> {
  onProgress({ type: 'stdout', data: 'Writing ban template to KV...\n' });

  await client.kv.namespaces.values.update(
    namespaceId,
    RESOURCE_NAMES.BAN_TEMPLATE_KEY,
    {
      account_id: accountId,
      value: template,
      metadata: JSON.stringify({}),
    }
  );

  onProgress({ type: 'stdout', data: 'Ban template written successfully\n' });
}

/**
 * Write Turnstile configuration to KV
 */
export async function writeTurnstileConfig(
  client: CloudflareClient,
  accountId: string,
  namespaceId: string,
  widgets: Map<string, TurnstileWidgetState>,
  onProgress: ProgressCallback
): Promise<void> {
  if (widgets.size === 0) {
    return;
  }

  onProgress({ type: 'stdout', data: 'Writing Turnstile config to KV...\n' });

  // Build config object: { "domain.com": { "site_key": "...", "secret": "..." } }
  const config: Record<string, { site_key: string; secret: string }> = {};
  for (const [domain, widget] of widgets) {
    config[domain] = {
      site_key: widget.siteKey,
      secret: widget.secret,
    };
  }

  await client.kv.namespaces.values.update(
    namespaceId,
    RESOURCE_NAMES.TURNSTILE_CONFIG_KEY,
    {
      account_id: accountId,
      value: JSON.stringify(config),
      metadata: JSON.stringify({}),
    }
  );

  onProgress({
    type: 'stdout',
    data: 'Turnstile config written successfully\n',
  });
}

/**
 * Find and delete the bouncer's KV namespace
 */
export async function findAndDeleteKVNamespace(
  client: CloudflareClient,
  accountId: string,
  onProgress: ProgressCallback
): Promise<void> {
  onProgress({ type: 'stdout', data: 'Looking for existing KV namespaces...\n' });

  try {
    let deletedCount = 0;
    for await (const ns of client.kv.namespaces.list({ account_id: accountId })) {
      if (ns.title === RESOURCE_NAMES.KV_NAMESPACE) {
        onProgress({
          type: 'stdout',
          data: `Deleting KV namespace: ${ns.id}...\n`,
        });
        await client.kv.namespaces.delete(ns.id, { account_id: accountId });
        deletedCount++;
      }
    }
    onProgress({
      type: 'stdout',
      data: deletedCount > 0
        ? `Deleted ${deletedCount} KV namespace(s)\n`
        : 'No existing KV namespace found\n',
    });
  } catch (err) {
    if (!isNotFoundError(err)) {
      onProgress({
        type: 'stderr',
        data: `Warning: Could not list/delete KV namespaces: ${err}\n`,
      });
    }
  }
}
