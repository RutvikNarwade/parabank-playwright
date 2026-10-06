import { parse } from '../../src/api/ParaBankClient';
import { AccountSchema, TransactionListSchema } from '../../src/api/schemas';
import { expect, test } from '../../src/fixtures';

/**
 * Transfers are the highest-risk money movement in the app, so the business rules are covered
 * at the API layer: it is fast, precise (exact balances, status codes) and has no UI noise.
 * Defects found here (negative, overdraft, same-account and sub-cent transfers) live in
 * tests/regression/transfer-defects.api.spec.ts.
 */
test.describe('Transfer API', { tag: '@api' }, () => {
  test('moves money between own accounts and records both sides of the ledger', { tag: '@smoke' }, async ({ api, customer }) => {
    const savings = await parse(await api.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId), AccountSchema);
    const fromBefore = await api.balanceOf(customer.primaryAccountId);
    const toBefore = await api.balanceOf(savings.id);

    const res = await api.transfer(customer.primaryAccountId, savings.id, 42.5);

    expect(res.status()).toBe(200);
    expect(await res.text()).toBe(`Successfully transferred $42.5 from account #${customer.primaryAccountId} to account #${savings.id}`);
    expect(await api.balanceOf(customer.primaryAccountId)).toBeCloseTo(fromBefore - 42.5, 2);
    expect(await api.balanceOf(savings.id)).toBeCloseTo(toBefore + 42.5, 2);

    const sent = await parse(await api.getTransactions(customer.primaryAccountId), TransactionListSchema);
    const received = await parse(await api.getTransactions(savings.id), TransactionListSchema);
    expect(sent).toContainEqual(expect.objectContaining({ type: 'Debit', amount: 42.5, description: 'Funds Transfer Sent' }));
    expect(received).toContainEqual(expect.objectContaining({ type: 'Credit', amount: 42.5, description: 'Funds Transfer Received' }));
  });

  test('rejects a transfer to an account that does not exist and moves no money', async ({ api, customer }) => {
    const before = await api.balanceOf(customer.primaryAccountId);

    const res = await api.transfer(customer.primaryAccountId, 99_999_999, 10);

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('Could not find account');
    expect(await api.balanceOf(customer.primaryAccountId)).toBe(before);
  });

  test('rejects a non-numeric amount and moves no money', async ({ api, customer }) => {
    const savings = await parse(await api.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId), AccountSchema);
    const before = await api.balanceOf(customer.primaryAccountId);

    const res = await api.transfer(customer.primaryAccountId, savings.id, 'ten');

    // Today this is a 404 from the framework's parameter binding; any 4xx is an acceptable rejection.
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    expect(await api.balanceOf(customer.primaryAccountId)).toBe(before);
  });
});
