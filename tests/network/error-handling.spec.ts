import { expect, test } from '../../src/fixtures';
import { knownDefect } from '../../src/support/knownDefect';

test.describe('Error handling contracts', { tag: ['@network', '@ui'] }, () => {
  test('find transactions treats a 404 from the service as "no results"', async ({ findTransactionsPage, customer }) => {
    // The page's script expects "not found" to be HTTP 404. This pins that client-side contract.
    // The UI proxy honours it today. The public REST API answers 400 for the same lookup (BUG-016).
    await findTransactionsPage.page.route('**/services_proxy/bank/transactions/*', (route) =>
      route.fulfill({ status: 404, body: 'Not Found' }),
    );
    await findTransactionsPage.goto();

    await findTransactionsPage.byId(customer.primaryAccountId, 123456789);

    await expect(findTransactionsPage.resultsHeading).toBeVisible();
    await expect(findTransactionsPage.resultRows).toHaveCount(0);
    await expect(findTransactionsPage.errorPanel).toBeHidden();
  });

  test('open account reports a failed account lookup without a script crash', { tag: '@defect' }, async ({ openAccountPage }) => {
    const scriptErrors: string[] = [];
    openAccountPage.page.on('pageerror', (err) => scriptErrors.push(err.message));
    await openAccountPage.page.route('**/services_proxy/bank/customers/*/accounts', (route) =>
      route.fulfill({ status: 503, body: 'Service Unavailable' }),
    );

    await openAccountPage.goto();

    await expect(openAccountPage.errorPanel).toContainText('An internal error has occurred and has been logged.');
    knownDefect('BUG-013', 'the error handler references an undefined variable: "ReferenceError: error is not defined"');
    expect(scriptErrors).toEqual([]);
  });
});
