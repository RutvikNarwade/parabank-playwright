import { request } from '@playwright/test';
import { env } from './src/config/env';

/**
 * Pre-flight check against the shared environment. If ParaBank is down or Cloudflare is
 * already blocking this IP, stop with one clear message instead of producing dozens of
 * misleading test failures.
 */
export default async function globalSetup() {
  const ctx = await request.newContext({ extraHTTPHeaders: { Accept: 'application/json' } });
  try {
    for (const url of [`${env.baseUrl}index.htm`, `${env.apiUrl}login/healthcheck/healthcheck`]) {
      const res = await ctx.get(url, { timeout: 30_000 }).catch((e: Error) => {
        throw new Error(`ENVIRONMENT: ${url} is unreachable (${e.message}). Is ParaBank up?`);
      });
      if (res.status() === 429) {
        throw new Error(
          `ENVIRONMENT: Cloudflare is rate-limiting this IP (HTTP 429, Retry-After ${res.headers()['retry-after']}s). ` +
            'Wait for the block to expire before running the suite. See docs/RELIABILITY.md.',
        );
      }
      // The login probe uses unknown credentials, so 400 "Invalid username and/or password" is healthy.
      if (res.status() >= 500) {
        throw new Error(`ENVIRONMENT: ${url} returned HTTP ${res.status()}. ParaBank appears to be unhealthy.`);
      }
    }
  } finally {
    await ctx.dispose();
  }
}
