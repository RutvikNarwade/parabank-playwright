import type { APIResponse } from '@playwright/test';
import { env } from '../config/env';

/**
 * The public ParaBank instance sits behind a Cloudflare rate limit (HTTP 429, "error 1015").
 * A 429 says nothing about the application under test, so it must never surface as an
 * ordinary assertion failure. See docs/RELIABILITY.md (RC-2).
 */
export class RateLimitedError extends Error {
  constructor(url: string, retryAfterSec: number) {
    super(
      `ENVIRONMENT: Cloudflare rate-limited ${url} (HTTP 429, Retry-After ${retryAfterSec}s). ` +
        'This is not a product failure. Lower WORKERS or wait for the block to expire, then re-run.',
    );
    this.name = 'RateLimitedError';
  }
}

const MAX_ATTEMPTS = 3;

/**
 * Runs an HTTP call and, on 429, waits for the server-specified Retry-After before retrying.
 * The wait is dictated by the server rather than guessed, so it is not a "fixed sleep". If the
 * server asks for longer than MAX_RATE_LIMIT_WAIT_SEC we fail fast instead of hanging the suite.
 */
export async function withRateLimitRetry(send: () => Promise<APIResponse>): Promise<APIResponse> {
  for (let attempt = 1; ; attempt++) {
    const res = await send();
    if (res.status() !== 429) return res;

    const retryAfterSec = Number(res.headers()['retry-after'] ?? 30);
    if (attempt >= MAX_ATTEMPTS || retryAfterSec > env.maxRateLimitWaitSec) {
      throw new RateLimitedError(res.url(), retryAfterSec);
    }
    await new Promise((resolve) => setTimeout(resolve, retryAfterSec * 1000));
  }
}
