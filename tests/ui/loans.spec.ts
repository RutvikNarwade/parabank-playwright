import { parse } from '../../src/api/ParaBankClient';
import { AccountSchema } from '../../src/api/schemas';
import { expect, test } from '../../src/fixtures';

test.describe('Request a loan', { tag: '@ui' }, () => {
  test('an affordable loan is approved and a loan account is opened', async ({ loanPage, api, customer }) => {
    await loanPage.goto();

    await loanPage.apply(2000, 150, customer.primaryAccountId);

    await expect(loanPage.resultHeading).toBeVisible();
    await expect(loanPage.status).toHaveText('Approved');
    await expect(loanPage.approvedMessage).toContainText('Congratulations, your loan has been approved.');
    await expect(loanPage.newAccountId).toHaveText(/^\d+$/);

    const loanAccount = await parse(await api.getAccount(Number(await loanPage.newAccountId.textContent())), AccountSchema);
    expect(loanAccount).toMatchObject({ customerId: customer.id, type: 'LOAN', balance: 2000 });
  });

  test('a loan whose down payment exceeds the available funds is denied with a reason', async ({ loanPage, api, customer }) => {
    const before = await api.balanceOf(customer.primaryAccountId);
    await loanPage.goto();

    await loanPage.apply(1000, 50_000, customer.primaryAccountId);

    await expect(loanPage.status).toHaveText('Denied');
    await expect(loanPage.deniedMessage).toHaveText('You do not have sufficient funds for the given down payment.');
    await expect(loanPage.approvedMessage).toBeHidden();
    expect(await api.balanceOf(customer.primaryAccountId)).toBe(before);
  });
});
