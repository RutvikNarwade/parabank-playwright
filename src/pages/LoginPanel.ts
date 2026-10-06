import type { Locator, Page } from '@playwright/test';

/** The "Customer Login" box on the left of every public page, plus the post-login account menu. */
export class LoginPanel {
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly error: Locator;
  readonly logoutLink: Locator;
  readonly accountServicesMenu: Locator;

  constructor(readonly page: Page) {
    this.username = page.locator('#loginPanel input[name="username"]');
    this.password = page.locator('#loginPanel input[name="password"]');
    this.loginButton = page.getByRole('button', { name: 'Log In' });
    this.error = page.locator('#rightPanel p.error');
    this.logoutLink = page.getByRole('link', { name: 'Log Out' });
    this.accountServicesMenu = page.getByRole('heading', { name: 'Account Services' });
  }

  async goto() {
    await this.page.goto('index.htm');
  }

  async login(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }

  /** Left-panel greeting after login, e.g. "Welcome Ada Tester". */
  welcome(fullName: string) {
    return this.page.locator('#leftPanel .smallText', { hasText: `Welcome ${fullName}` });
  }
}
