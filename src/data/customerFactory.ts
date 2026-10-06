import { randomBytes } from 'node:crypto';

export interface CustomerData {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  ssn: string;
  username: string;
  password: string;
}

/**
 * Unique, short username: "qa" + base36 timestamp + random suffix (e.g. qamuwg1x2k7f3a).
 * The timestamp keeps names sortable and traceable to a run; the random suffix makes collisions
 * between parallel workers (or parallel CI jobs) practically impossible.
 */
export function uniqueUsername(prefix = 'qa'): string {
  return `${prefix}${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
}

const randomDigits = (n: number) => Array.from(randomBytes(n), (b) => b % 10).join('');
const randomLetters = (n: number) => Array.from(randomBytes(n), (b) => String.fromCharCode(97 + (b % 26))).join('');

/**
 * Builds valid registration data. Every call yields a brand-new identity; override any field per test.
 * PII is unique per customer, not just the username: ParaBank looks customers up by name, address
 * and SSN ("Forgot login info"), so identical PII across test users makes those lookups ambiguous.
 * See docs/RELIABILITY.md, RC-4.
 */
export function buildCustomer(overrides: Partial<CustomerData> = {}): CustomerData {
  return {
    firstName: 'Ada',
    lastName: `Tester-${randomLetters(6)}`,
    street: `${randomDigits(3)} Automation Way`,
    city: 'Pune',
    state: 'MH',
    zipCode: '411001',
    phoneNumber: `020-555-${randomDigits(4)}`,
    ssn: `9${randomDigits(2)}-${randomDigits(2)}-${randomDigits(4)}`, // 9xx: never issued as a real SSN
    username: uniqueUsername(),
    password: `Pw-${randomBytes(4).toString('hex')}`,
    ...overrides,
  };
}

/** Maps CustomerData onto the field names of the register.htm form. */
export function toRegistrationForm(c: CustomerData, repeatedPassword = c.password): Record<string, string> {
  return {
    'customer.firstName': c.firstName,
    'customer.lastName': c.lastName,
    'customer.address.street': c.street,
    'customer.address.city': c.city,
    'customer.address.state': c.state,
    'customer.address.zipCode': c.zipCode,
    'customer.phoneNumber': c.phoneNumber,
    'customer.ssn': c.ssn,
    'customer.username': c.username,
    'customer.password': c.password,
    repeatedPassword,
  };
}
