import { env } from '../../src/config/env';
import { buildCustomer, toRegistrationForm } from '../../src/data/customerFactory';
import { expect, test } from '../../src/fixtures';
import { knownDefect } from '../../src/support/knownDefect';

test.describe('API robustness defects', { tag: ['@api', '@defect'] }, () => {
  test('BUG-016 unknown resources must return 404, not 400', async ({ api }) => {
    const responses = {
      account: await api.getAccount(99_999_999),
      customer: await api.getCustomer(999_999_999),
      transaction: await api.getTransaction(999_999_999),
    };

    knownDefect('BUG-016', 'not-found resources are reported as 400 Bad Request');
    for (const [resource, res] of Object.entries(responses)) {
      expect.soft(res.status(), `unknown ${resource}`).toBe(404);
    }
  });

  test('BUG-015 the profile update API must enforce required fields', async ({ api, customer }) => {
    const res = await api.updateCustomer(customer.id, {
      firstName: '',
      lastName: customer.lastName,
      street: customer.street,
      city: customer.city,
      state: customer.state,
      zipCode: customer.zipCode,
      phoneNumber: customer.phoneNumber,
      ssn: customer.ssn,
      username: customer.username,
      password: customer.password,
    });

    knownDefect('BUG-015', 'server accepts an empty first name; only the browser enforces it');
    expect(res.status()).toBe(400);
  });

  test('BUG-017 an invalid account type must be a 400, not a server error', async ({ api, customer }) => {
    const res = await api.createAccount(customer.id, 9, customer.primaryAccountId);

    knownDefect('BUG-017', 'createAccount with an unknown type code answers HTTP 500 with an HTML error page');
    expect(res.status()).toBe(400);
  });

  test('BUG-018 submitting the registration form without a prior page visit must not crash', async ({ playwright, postThrottle }) => {
    const fresh = await playwright.request.newContext({ baseURL: env.baseUrl }); // no session cookie yet
    try {
      await postThrottle.acquire();
      // Deliberately invalid (password mismatch), so no customer is created even once this is fixed.
      const res = await fresh.post('register.htm', {
        form: toRegistrationForm(buildCustomer(), 'does-not-match'),
      });

      knownDefect('BUG-018', 'POST register.htm on a new session answers HTTP 500 instead of re-showing the form');
      expect(res.status()).toBe(200);
    } finally {
      await fresh.dispose();
    }
  });

  test('BUG-019 session ids must not be exposed in URLs', async ({ playwright }) => {
    const fresh = await playwright.request.newContext({ baseURL: env.baseUrl });
    try {
      const html = await (await fresh.get('index.htm')).text();
      expect(html).toContain('Customer Login');

      knownDefect('BUG-019', 'first-visit pages rewrite every link with ;jsessionid=<id>');
      expect(html).not.toMatch(/;jsessionid=/i);
    } finally {
      await fresh.dispose();
    }
  });
});
