import type { Locator, Page } from '@playwright/test';

export class FindTransactionsPage {
  readonly account: Locator;
  readonly resultsHeading: Locator;
  readonly resultRows: Locator;
  readonly errorPanel: Locator;

  constructor(readonly page: Page) {
    this.account = page.locator('#accountId');
    this.resultsHeading = page.getByRole('heading', { name: 'Transaction Results' });
    this.resultRows = page.locator('#transactionBody tr');
    this.errorPanel = page.locator('#errorContainer');
  }

  async goto() {
    await this.page.goto('findtrans.htm');
  }

  async byId(accountId: number, transactionId: number | string) {
    await this.account.selectOption(String(accountId));
    await this.page.locator('#transactionId').fill(String(transactionId));
    await this.page.locator('#findById').click();
  }

  /** @param date MM-DD-YYYY */
  async byDate(accountId: number, date: string) {
    await this.account.selectOption(String(accountId));
    await this.page.locator('#transactionDate').fill(date);
    await this.page.locator('#findByDate').click();
  }

  async byAmount(accountId: number, amount: number | string) {
    await this.account.selectOption(String(accountId));
    await this.page.locator('#amount').fill(String(amount));
    await this.page.locator('#findByAmount').click();
  }

  fieldError(id: 'transactionIdError' | 'transactionDateError' | 'dateRangeError' | 'amountError') {
    return this.page.locator(`#${id}`);
  }
}
