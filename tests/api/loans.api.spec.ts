import { parse } from '../../src/api/ParaBankClient';
import { AccountListSchema, LoanResponseSchema } from '../../src/api/schemas';
import { expect, test } from '../../src/fixtures';

test.describe('Loan API', { tag: '@api' }, () => {
  test('approves an affordable loan, takes the down payment and opens a LOAN account', async ({ api, customer }) => {
    const fundingBefore = await api.balanceOf(customer.primaryAccountId);

    const loan = await parse(await api.requestLoan(customer.id, 1000, 100, customer.primaryAccountId), LoanResponseSchema);

    expect(loan.approved).toBe(true);
    expect(loan.accountId).toEqual(expect.any(Number));
    expect(await api.balanceOf(customer.primaryAccountId)).toBeCloseTo(fundingBefore - 100, 2);

    const accounts = await parse(await api.getAccounts(customer.id), AccountListSchema);
    expect(accounts).toContainEqual(expect.objectContaining({ id: loan.accountId, type: 'LOAN', balance: 1000 }));
  });

  // Data-driven: each denial reason maps to a distinct message key the UI translates.
  const denials = [
    { title: 'down payment larger than the available balance', amount: 1000, downPayment: 999_999, message: 'error.insufficient.funds.for.down.payment' },
    { title: 'loan far larger than the customer can support', amount: 10_000_000, downPayment: 10, message: 'error.insufficient.funds' },
  ];
  for (const { title, amount, downPayment, message } of denials) {
    test(`denies a loan with ${title} and moves no money`, async ({ api, customer }) => {
      const fundingBefore = await api.balanceOf(customer.primaryAccountId);

      const loan = await parse(await api.requestLoan(customer.id, amount, downPayment, customer.primaryAccountId), LoanResponseSchema);

      expect(loan).toMatchObject({ approved: false, message, accountId: null });
      expect(await api.balanceOf(customer.primaryAccountId)).toBe(fundingBefore);
      expect(await parse(await api.getAccounts(customer.id), AccountListSchema)).toHaveLength(1);
    });
  }
});
