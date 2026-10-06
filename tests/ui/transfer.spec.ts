import { parse } from '../../src/api/ParaBankClient';
import { AccountSchema } from '../../src/api/schemas';
import { expect, test } from '../../src/fixtures';

test.describe('Transfer funds', { tag: '@ui' }, () => {
  test('a customer can move money between their own accounts', { tag: '@smoke' }, async ({ transferPage, api, customer }) => {
    const savings = await parse(await api.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId), AccountSchema);
    const fromBefore = await api.balanceOf(customer.primaryAccountId);
    const toBefore = await api.balanceOf(savings.id);
    await transferPage.goto();

    // Observe (not mock) the request the page sends, to check that the UI passes on exactly what the user chose.
    const transferRequest = transferPage.page.waitForRequest((req) => req.url().includes('/services_proxy/bank/transfer'));
    await transferPage.transfer('25.50', customer.primaryAccountId, savings.id);

    const sent = new URL((await transferRequest).url()).searchParams;
    expect(Object.fromEntries(sent)).toEqual({
      fromAccountId: String(customer.primaryAccountId),
      toAccountId: String(savings.id),
      amount: '25.50',
    });

    await expect(transferPage.resultHeading).toBeVisible();
    await expect(transferPage.resultAmount).toHaveText('$25.50');
    await expect(transferPage.resultFrom).toHaveText(String(customer.primaryAccountId));
    await expect(transferPage.resultTo).toHaveText(String(savings.id));

    // Back-end oracle: the money really moved.
    expect(await api.balanceOf(customer.primaryAccountId)).toBeCloseTo(fromBefore - 25.5, 2);
    expect(await api.balanceOf(savings.id)).toBeCloseTo(toBefore + 25.5, 2);
  });
});
