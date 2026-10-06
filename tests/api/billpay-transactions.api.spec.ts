import { parse, type Payee } from '../../src/api/ParaBankClient';
import { BillPayResultSchema, TransactionListSchema, TransactionSchema } from '../../src/api/schemas';
import { expect, test } from '../../src/fixtures';
import { toParaBankDate } from '../../src/support/dates';

const payee: Payee = {
  name: 'City Power & Light',
  address: { street: '1 Grid Rd', city: 'Pune', state: 'MH', zipCode: '411001' },
  phoneNumber: '020-5550-0000',
  accountNumber: 55_501,
};

test.describe('Bill pay and transaction history API', { tag: '@api' }, () => {
  test('a bill payment debits the account and appears in its history', async ({ api, customer }) => {
    const before = await api.balanceOf(customer.primaryAccountId);

    const receipt = await parse(await api.billPay(customer.primaryAccountId, 37.25, payee), BillPayResultSchema);

    expect(receipt).toEqual({ payeeName: payee.name, amount: 37.25, accountId: customer.primaryAccountId });
    expect(await api.balanceOf(customer.primaryAccountId)).toBeCloseTo(before - 37.25, 2);
    const history = await parse(await api.getTransactions(customer.primaryAccountId), TransactionListSchema);
    expect(history).toContainEqual(
      expect.objectContaining({ type: 'Debit', amount: 37.25, description: `Bill Payment to ${payee.name}` }),
    );
  });

  test('transactions can be found by id, amount and date', async ({ api, customer }) => {
    await parse(await api.billPay(customer.primaryAccountId, 12.34, payee), BillPayResultSchema);
    const history = await parse(await api.getTransactions(customer.primaryAccountId), TransactionListSchema);
    const payment = history.find((t) => t.amount === 12.34);
    expect(payment, 'bill payment transaction').toBeDefined();

    const byId = await parse(await api.getTransaction(payment!.id), TransactionSchema);
    expect(byId).toEqual(payment);

    const byAmount = await parse(await api.findTransactionsByAmount(customer.primaryAccountId, 12.34), TransactionListSchema);
    expect(byAmount.map((t) => t.id)).toEqual([payment!.id]);

    const today = await parse(
      await api.findTransactionsOnDate(customer.primaryAccountId, toParaBankDate(new Date(payment!.date))),
      TransactionListSchema,
    );
    expect(today.map((t) => t.id)).toContain(payment!.id);
  });

  test('an amount with no matching transactions returns an empty list, not an error', async ({ api, customer }) => {
    const res = await api.findTransactionsByAmount(customer.primaryAccountId, 98_765.43);

    expect(await parse(res, TransactionListSchema)).toEqual([]);
  });
});
