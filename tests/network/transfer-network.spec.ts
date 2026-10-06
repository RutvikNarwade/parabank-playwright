import { parse } from '../../src/api/ParaBankClient';
import { AccountSchema } from '../../src/api/schemas';
import { expect, test } from '../../src/fixtures';

const TRANSFER_API = '**/services_proxy/bank/transfer?*';

test.describe('Transfer under adverse network conditions', { tag: ['@network', '@ui'] }, () => {
  test('a server error is reported and no success message is shown', async ({ transferPage, customer }) => {
    await transferPage.page.route(TRANSFER_API, (route) => route.fulfill({ status: 500, body: 'Internal Server Error' }));
    await transferPage.goto();

    await transferPage.transfer('10', customer.primaryAccountId, customer.primaryAccountId);

    await expect(transferPage.errorPanel).toContainText('An internal error has occurred and has been logged.');
    await expect(transferPage.resultHeading).toBeHidden();
  });

  test('a dropped connection is reported and no success message is shown', async ({ transferPage, customer }) => {
    await transferPage.page.route(TRANSFER_API, (route) => route.abort('connectionreset'));
    await transferPage.goto();

    await transferPage.transfer('10', customer.primaryAccountId, customer.primaryAccountId);

    await expect(transferPage.errorPanel).toBeVisible();
    await expect(transferPage.resultHeading).toBeHidden();
  });

  test('success is only confirmed after the server has answered', async ({ transferPage, api, customer }) => {
    const savings = await parse(await api.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId), AccountSchema);
    // Hold the real request until the test releases it: deterministic "slow network", no sleeps.
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    await transferPage.page.route(TRANSFER_API, async (route) => {
      await released;
      await route.fallback(); // continue to the real backend (through the POST throttle)
    });
    await transferPage.goto();
    const inFlight = transferPage.page.waitForRequest(TRANSFER_API);

    await transferPage.transfer('15', customer.primaryAccountId, savings.id);
    await inFlight;

    await expect(transferPage.resultHeading).toBeHidden();
    await expect(transferPage.submitButton).toBeVisible();

    release();
    await expect(transferPage.resultHeading).toBeVisible();
    await expect(transferPage.resultAmount).toHaveText('$15.00');
  });
});
