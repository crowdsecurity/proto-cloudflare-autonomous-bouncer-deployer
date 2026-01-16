import Cloudflare from 'cloudflare';
import type { CloudflareClient } from './types.js';

/**
 * Create a Cloudflare API client with the given token
 */
export function createCloudflareClient(apiToken: string): CloudflareClient {
  return new Cloudflare({
    apiToken,
  });
}

/**
 * Check if an error is a Cloudflare "not found" error
 */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof Cloudflare.NotFoundError) {
    return true;
  }
  // Also check for common API error patterns
  if (error instanceof Cloudflare.APIError) {
    return error.status === 404;
  }
  return false;
}

/**
 * Format a Cloudflare API error for display
 */
export function formatApiError(error: unknown, operation: string): string {
  if (error instanceof Cloudflare.APIError) {
    return `Cloudflare API error during ${operation}: ${error.message} (status: ${error.status})`;
  }
  if (error instanceof Error) {
    return `Error during ${operation}: ${error.message}`;
  }
  return `Unknown error during ${operation}: ${String(error)}`;
}
