import { buildCustomer } from '../../src/data/customerFactory';
import { expect, test } from '../../src/fixtures';

test.describe('Registration', { tag: '@ui' }, () => {
  test('a new visitor can register and is signed in straight away', { tag: '@smoke' }, async ({ registerPage, loginPanel, api }) => {
    const visitor = buildCustomer();
    await registerPage.goto();

    await registerPage.register(visitor);

    await expect(registerPage.welcomeHeading(visitor.username)).toBeVisible();
    await expect(registerPage.successMessage).toBeVisible();
    await expect(loginPanel.welcome(`${visitor.firstName} ${visitor.lastName}`)).toBeVisible();
    // Back-end oracle: the new credentials really work.
    await expect(await api.login(visitor.username, visitor.password)).toBeOK();
  });

  test('rejects a username that is already taken', async ({ registerPage, customer }) => {
    await registerPage.goto();

    await registerPage.register(buildCustomer({ username: customer.username }));

    await expect(registerPage.fieldError('customer.username')).toHaveText('This username already exists.');
    await expect(registerPage.successMessage).toBeHidden();
  });

  test('rejects a password confirmation that does not match', async ({ registerPage }) => {
    const visitor = buildCustomer();
    await registerPage.goto();

    await registerPage.register(visitor, `${visitor.password}-typo`);

    await expect(registerPage.fieldError('repeatedPassword')).toHaveText('Passwords did not match.');
    await expect(registerPage.successMessage).toBeHidden();
  });

  test('reports every missing required field at once', async ({ registerPage }) => {
    const required = {
      'customer.firstName': 'First name is required.',
      'customer.lastName': 'Last name is required.',
      'customer.address.street': 'Address is required.',
      'customer.address.city': 'City is required.',
      'customer.address.state': 'State is required.',
      'customer.address.zipCode': 'Zip Code is required.',
      'customer.ssn': 'Social Security Number is required.',
      'customer.username': 'Username is required.',
      'customer.password': 'Password is required.',
      repeatedPassword: 'Password confirmation is required.',
    };
    await registerPage.goto();

    await registerPage.registerButton.click();

    for (const [field, message] of Object.entries(required)) {
      await expect.soft(registerPage.fieldError(field), field).toHaveText(message);
    }
    // Phone number is optional by design.
    await expect(registerPage.fieldError('customer.phoneNumber')).toHaveCount(0);
  });
});
