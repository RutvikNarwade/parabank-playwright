import { expect, test } from '../../src/fixtures';
import { expectNoNewA11yViolations } from '../../src/support/a11y';

/**
 * Accessibility scope: the pages every customer must get through (sign in, sign up) and the
 * two highest-value signed-in pages (accounts overview, transfer funds). Automated WCAG checks
 * catch roughly a third of real issues, so a keyboard-only journey covers what axe cannot.
 */
test.describe('Accessibility', { tag: '@a11y' }, () => {
  const publicPages = [
    { name: 'home', path: 'index.htm' },
    { name: 'register', path: 'register.htm' },
  ];
  for (const { name, path } of publicPages) {
    test(`${name} page has no new serious WCAG 2.1 AA violations`, async ({ page }, testInfo) => {
      await page.goto(path);
      await expectNoNewA11yViolations(page, testInfo, name);
    });
  }

  test('accounts overview has no new serious WCAG 2.1 AA violations', async ({ overviewPage, customer }, testInfo) => {
    await overviewPage.goto();
    await expect(overviewPage.row(customer.primaryAccountId)).toBeVisible(); // scan the rendered data, not a loading state
    await expectNoNewA11yViolations(overviewPage.page, testInfo, 'overview');
  });

  test('transfer funds has no new serious WCAG 2.1 AA violations', async ({ transferPage, customer }, testInfo) => {
    await transferPage.goto();
    await expect(transferPage.fromAccount.locator('option')).toHaveText([String(customer.primaryAccountId)]);
    await expectNoNewA11yViolations(transferPage.page, testInfo, 'transfer');
  });

  test('a customer can sign in using only the keyboard', async ({ page, loginPanel, customer }) => {
    await loginPanel.goto();

    // The page focuses the username field on load. From there, Tab and Enter are all that is needed.
    await expect(loginPanel.username).toBeFocused();
    await page.keyboard.type(customer.username);
    await page.keyboard.press('Tab');
    await expect(loginPanel.password).toBeFocused();
    await page.keyboard.type(customer.password);
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Accounts Overview' })).toBeVisible();
  });
});
