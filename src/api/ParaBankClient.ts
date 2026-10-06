import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { z } from 'zod';
import type { PostThrottle } from '../support/PostThrottle';
import { withRateLimitRetry } from './rateLimit';
import { type AccountType } from './schemas';

/** createAccount takes a numeric code, not the type name (see BUG-017 in docs/DEFECTS.md). */
export const ACCOUNT_TYPE_CODE: Record<AccountType, number> = { CHECKING: 0, SAVINGS: 1, LOAN: 2 };

export interface Payee {
  name: string;
  address: { street: string; city: string; state: string; zipCode: string };
  phoneNumber: string;
  accountNumber: number;
}

type Params = Record<string, string | number>;

/**
 * Thin wrapper over the ParaBank REST API (<baseUrl>services/bank/).
 *
 * Every method returns the raw APIResponse, so negative tests can assert on status codes and
 * bodies. Use `parse()` to assert success and get a schema-validated, typed body.
 * The request context must be created with `baseURL = env.apiUrl` and `Accept: application/json`
 * (the API answers XML by default).
 */
export class ParaBankClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly postThrottle: PostThrottle,
  ) {}

  login(username: string, password: string) {
    return this.send('GET', `login/${encodeURIComponent(username)}/${encodeURIComponent(password)}`);
  }

  getCustomer(customerId: number) {
    return this.send('GET', `customers/${customerId}`);
  }

  getAccounts(customerId: number) {
    return this.send('GET', `customers/${customerId}/accounts`);
  }

  getAccount(accountId: number) {
    return this.send('GET', `accounts/${accountId}`);
  }

  createAccount(customerId: number, type: AccountType | number | string, fromAccountId: number) {
    const newAccountType = typeof type === 'string' && type in ACCOUNT_TYPE_CODE ? ACCOUNT_TYPE_CODE[type as AccountType] : type;
    return this.send('POST', 'createAccount', { params: { customerId, newAccountType, fromAccountId } });
  }

  transfer(fromAccountId: number, toAccountId: number, amount: number | string) {
    return this.send('POST', 'transfer', { params: { fromAccountId, toAccountId, amount } });
  }

  billPay(accountId: number, amount: number | string, payee: Payee) {
    return this.send('POST', 'billpay', { params: { accountId, amount }, data: payee });
  }

  requestLoan(customerId: number, amount: number | string, downPayment: number | string, fromAccountId: number) {
    return this.send('POST', 'requestLoan', { params: { customerId, amount, downPayment, fromAccountId } });
  }

  getTransactions(accountId: number) {
    return this.send('GET', `accounts/${accountId}/transactions`);
  }

  getTransaction(transactionId: number) {
    return this.send('GET', `transactions/${transactionId}`);
  }

  findTransactionsByAmount(accountId: number, amount: number | string) {
    return this.send('GET', `accounts/${accountId}/transactions/amount/${amount}`);
  }

  /** @param date MM-DD-YYYY */
  findTransactionsOnDate(accountId: number, date: string) {
    return this.send('GET', `accounts/${accountId}/transactions/onDate/${date}`);
  }

  updateCustomer(customerId: number, fields: Params) {
    return this.send('POST', `customers/update/${customerId}`, { params: fields });
  }

  /** Convenience for setup and assertions: current balance of an account. */
  async balanceOf(accountId: number): Promise<number> {
    const res = await this.getAccount(accountId);
    await expect(res, `GET accounts/${accountId}`).toBeOK();
    return (await res.json()).balance;
  }

  private send(method: 'GET' | 'POST', path: string, options: { params?: Params; data?: unknown } = {}) {
    return withRateLimitRetry(async () => {
      if (method === 'POST') await this.postThrottle.acquire();
      return this.request.fetch(path, { method, ...options });
    });
  }
}

/**
 * Asserts a 2xx response and validates the JSON body against a schema.
 * On failure, Playwright's toBeOK() prints the status and response body, which is the first
 * thing needed when debugging an API test.
 */
export async function parse<S extends z.ZodType>(res: APIResponse, schema: S): Promise<z.infer<S>> {
  await expect(res, `${res.url()}`).toBeOK();
  return schema.parse(await res.json());
}
