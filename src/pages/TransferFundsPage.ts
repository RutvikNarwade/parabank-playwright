import type { Locator, Page } from '@playwright/test';

export class TransferFundsPage {
  readonly amount: Locator;
  readonly fromAccount: Locator;
  readonly toAccount: Locator;
  readonly submitButton: Locator;
  readonly resultHeading: Locator;
  readonly resultAmount: Locator;
  readonly resultFrom: Locator;
  readonly resultTo: Locator;
  readonly errorPanel: Locator;

  constructor(readonly page: Page) {
    this.amount = page.locator('#amount');
    this.fromAccount = page.locator('#fromAccountId');
    this.toAccount = page.locator('#toAccountId');
    this.submitButton = page.getByRole('button', { name: 'Transfer' });
    this.resultHeading = page.getByRole('heading', { name: 'Transfer Complete!' });
    this.resultAmount = page.locator('#amountResult');
    this.resultFrom = page.locator('#fromAccountIdResult');
    this.resultTo = page.locator('#toAccountIdResult');
    this.errorPanel = page.locator('#showError');
  }

  async goto() {
    await this.page.goto('transfer.htm');
  }

  /**
   * Account options are loaded by an AJAX call after the page renders. selectOption() waits
   * until the requested option exists, so no explicit wait is needed here.
   */
  async fillForm(amount: number | string, fromAccountId: number, toAccountId: number) {
    await this.amount.fill(String(amount));
    await this.fromAccount.selectOption(String(fromAccountId));
    await this.toAccount.selectOption(String(toAccountId));
  }

  async transfer(amount: number | string, fromAccountId: number, toAccountId: number) {
    await this.fillForm(amount, fromAccountId, toAccountId);
    await this.submitButton.click();
  }
}
