import { expect, type Locator, type Page } from '@playwright/test';

export class UpdateProfilePage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly street: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly zipCode: Locator;
  readonly phoneNumber: Locator;
  readonly updateButton: Locator;
  readonly resultHeading: Locator;
  readonly errorPanel: Locator;

  constructor(readonly page: Page) {
    this.firstName = page.locator('[id="customer.firstName"]');
    this.lastName = page.locator('[id="customer.lastName"]');
    this.street = page.locator('[id="customer.address.street"]');
    this.city = page.locator('[id="customer.address.city"]');
    this.state = page.locator('[id="customer.address.state"]');
    this.zipCode = page.locator('[id="customer.address.zipCode"]');
    this.phoneNumber = page.locator('[id="customer.phoneNumber"]');
    this.updateButton = page.getByRole('button', { name: 'Update Profile' });
    this.resultHeading = page.getByRole('heading', { name: 'Profile Updated' });
    this.errorPanel = page.locator('#updateProfileError');
  }

  /**
   * The form is filled in by an AJAX call after the page loads. Anything typed before that
   * call returns is silently overwritten, which is a race. So wait until the server data is
   * in place before handing the form to the test (docs/RELIABILITY.md, RC-3).
   */
  async goto(expectedFirstName: string) {
    await this.page.goto('updateprofile.htm');
    await expect(this.firstName).toHaveValue(expectedFirstName);
  }

  fieldError(field: 'firstName' | 'lastName' | 'street' | 'city' | 'state' | 'zipCode') {
    return this.page.locator(`#${field}-error`);
  }
}
