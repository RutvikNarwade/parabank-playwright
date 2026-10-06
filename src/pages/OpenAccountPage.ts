import type { Locator, Page } from '@playwright/test';

export class OpenAccountPage {
  readonly accountType: Locator;
  readonly fromAccount: Locator;
  readonly submitButton: Locator;
  readonly resultHeading: Locator;
  readonly newAccountId: Locator;
  readonly errorPanel: Locator;

  constructor(readonly page: Page) {
    this.accountType = page.locator('#type');
    this.fromAccount = page.locator('#fromAccountId');
    this.submitButton = page.getByRole('button', { name: 'Open New Account' });
    this.resultHeading = page.getByRole('heading', { name: 'Account Opened!' });
    this.newAccountId = page.locator('#newAccountId');
    this.errorPanel = page.locator('#openAccountError');
  }

  async goto() {
    await this.page.goto('openaccount.htm');
  }

  async open(type: 'CHECKING' | 'SAVINGS', fromAccountId: number) {
    await this.accountType.selectOption({ label: type });
    await this.fromAccount.selectOption(String(fromAccountId));
    await this.submitButton.click();
  }
}
