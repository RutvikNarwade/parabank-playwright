import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const withTrailingSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);

const baseUrl = withTrailingSlash(process.env.BASE_URL || 'https://parabank.parasoft.com/parabank/');

export const env = {
  /** Web root of the application, e.g. https://parabank.parasoft.com/parabank/ */
  baseUrl,
  /** REST API root (documented at <baseUrl>api-docs/index.html) */
  apiUrl: `${baseUrl}services/bank/`,
  workers: Number(process.env.WORKERS || 2),
  /** POSTs allowed per POST_WINDOW_SEC across all workers (see src/support/PostThrottle.ts). */
  postBudget: Number(process.env.POST_BUDGET || 15),
  postWindowMs: Number(process.env.POST_WINDOW_SEC || 60) * 1000,
  maxRateLimitWaitSec: Number(process.env.MAX_RATE_LIMIT_WAIT_SEC || 60),
  isCI: !!process.env.CI,
} as const;
