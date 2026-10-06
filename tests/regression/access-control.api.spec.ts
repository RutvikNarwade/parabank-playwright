import { env } from '../../src/config/env';
import { expect, test } from '../../src/fixtures';
import { knownDefect } from '../../src/support/knownDefect';

/**
 * Authentication and authorization defects. Every probe targets only customers created by this
 * test. No pre-existing or other people's data is read or modified on the shared environment.
 */
test.describe('Access control defects', { tag: ['@api', '@defect', '@security'] }, () => {
  test('BUG-001 the REST API must not serve customer data to an anonymous caller', async ({ api, customer }) => {
    const res = await api.getCustomer(customer.id); // `api` carries no session or credentials

    knownDefect('BUG-001', 'REST API has no authentication: anyone can read PII (incl. SSN) and move money');
    expect(res.status()).toBe(401);
    expect(await res.text()).not.toContain(customer.ssn);
  });

  test('BUG-001 the REST API must not let an anonymous caller move money', async ({ api, createCustomer }) => {
    const victim = await createCustomer();
    const other = await createCustomer();
    const before = await api.balanceOf(victim.primaryAccountId);

    const res = await api.transfer(victim.primaryAccountId, other.primaryAccountId, 1);

    knownDefect('BUG-001', 'REST API has no authentication: anyone can read PII (incl. SSN) and move money');
    expect(res.status()).toBe(401);
    expect(await api.balanceOf(victim.primaryAccountId)).toBe(before);
  });

  test('BUG-002 a signed-in customer must not read or debit another customer\'s accounts', async ({ playwright, api, postThrottle, createCustomer }) => {
    const attacker = await createCustomer();
    const victim = await createCustomer();
    const before = await api.balanceOf(victim.primaryAccountId);

    // Same session-protected proxy the web UI uses, called with the attacker's own session.
    const session = await playwright.request.newContext({
      baseURL: `${env.baseUrl}services_proxy/bank/`,
      storageState: { cookies: attacker.sessionCookies, origins: [] },
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    try {
      const read = await session.get(`customers/${victim.id}`);
      await postThrottle.acquire();
      const debit = await session.post('transfer', {
        params: { fromAccountId: victim.primaryAccountId, toAccountId: attacker.primaryAccountId, amount: 1 },
      });

      knownDefect('BUG-002', 'services_proxy checks that a user is logged in, but not that they own the resource');
      expect.soft(read.status(), 'reading another customer\'s profile').toBe(403);
      expect.soft(debit.status(), 'debiting another customer\'s account').toBe(403);
      expect(await api.balanceOf(victim.primaryAccountId)).toBe(before);
    } finally {
      await session.dispose();
    }
  });

  test('BUG-003 "Forgot login info" must never reveal the password', async ({ playwright, postThrottle, customer }) => {
    const web = await playwright.request.newContext({ baseURL: env.baseUrl });
    try {
      await web.get('lookup.htm');
      await postThrottle.acquire();
      const res = await web.post('lookup.htm', {
        form: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          'address.street': customer.street,
          'address.city': customer.city,
          'address.state': customer.state,
          'address.zipCode': customer.zipCode,
          ssn: customer.ssn,
        },
      });
      const html = await res.text();
      // Precondition: the lookup must find the customer. Otherwise the test passes for the wrong reason.
      expect(html, 'customer lookup succeeded').toContain('Your login information was located successfully');

      knownDefect('BUG-003', 'lookup.htm prints the plaintext password and logs the visitor in');
      expect(html).not.toContain(customer.password);
    } finally {
      await web.dispose();
    }
  });

  test('BUG-004 the profile page must not embed the password in its source', async ({ playwright, customer }) => {
    const session = await playwright.request.newContext({
      baseURL: env.baseUrl,
      storageState: { cookies: customer.sessionCookies, origins: [] },
    });
    try {
      const res = await session.get('updateprofile.htm');
      expect(res.status()).toBe(200);

      knownDefect('BUG-004', 'updateprofile.htm inlines username and password into JavaScript and sends them in a URL');
      expect(await res.text()).not.toContain(customer.password);
    } finally {
      await session.dispose();
    }
  });
});
