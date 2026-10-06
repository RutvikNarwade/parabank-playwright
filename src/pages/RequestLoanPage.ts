import type { Locator, Page } from '@playwright/test';

export class RequestLoanPage {
  readonly amount: Locator;
  readonly downPayment: Locator;
  readonly fromAccount: Locator;
  readonly applyButton: Locator;
  readonly resultHeading: Locator;
  readonly status: Locator;
  readonly provider: Locator;
  readonly approvedMessage: Locator;
  readonly deniedMessage: Locator;
  readonly newAccountId: Locator;
  readonly errorPanel: Locator;

  constructor(readonly page: Page) {
    this.amount = page.locator('#amount');
    this.downPayment = page.locator('#downPayment');
    this.fromAccount = page.locator('#fromAccountId');
    this.applyButton = page.getByRole('button', { name: 'Apply Now' });
    this.resultHeading = page.getByRole('heading', { name: 'Loan Request Processed' });
    this.status = page.locator('#loanStatus');
    this.provider = page.locator('#loanProviderName');
    this.approvedMessage = page.locator('#loanRequestApproved');
    this.deniedMessage = page.locator('#loanRequestDenied p.error');
    this.newAccountId = page.locator('#newAccountId');
    this.errorPanel = page.locator('#requestLoanError');
  }

  async goto() {
    await this.page.goto('requestloan.htm');
  }

  async apply(amount: number | string, downPayment: number | string, fromAccountId: number) {
    await this.amount.fill(String(amount));
    await this.downPayment.fill(String(downPayment));
    await this.fromAccount.selectOption(String(fromAccountId));
    await this.applyButton.click();
  }
}
