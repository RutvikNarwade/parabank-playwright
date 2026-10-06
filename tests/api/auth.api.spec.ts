import { parse } from '../../src/api/ParaBankClient';
import { CustomerSchema } from '../../src/api/schemas';
import { uniqueUsername } from '../../src/data/customerFactory';
import { expect, test } from '../../src/fixtures';

test.describe('Login API', { tag: '@api' }, () => {
  test('returns the registered customer profile for valid credentials', { tag: '@smoke' }, async ({ api, customer }) => {
    const profile = await parse(await api.login(customer.username, customer.password), CustomerSchema);

    expect(profile).toMatchObject({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      address: { street: customer.street, city: customer.city, state: customer.state, zipCode: customer.zipCode },
      phoneNumber: customer.phoneNumber,
    });
  });

  test('rejects a wrong password', async ({ api, customer }) => {
    const res = await api.login(customer.username, `${customer.password}-wrong`);

    expect(res.status()).toBe(400);
    expect(await res.text()).toBe('Invalid username and/or password');
  });

  test('gives the same answer for an unknown user, so usernames cannot be enumerated', async ({ api }) => {
    const res = await api.login(uniqueUsername('nobody'), 'whatever');

    expect(res.status()).toBe(400);
    expect(await res.text()).toBe('Invalid username and/or password');
  });

  test('treats passwords as case-sensitive', async ({ api, customer }) => {
    const res = await api.login(customer.username, customer.password.toUpperCase());

    expect(res.status()).toBe(400);
  });
});
