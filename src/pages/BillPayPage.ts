import type { Locator, Page } from '@playwright/test';
import type { Payee } from '../api/ParaBankClient';

/**
 * Bill Pay form. Inputs have no stable ids (the phone field gets a random GUID id on every
 * page load), so this page object locates fields by their `name` attribute.
 */
export class BillPayPage {
  readonly sendButton: Locator;
  readonly resultHeading: Locator;
  readonly resultPayee: Locator;
  readonly resultAmount: Locator;
  readonly resultAccount: Locator;
  readonly errorPanel: Locator;

  constructor(readonly page: Page) {
    this.sendButton = page.getByRole('button', { name: 'Send Payment' });
    this.resultHeading = page.getByRole('heading', { name: 'Bill Payment Complete' });
    this.resultPayee = page.locator('#payeeName');
    this.resultAmount = page.locator('#billpayResult #amount');
    this.resultAccount = page.locator('#billpayResult #fromAccountId');
    this.errorPanel = page.locator('#billpayError');
  }

  async goto() {
    await this.page.goto('billpay.htm');
  }

  field(name: string) {
    return this.page.locator(`#billpayForm [name="${name}"]`);
  }

  /** Validation message next to a field, e.g. validationError('verifyAccount-mismatch'). */
  validationError(key: string) {
    return this.page.locator(`#validationModel-${key}`);
  }

  async pay(payee: Payee, amount: number | string, fromAccountId: number, verifyAccount = String(payee.accountNumber)) {
    await this.field('payee.name').fill(payee.name);
    await this.field('payee.address.street').fill(payee.address.street);
    await this.field('payee.address.city').fill(payee.address.city);
    await this.field('payee.address.state').fill(payee.address.state);
    await this.field('payee.address.zipCode').fill(payee.address.zipCode);
    await this.field('payee.phoneNumber').fill(payee.phoneNumber);
    await this.field('payee.accountNumber').fill(String(payee.accountNumber));
    await this.field('verifyAccount').fill(verifyAccount);
    await this.field('amount').fill(String(amount));
    await this.field('fromAccountId').selectOption(String(fromAccountId));
    await this.sendButton.click();
  }
}
