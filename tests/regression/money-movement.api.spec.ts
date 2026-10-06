import { parse, type ParaBankClient, type Payee } from '../../src/api/ParaBankClient';
import { AccountSchema } from '../../src/api/schemas';
import { expect, test, type TestCustomer } from '../../src/fixtures';
import { knownDefect } from '../../src/support/knownDefect';

/** Regression tests for defects in how money moves. Each test asserts the correct behaviour. */
test.describe('Money movement defects', { tag: ['@api', '@defect'] }, () => {
  async function openSavings(api: ParaBankClient, customer: TestCustomer) {
    return parse(await api.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId), AccountSchema);
  }

  test('BUG-005 a sub-cent transfer must not corrupt the accounts involved', async ({ api, customer }) => {
    const savings = await openSavings(api, customer);
    await api.transfer(customer.primaryAccountId, savings.id, 0.005);

    knownDefect('BUG-005', 'transferring $0.005 makes both accounts permanently unreadable (HTTP 500)');
    for (const accountId of [customer.primaryAccountId, savings.id]) {
      const res = await api.getAccount(accountId);
      expect(res.status(), `GET accounts/${accountId}`).toBe(200);
    }
    expect((await api.getAccounts(customer.id)).status()).toBe(200);
  });

  test('BUG-006 a negative transfer amount must be rejected', async ({ api, customer }) => {
    const savings = await openSavings(api, customer);
    const fromBefore = await api.balanceOf(customer.primaryAccountId);
    const toBefore = await api.balanceOf(savings.id);

    const res = await api.transfer(customer.primaryAccountId, savings.id, -50);

    knownDefect('BUG-006', 'negative amounts are accepted and pull money out of the destination account');
    expect(res.status()).toBe(400);
    expect(await api.balanceOf(customer.primaryAccountId)).toBe(fromBefore);
    expect(await api.balanceOf(savings.id)).toBe(toBefore);
  });

  test('BUG-007 a negative bill payment must not credit the paying account', async ({ api, customer }) => {
    const payee: Payee = {
      name: 'Refund Me Ltd',
      address: { street: '1 Way', city: 'Pune', state: 'MH', zipCode: '411001' },
      phoneNumber: '1',
      accountNumber: 4242,
    };
    const before = await api.balanceOf(customer.primaryAccountId);

    const res = await api.billPay(customer.primaryAccountId, -20, payee);

    knownDefect('BUG-007', 'bill pay with a negative amount adds money to the payer');
    expect(res.status()).toBe(400);
    expect(await api.balanceOf(customer.primaryAccountId)).toBe(before);
  });

  test('BUG-008 a transfer larger than the available balance must be rejected', async ({ api, customer }) => {
    const savings = await openSavings(api, customer);
    const available = await api.balanceOf(customer.primaryAccountId);

    const res = await api.transfer(customer.primaryAccountId, savings.id, available + 10_000);

    knownDefect('BUG-008', 'transfers are not checked against the balance (unlimited overdraft)');
    expect(res.status()).toBe(400);
    expect(await api.balanceOf(customer.primaryAccountId)).toBe(available);
  });

  test('BUG-009 a transfer into the same account must be rejected', async ({ api, customer }) => {
    const res = await api.transfer(customer.primaryAccountId, customer.primaryAccountId, 5);

    knownDefect('BUG-009', 'same-account and zero-amount transfers are accepted and recorded');
    expect(res.status()).toBe(400);
  });

  test('BUG-009 a zero-amount transfer must be rejected', async ({ api, customer }) => {
    const savings = await openSavings(api, customer);

    const res = await api.transfer(customer.primaryAccountId, savings.id, 0);

    knownDefect('BUG-009', 'same-account and zero-amount transfers are accepted and recorded');
    expect(res.status()).toBe(400);
  });
});
