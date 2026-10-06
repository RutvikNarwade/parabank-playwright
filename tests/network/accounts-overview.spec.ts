import { expect, test } from '../../src/fixtures';

/**
 * Mocking policy (see docs/TEST-STRATEGY.md): the real backend is the source of truth for
 * functional behaviour. Mocks are used only for states that are unsafe or impossible to create
 * on a shared environment, such as server errors, outages, and edge-case data like a negative balance.
 * The page itself, the session and the HTML still come from the real server, and only the
 * data call is replaced.
 */
const ACCOUNTS_API = '**/services_proxy/bank/customers/*/accounts';

test.describe('Accounts overview under controlled backend responses', { tag: ['@network', '@ui'] }, () => {
  test('formats edge-case balances and never shows a negative available amount', async ({ overviewPage, customer }) => {
    await overviewPage.page.route(ACCOUNTS_API, (route) =>
      route.fulfill({
        json: [
          { id: 90001, customerId: customer.id, type: 'CHECKING', balance: 1234567.89 },
          { id: 90002, customerId: customer.id, type: 'SAVINGS', balance: -250.5 },
          { id: 90003, customerId: customer.id, type: 'LOAN', balance: 0 },
        ],
      }),
    );

    await overviewPage.goto();

    await expect(overviewPage.accountLinks).toHaveText(['90001', '90002', '90003']);
    await expect(overviewPage.balance(90001)).toHaveText('$1234567.89');
    await expect(overviewPage.balance(90002)).toHaveText('-$250.50');
    await expect(overviewPage.availableAmount(90002)).toHaveText('$0.00');
    await expect(overviewPage.totalBalance).toHaveText('$1234317.39');
  });

  test('shows an error instead of an empty table when the accounts service fails', async ({ overviewPage }) => {
    await overviewPage.page.route(ACCOUNTS_API, (route) => route.fulfill({ status: 500, body: 'Internal Server Error' }));

    await overviewPage.goto();

    await expect(overviewPage.errorPanel).toContainText('An internal error has occurred and has been logged.');
    await expect(overviewPage.table).toBeHidden();
  });
});
