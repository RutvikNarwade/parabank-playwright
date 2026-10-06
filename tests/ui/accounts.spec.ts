import { parse } from '../../src/api/ParaBankClient';
import { AccountListSchema, AccountSchema } from '../../src/api/schemas';
import { expect, test } from '../../src/fixtures';
import { formatMoney } from '../../src/support/money';

test.describe('Accounts', { tag: '@ui' }, () => {
  test('the overview lists every account with the balance held by the back end', { tag: '@smoke' }, async ({ overviewPage, api, customer }) => {
    // Arrange a customer with two accounts through the API, which is fast and deterministic.
    await parse(await api.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId), AccountSchema);
    const accounts = await parse(await api.getAccounts(customer.id), AccountListSchema);

    await overviewPage.goto();

    await expect(overviewPage.accountLinks).toHaveText(accounts.map((a) => String(a.id)));
    for (const account of accounts) {
      await expect(overviewPage.balance(account.id)).toHaveText(formatMoney(account.balance));
    }
    const total = accounts.reduce((sum, a) => sum + a.balance, 0);
    await expect(overviewPage.totalBalance).toHaveText(formatMoney(total));
  });

  test('opening a savings account confirms the new number and funds it from the chosen account', async ({ openAccountPage, api, customer }) => {
    const fundingBefore = await api.balanceOf(customer.primaryAccountId);
    await openAccountPage.goto();

    await openAccountPage.open('SAVINGS', customer.primaryAccountId);

    await expect(openAccountPage.resultHeading).toBeVisible();
    await expect(openAccountPage.newAccountId).toHaveText(/^\d+$/);
    const newAccountId = Number(await openAccountPage.newAccountId.textContent());

    const created = await parse(await api.getAccount(newAccountId), AccountSchema);
    expect(created).toMatchObject({ customerId: customer.id, type: 'SAVINGS', balance: 100 });
    expect(await api.balanceOf(customer.primaryAccountId)).toBeCloseTo(fundingBefore - 100, 2);

    // The confirmation links straight to the new account's activity page.
    await openAccountPage.newAccountId.click();
    await expect(openAccountPage.page).toHaveURL(new RegExp(`activity\\.htm\\?id=${newAccountId}`));
    await expect(openAccountPage.page.locator('#accountType')).toHaveText('SAVINGS');
  });
});
