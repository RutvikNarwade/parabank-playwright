import { test as base, type Cookie, type Page } from '@playwright/test';
import { parse, ParaBankClient } from '../api/ParaBankClient';
import { registerViaForm } from '../api/registration';
import { AccountListSchema, CustomerSchema } from '../api/schemas';
import { env } from '../config/env';
import { buildCustomer, type CustomerData } from '../data/customerFactory';
import { AccountsOverviewPage } from '../pages/AccountsOverviewPage';
import { BillPayPage } from '../pages/BillPayPage';
import { FindTransactionsPage } from '../pages/FindTransactionsPage';
import { LoginPanel } from '../pages/LoginPanel';
import { OpenAccountPage } from '../pages/OpenAccountPage';
import { RegisterPage } from '../pages/RegisterPage';
import { RequestLoanPage } from '../pages/RequestLoanPage';
import { TransferFundsPage } from '../pages/TransferFundsPage';
import { UpdateProfilePage } from '../pages/UpdateProfilePage';
import { PostThrottle } from '../support/PostThrottle';

/** A freshly registered customer that belongs to exactly one test. */
export interface TestCustomer extends CustomerData {
  id: number;
  /** The CHECKING account ParaBank opens automatically at registration. */
  primaryAccountId: number;
  /** Authenticated JSESSIONID from registration; loggedInPage injects it into the browser. */
  sessionCookies: Cookie[];
}

type WorkerFixtures = {
  postThrottle: PostThrottle;
};

type TestFixtures = {
  /**
   * POSTs a browser test may send (setup included) without queuing in the throttle mid-action.
   * Default 3 covers every test except the double-submit regression, which sets 4 via test.use().
   */
  postHeadroom: number;
  /** REST client used for setup, as a test oracle, and for API tests. */
  api: ParaBankClient;
  /** Registers a new customer; call it again when a test needs several (e.g. authorization tests). */
  createCustomer: (overrides?: Partial<CustomerData>) => Promise<TestCustomer>;
  customer: TestCustomer;
  /** The default `page`, already signed in as `customer`, with no UI login needed. */
  loggedInPage: Page;

  // Public pages (anonymous browser)
  loginPanel: LoginPanel;
  registerPage: RegisterPage;
  // Account pages (requesting one implies loggedInPage)
  overviewPage: AccountsOverviewPage;
  openAccountPage: OpenAccountPage;
  transferPage: TransferFundsPage;
  billPayPage: BillPayPage;
  loanPage: RequestLoanPage;
  findTransactionsPage: FindTransactionsPage;
  profilePage: UpdateProfilePage;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  postThrottle: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const perWorker = Math.max(1, Math.floor(env.postBudget / workerInfo.config.workers));
      await use(new PostThrottle(perWorker, env.postWindowMs));
    },
    { scope: 'worker' },
  ],

  postHeadroom: [3, { option: true }],

  // Route every browser request through the same POST throttle as the API client, and flag
  // Cloudflare 429s so a rate-limited run is reported as an environment problem.
  context: async ({ context, postThrottle, postHeadroom }, use, testInfo) => {
    // Wait for headroom up front so in-test form submissions never queue (RC-5).
    await postThrottle.waitForCapacity(postHeadroom);
    let rateLimited = 0;
    context.on('response', (res) => {
      if (res.status() === 429) rateLimited++;
    });
    await context.route('**/*', async (route) => {
      if (route.request().method() === 'POST') await postThrottle.acquire();
      await route.fallback();
    });
    await use(context);
    if (rateLimited) {
      testInfo.annotations.push({
        type: 'environment',
        description: `Cloudflare answered HTTP 429 to ${rateLimited} browser request(s): the run was rate-limited`,
      });
    }
  },

  api: async ({ playwright, postThrottle }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: env.apiUrl,
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    await use(new ParaBankClient(ctx, postThrottle));
    await ctx.dispose();
  },

  createCustomer: async ({ playwright, api, postThrottle }, use, testInfo) => {
    const created: CustomerData[] = [];
    await use(async (overrides = {}) => {
      const data = buildCustomer(overrides);
      const web = await playwright.request.newContext({ baseURL: env.baseUrl });
      try {
        await registerViaForm(web, data, postThrottle);
        created.push(data);
        const { cookies } = await web.storageState();
        const profile = await parse(await api.login(data.username, data.password), CustomerSchema);
        const [primary] = await parse(await api.getAccounts(profile.id), AccountListSchema);
        return { ...data, id: profile.id, primaryAccountId: primary.id, sessionCookies: cookies };
      } finally {
        await web.dispose();
      }
    });

    // Diagnosis for unexpected failures: if a customer this test created no longer exists, the
    // shared database was reset mid-test by another user of the public instance (RC-6).
    if (testInfo.status !== testInfo.expectedStatus) {
      for (const c of created) {
        const res = await api.login(c.username, c.password).catch(() => undefined);
        if (res?.status() === 400) {
          testInfo.annotations.push({
            type: 'environment',
            description: `ENVIRONMENT: customer "${c.username}" created by this test no longer exists. The shared ParaBank database was reset during the test, so this is not a product failure. Re-run.`,
          });
        }
      }
    }
  },

  customer: async ({ createCustomer }, use) => {
    await use(await createCustomer());
  },

  loggedInPage: async ({ page, context, customer }, use) => {
    await context.addCookies(customer.sessionCookies);
    await use(page);
  },

  loginPanel: async ({ page }, use) => use(new LoginPanel(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  overviewPage: async ({ loggedInPage }, use) => use(new AccountsOverviewPage(loggedInPage)),
  openAccountPage: async ({ loggedInPage }, use) => use(new OpenAccountPage(loggedInPage)),
  transferPage: async ({ loggedInPage }, use) => use(new TransferFundsPage(loggedInPage)),
  billPayPage: async ({ loggedInPage }, use) => use(new BillPayPage(loggedInPage)),
  loanPage: async ({ loggedInPage }, use) => use(new RequestLoanPage(loggedInPage)),
  findTransactionsPage: async ({ loggedInPage }, use) => use(new FindTransactionsPage(loggedInPage)),
  profilePage: async ({ loggedInPage }, use) => use(new UpdateProfilePage(loggedInPage)),
});

export { expect } from '@playwright/test';
