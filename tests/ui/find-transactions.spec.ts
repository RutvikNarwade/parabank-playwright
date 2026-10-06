import { parse } from '../../src/api/ParaBankClient';
import { AccountSchema } from '../../src/api/schemas';
import { expect, test } from '../../src/fixtures';

test.describe('Find transactions', { tag: '@ui' }, () => {
  test('finds a transfer by its amount', async ({ findTransactionsPage, api, customer }) => {
    const savings = await parse(await api.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId), AccountSchema);
    await expect(await api.transfer(customer.primaryAccountId, savings.id, 33.33)).toBeOK();
    await findTransactionsPage.goto();

    await findTransactionsPage.byAmount(customer.primaryAccountId, '33.33');

    await expect(findTransactionsPage.resultsHeading).toBeVisible();
    await expect(findTransactionsPage.resultRows).toHaveCount(1);
    await expect(findTransactionsPage.resultRows.first()).toContainText('Funds Transfer Sent');
    await expect(findTransactionsPage.resultRows.first()).toContainText('$33.33');
  });

  // Data-driven: each malformed search is rejected in the browser with its own message.
  const badSearches = [
    { title: 'a date that is not MM-DD-YYYY', search: 'byDate', value: '2026/10/06', errorId: 'transactionDateError', message: 'Invalid date format' },
    { title: 'a non-numeric amount', search: 'byAmount', value: 'lots', errorId: 'amountError', message: 'Invalid amount' },
    { title: 'a non-numeric transaction id', search: 'byId', value: 'abc', errorId: 'transactionIdError', message: 'Invalid transaction ID' },
  ] as const;
  for (const { title, search, value, errorId, message } of badSearches) {
    test(`rejects ${title} without calling the server`, async ({ findTransactionsPage, customer }) => {
      await findTransactionsPage.goto();

      await findTransactionsPage[search](customer.primaryAccountId, value);

      await expect(findTransactionsPage.fieldError(errorId)).toHaveText(message);
      await expect(findTransactionsPage.resultsHeading).toBeHidden();
    });
  }
});
