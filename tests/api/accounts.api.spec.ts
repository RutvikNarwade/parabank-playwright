import { parse } from '../../src/api/ParaBankClient';
import { AccountListSchema, AccountSchema } from '../../src/api/schemas';
import { expect, test } from '../../src/fixtures';

const OPENING_DEPOSIT = 100;

test.describe('Accounts API', { tag: '@api' }, () => {
  test('a new customer starts with one funded CHECKING account', { tag: '@smoke' }, async ({ api, customer }) => {
    const accounts = await parse(await api.getAccounts(customer.id), AccountListSchema);

    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ id: customer.primaryAccountId, customerId: customer.id, type: 'CHECKING' });
    expect(accounts[0].balance).toBeGreaterThan(OPENING_DEPOSIT);
  });

  test('opening a SAVINGS account moves the $100 opening deposit from the funding account', async ({ api, customer }) => {
    const fundingBefore = await api.balanceOf(customer.primaryAccountId);

    const created = await parse(await api.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId), AccountSchema);

    expect(created).toMatchObject({ customerId: customer.id, type: 'SAVINGS' });
    expect(await api.balanceOf(created.id)).toBe(OPENING_DEPOSIT);
    expect(await api.balanceOf(customer.primaryAccountId)).toBeCloseTo(fundingBefore - OPENING_DEPOSIT, 2);

    const accounts = await parse(await api.getAccounts(customer.id), AccountListSchema);
    expect(accounts.map((a) => a.id)).toEqual(expect.arrayContaining([customer.primaryAccountId, created.id]));
  });

  test('reports an unknown account as a client error', async ({ api }) => {
    const res = await api.getAccount(99_999_999);

    // 404 is the correct status; ParaBank answers 400 (BUG-016, covered in tests/regression).
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    expect(await res.text()).toContain('Could not find account #99999999');
  });
});
