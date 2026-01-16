/**
 * Worker script loader
 * Loads Cloudflare Worker bundles from disk and caches them
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for loaded scripts
const scriptCache = new Map<string, string>();

/**
 * Load a worker bundle from disk
 * @param bundleName - Name of the bundle file (e.g., 'main-worker-bundle.js')
 * @returns The script content as a string
 */
function loadWorkerBundle(bundleName: string): string {
  const cached = scriptCache.get(bundleName);
  if (cached !== undefined) {
    return cached;
  }

  const scriptPath = path.join(__dirname, bundleName);

  try {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    scriptCache.set(bundleName, content);
    return content;
  } catch (err) {
    throw new Error(`Failed to load worker bundle '${bundleName}' from ${scriptPath}: ${err}`);
  }
}

/**
 * Get the main bouncer worker script
 * This worker handles incoming requests and applies remediations (ban, captcha)
 *
 * Source: https://github.com/crowdsecurity/cs-cloudflare-worker-bouncer
 * The bundle is copied from: pkg/cloudflare/worker/dist/main.js
 * To update: rebuild the Go repo and copy the new bundle here
 */
export function getMainWorkerScript(): string {
  return loadWorkerBundle('main-worker-bundle.js');
}

/**
 * Get the decisions sync worker script
 * This worker syncs decisions from CrowdSec LAPI to Cloudflare KV on a cron schedule
 *
 * Source: https://github.com/crowdsecurity/cs-cloudflare-worker-bouncer
 * The bundle is copied from: pkg/cloudflare/decisions-sync-worker/dist/main.js
 * To update: rebuild the Go repo and copy the new bundle here
 */
export function getDecisionsSyncWorkerScript(): string {
  return loadWorkerBundle('decisions-sync-worker-bundle.js');
}

// Re-export the metrics schema
export { METRICS_SQL } from './metrics-schema.js';
