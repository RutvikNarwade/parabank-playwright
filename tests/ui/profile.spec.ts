import { parse } from '../../src/api/ParaBankClient';
import { CustomerSchema } from '../../src/api/schemas';
import { expect, test } from '../../src/fixtures';

test.describe('Update contact info', { tag: '@ui' }, () => {
  test('a changed address and phone number are saved', async ({ profilePage, api, customer }) => {
    await profilePage.goto(customer.firstName);

    await profilePage.street.fill('42 Regression Rd');
    await profilePage.city.fill('Mumbai');
    await profilePage.phoneNumber.fill('022-5550-4242');
    await profilePage.updateButton.click();

    await expect(profilePage.resultHeading).toBeVisible();
    const saved = await parse(await api.getCustomer(customer.id), CustomerSchema);
    expect(saved).toMatchObject({
      firstName: customer.firstName,
      address: { street: '42 Regression Rd', city: 'Mumbai', state: customer.state, zipCode: customer.zipCode },
      phoneNumber: '022-5550-4242',
    });
  });

  test('required fields cannot be blanked out', async ({ profilePage, api, customer }) => {
    await profilePage.goto(customer.firstName);

    await profilePage.lastName.clear();
    await profilePage.city.clear();
    await profilePage.updateButton.click();

    await expect(profilePage.fieldError('lastName')).toHaveText('Last name is required.');
    await expect(profilePage.fieldError('city')).toHaveText('City is required.');
    await expect(profilePage.resultHeading).toBeHidden();
    const saved = await parse(await api.getCustomer(customer.id), CustomerSchema);
    expect(saved.lastName).toBe(customer.lastName);
  });
});
