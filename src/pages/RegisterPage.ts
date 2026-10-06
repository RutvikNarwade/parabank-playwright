import type { Locator, Page } from '@playwright/test';
import { toRegistrationForm, type CustomerData } from '../data/customerFactory';

export class RegisterPage {
  readonly heading: Locator;
  readonly registerButton: Locator;
  readonly successMessage: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Signing up is easy!' });
    this.registerButton = page.getByRole('button', { name: 'Register' });
    this.successMessage = page.getByText('Your account was created successfully. You are now logged in.');
  }

  async goto() {
    await this.page.goto('register.htm');
  }

  async register(customer: CustomerData, repeatedPassword = customer.password) {
    for (const [field, value] of Object.entries(toRegistrationForm(customer, repeatedPassword))) {
      await this.field(field).fill(value);
    }
    await this.registerButton.click();
  }

  /** Form field by its form name, e.g. "customer.firstName" or "repeatedPassword". */
  field(name: string) {
    return this.page.locator(`#customerForm [name="${name}"]`);
  }

  /** Server-side validation message rendered next to a field. */
  fieldError(name: string) {
    return this.page.locator(`[id="${name}.errors"]`);
  }

  welcomeHeading(username: string) {
    return this.page.getByRole('heading', { name: `Welcome ${username}` });
  }
}
