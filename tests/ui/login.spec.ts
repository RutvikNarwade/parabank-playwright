import { expect, test } from '../../src/fixtures';
import { AccountsOverviewPage } from '../../src/pages/AccountsOverviewPage';

test.describe('Login and session', { tag: '@ui' }, () => {
  test('a registered customer can log in and reach their accounts', { tag: '@smoke' }, async ({ page, loginPanel, customer }) => {
    await loginPanel.goto();

    await loginPanel.login(customer.username, customer.password);

    const overview = new AccountsOverviewPage(page);
    await expect(overview.heading).toBeVisible();
    await expect(overview.row(customer.primaryAccountId)).toBeVisible();
    await expect(loginPanel.welcome(`${customer.firstName} ${customer.lastName}`)).toBeVisible();
  });

  const invalidLogins = [
    { title: 'a wrong password', creds: (u: string) => [u, 'not-my-password'], error: 'The username and password could not be verified.' },
    { title: 'empty credentials', creds: () => ['', ''], error: 'Please enter a username and password.' },
  ] as const;
  for (const { title, creds, error } of invalidLogins) {
    test(`shows an error and stays signed out for ${title}`, async ({ loginPanel, customer }) => {
      const [username, password] = creds(customer.username);
      await loginPanel.goto();

      await loginPanel.login(username, password);

      await expect(loginPanel.error).toHaveText(error);
      await expect(loginPanel.logoutLink).toBeHidden();
    });
  }

  test('logging out ends the session and account pages stop showing data', async ({ overviewPage, loginPanel, customer }) => {
    await overviewPage.goto();
    await expect(overviewPage.row(customer.primaryAccountId)).toBeVisible();

    await loginPanel.logoutLink.click();
    await expect(loginPanel.loginButton).toBeVisible();

    // Revisit a protected page with the same browser and cookies, as if pressing Back.
    await overviewPage.goto();
    await expect(loginPanel.loginButton).toBeVisible();
    await expect(overviewPage.row(customer.primaryAccountId)).toBeHidden();
  });
});
