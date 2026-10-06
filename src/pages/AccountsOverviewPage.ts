import type { Locator, Page } from '@playwright/test';

export class AccountsOverviewPage {
  readonly heading: Locator;
  readonly table: Locator;
  readonly accountLinks: Locator;
  readonly totalBalance: Locator;
  readonly errorPanel: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Accounts Overview' });
    this.table = page.locator('#accountTable');
    this.accountLinks = this.table.locator('tbody a');
    this.totalBalance = this.table.locator('tbody tr', { hasText: 'Total' }).locator('td').nth(1);
    this.errorPanel = page.locator('#showError');
  }

  async goto() {
    await this.page.goto('overview.htm');
  }

  row(accountId: number) {
    return this.table.locator('tbody tr', {
      has: this.page.getByRole('link', { name: String(accountId), exact: true }),
    });
  }

  balance(accountId: number) {
    return this.row(accountId).locator('td').nth(1);
  }

  availableAmount(accountId: number) {
    return this.row(accountId).locator('td').nth(2);
  }
}
