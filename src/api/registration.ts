import type { APIRequestContext } from '@playwright/test';
import { toRegistrationForm, type CustomerData } from '../data/customerFactory';
import type { PostThrottle } from '../support/PostThrottle';
import { withRateLimitRetry } from './rateLimit';

const SUCCESS_TEXT = 'Your account was created successfully';

/**
 * Registers a customer through the same HTML form the UI submits. ParaBank has no REST endpoint
 * for registration. This takes about 1s, compared with about 5s through the browser, and needs no page.
 *
 * `web` must be a request context with baseURL = env.baseUrl. On success the context holds an
 * authenticated JSESSIONID (registration logs the user in), which callers can reuse for UI tests.
 */
export async function registerViaForm(web: APIRequestContext, customer: CustomerData, postThrottle: PostThrottle) {
  // Load the form first. Posting to register.htm without an existing session returns
  // HTTP 500 "An internal error has occurred" (see docs/RELIABILITY.md, RC-1).
  await withRateLimitRetry(() => web.get('register.htm'));
  const res = await withRateLimitRetry(async () => {
    await postThrottle.acquire();
    return web.post('register.htm', { form: toRegistrationForm(customer) });
  });
  const html = await res.text();

  if (res.status() !== 200 || !html.includes(SUCCESS_TEXT)) {
    const errors = [...html.matchAll(/<span[^>]*class="error"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1].trim());
    throw new Error(
      `Registration of "${customer.username}" failed: HTTP ${res.status()}` +
        (errors.length ? `, validation errors: ${errors.join('; ')}` : ''),
    );
  }
}
