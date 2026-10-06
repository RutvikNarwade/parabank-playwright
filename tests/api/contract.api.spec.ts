import { CustomerSchema } from '../../src/api/schemas';
import { env } from '../../src/config/env';
import { expect, test } from '../../src/fixtures';

/**
 * Content negotiation contract. Every other API test also validates bodies against the zod
 * schemas in src/api/schemas.ts through parse(), so schema drift fails fast across the suite.
 */
test.describe('API content negotiation', { tag: '@api' }, () => {
  test('serves JSON that matches the customer contract when asked for JSON', async ({ api, customer }) => {
    const res = await api.getCustomer(customer.id);

    expect(res.headers()['content-type']).toContain('application/json');
    expect(CustomerSchema.safeParse(await res.json()).success).toBe(true);
  });

  test('defaults to XML when the client sends no Accept header', async ({ playwright, customer }) => {
    const raw = await playwright.request.newContext();
    try {
      const res = await raw.get(`${env.apiUrl}customers/${customer.id}`);

      expect(res.headers()['content-type']).toContain('application/xml');
      expect(await res.text()).toContain(`<customer><id>${customer.id}</id>`);
    } finally {
      await raw.dispose();
    }
  });
});
