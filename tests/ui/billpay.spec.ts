import type { Payee } from '../../src/api/ParaBankClient';
import { expect, test } from '../../src/fixtures';

const payee: Payee = {
  name: 'Pune Water Board',
  address: { street: '5 River Rd', city: 'Pune', state: 'MH', zipCode: '411002' },
  phoneNumber: '020-5550-7777',
  accountNumber: 778_899,
};

test.describe('Bill pay', { tag: '@ui' }, () => {
  test('paying a bill confirms the payment and debits the chosen account', async ({ billPayPage, api, customer }) => {
    const before = await api.balanceOf(customer.primaryAccountId);
    await billPayPage.goto();

    await billPayPage.pay(payee, '45.10', customer.primaryAccountId);

    await expect(billPayPage.resultHeading).toBeVisible();
    await expect(billPayPage.resultPayee).toHaveText(payee.name);
    await expect(billPayPage.resultAmount).toHaveText('$45.10');
    await expect(billPayPage.resultAccount).toHaveText(String(customer.primaryAccountId));
    expect(await api.balanceOf(customer.primaryAccountId)).toBeCloseTo(before - 45.1, 2);
  });

  test('invalid input is caught in the browser and nothing is sent to the server', async ({ billPayPage, customer }) => {
    const billPayCalls: string[] = [];
    billPayPage.page.on('request', (req) => {
      if (req.url().includes('/services_proxy/bank/billpay')) billPayCalls.push(req.url());
    });
    await billPayPage.goto();

    await billPayPage.pay(payee, 'ten dollars', customer.primaryAccountId, '000000');

    await expect(billPayPage.validationError('verifyAccount-mismatch')).toHaveText('The account numbers do not match.');
    await expect(billPayPage.validationError('amount-invalid')).toHaveText('Please enter a valid amount.');
    await expect(billPayPage.resultHeading).toBeHidden();
    expect(billPayCalls).toEqual([]);
  });
});
