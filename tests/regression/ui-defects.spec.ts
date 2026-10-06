import { parse } from '../../src/api/ParaBankClient';
import { AccountSchema } from '../../src/api/schemas';
import { buildCustomer } from '../../src/data/customerFactory';
import { expect, test } from '../../src/fixtures';
import { knownDefect } from '../../src/support/knownDefect';

/** Regression tests for defects visible in the browser. Each test asserts the correct behaviour. */
test.describe('UI defects', { tag: ['@ui', '@defect'] }, () => {
  // Registration, account opening and two transfer POSTs: one more than the default headroom.
  test.describe(() => {
    test.use({ postHeadroom: 4 });

    test('BUG-010 a double-clicked transfer is submitted only once', async ({ transferPage, api, customer }) => {
      const savings = await parse(await api.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId), AccountSchema);
      const fromBefore = await api.balanceOf(customer.primaryAccountId);
      // Hold every transfer request so the second click lands while the first is still in flight.
      const submitted: string[] = [];
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      await transferPage.page.route('**/services_proxy/bank/transfer?*', async (route) => {
        submitted.push(route.request().url());
        await released;
        await route.fallback();
      });
      await transferPage.goto();

      await transferPage.fillForm('20', customer.primaryAccountId, savings.id);
      await transferPage.submitButton.dblclick();
      release();
      await expect(transferPage.resultHeading).toBeVisible();

      knownDefect('BUG-010', 'the Transfer button stays active while a transfer is in flight, so a double click pays twice');
      expect(submitted).toHaveLength(1);
      expect(await api.balanceOf(customer.primaryAccountId)).toBeCloseTo(fromBefore - 20, 2);
    });
  });

  test('BUG-011 an empty transfer amount gets a validation message, not a system error', async ({ transferPage, customer }) => {
    await transferPage.goto();

    await transferPage.transfer('', customer.primaryAccountId, customer.primaryAccountId);

    knownDefect('BUG-011', 'transfer page shows "An internal error has occurred" for an empty or non-numeric amount');
    await expect(transferPage.page.getByText('The amount cannot be empty.')).toBeVisible();
    await expect(transferPage.errorPanel).toBeHidden();
  });

  test('BUG-012 an account page opened without a session sends the visitor to log in, not to an error', async ({ page, loginPanel }) => {
    const response = await page.goto('overview.htm');

    await expect(loginPanel.loginButton).toBeVisible();
    knownDefect('BUG-012', 'protected pages answer HTTP 500 "internal error" when there is no session');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByText('An internal error has occurred')).toBeHidden();
  });

  test('BUG-014 registration rejects a malformed SSN', async ({ registerPage }) => {
    await registerPage.goto();

    await registerPage.register(buildCustomer({ ssn: 'not-a-ssn' }));

    knownDefect('BUG-014', 'registration accepts any text as SSN, phone and zip code');
    await expect(registerPage.fieldError('customer.ssn')).toBeVisible();
    await expect(registerPage.successMessage).toBeHidden();
  });
});
