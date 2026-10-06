# ParaBank Test Automation (Playwright + TypeScript)

Risk-based UI and API test automation for the [ParaBank](https://parabank.parasoft.com/parabank/index.htm) demo bank.

**What's here:** 71 focused tests: API business rules and authorization, end-to-end UI journeys, network mocking and interception, and WCAG checks, plus automated regression coverage for every one of the **22 defects** found (four of them critical security or money bugs).

| Document | What it covers |
|---|---|
| [docs/TEST-STRATEGY.md](docs/TEST-STRATEGY.md) | Risks, priorities, which layer tests what and why, mocking policy, scope |
| [docs/DEFECTS.md](docs/DEFECTS.md) | 22 reproducible defect reports with severity, steps, evidence and regression-test links |
| [docs/RELIABILITY.md](docs/RELIABILITY.md) | Root-cause log of every flaky or surprising failure, and the determinism rules |
| [AI-USAGE.md](AI-USAGE.md) | How AI assistance was used, validated and corrected |

---

## 1. Setup

Requirements: **Node.js 20+** (developed on Node 24) and npm. No credentials are needed: the tests register their own customers.

```bash
git clone <this repo> && cd parabank-playwright
npm ci                                   # exact dependency versions from package-lock.json
npx playwright install chromium          # add "firefox webkit" for cross-browser smoke runs
cp .env.example .env                     # optional: every setting has a default
```

## 2. Environment configuration

All settings are optional environment variables (or `.env` entries). See [.env.example](.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `https://parabank.parasoft.com/parabank/` | Web root. The REST API is derived as `<BASE_URL>services/bank/` |
| `WORKERS` | `2` | Parallel workers. Keep low on the public instance (rate limit) |
| `POST_BUDGET` | `15` | POSTs allowed per window across all workers (Cloudflare blocks at about 20/min) |
| `POST_WINDOW_SEC` | `60` | Window for `POST_BUDGET` |
| `MAX_RATE_LIMIT_WAIT_SEC` | `60` | Longest `Retry-After` the API client will wait on a 429 before failing with an *ENVIRONMENT* error |

To run against a private ParaBank (e.g. `docker run -p 8080:8080 parasoft/parabank`), set `BASE_URL=http://localhost:8080/parabank/` and raise `POST_BUDGET`/`WORKERS` freely.

## 3. Running the tests

```bash
npm test                    # everything: API + Chromium (≈ 10 min on the public instance, bound by the POST budget)
```

| Group | Command | Selects |
|---|---|---|
| API | `npm run test:api` | `*.api.spec.ts` (no browser) |
| Browser | `npm run test:ui` | UI journeys, network, accessibility, UI regressions (Chromium) |
| Smoke | `npm run test:smoke` | `@smoke`: one critical path per area (7 tests, ≈ 30 s) |
| Defect regressions | `npm run test:regression` | `@defect`: one test per defect in DEFECTS.md |
| Security | `npm run test:security` | `@security`: authentication, authorization, credential leaks |
| Network | `npm run test:network` | `@network`: mocked and intercepted back-end conditions |
| Accessibility | `npm run test:a11y` | `@a11y`: axe WCAG 2.1 AA + keyboard journey |
| Cross-browser | `npm run test:cross-browser` | `@smoke` on Firefox + WebKit |
| Watch it run | `npm run test:headed` | Chromium, headed, 1 worker |

Ad-hoc selection works as usual: `npx playwright test --grep BUG-005`, `npx playwright test tests/ui/transfer.spec.ts`, `npx playwright test --ui`.
Static checks: `npm run lint` and `npm run typecheck`.

### Reading the results
- `ok` / `passed`: behaviour is correct.
- **Expected failures** (`x` in the list reporter, and counted as passed): regression tests for **open defects**. They assert the correct behaviour and are marked with `knownDefect('BUG-xxx')`, so each run proves the defect still reproduces. If one reports *"expected to fail, but passed"*, the defect was fixed: delete the `knownDefect` line and the test becomes a permanent guard.
- An error or annotation starting with **`ENVIRONMENT:`** means ParaBank was down, Cloudflare rate-limited the run, or the shared database was reset mid-test (the test's own customer vanished). It is not a product result: re-run (after about 5 minutes for a rate-limit block).

## 4. Reports

Every run writes:
- **HTML report** → `playwright-report/`. Open with `npm run report`. It includes traces, screenshots and video for failures, axe JSON for each a11y test, and defect annotations.
- **JUnit XML** → `reports/junit.xml` (CI test-results integrations).
- **JSON** → `reports/results.json` (feeds the CI job summary: `node scripts/ci-summary.mjs`).
- Failure traces: `npx playwright show-trace test-results/<test>/trace.zip`.

## 5. Automation approach

```
src/
  config/env.ts            typed settings (.env)
  api/ParaBankClient.ts    REST client: raw APIResponse for negative tests, parse() for typed + schema-validated bodies
  api/schemas.ts           zod contracts (Customer, Account, Transaction, Loan, BillPay)
  api/registration.ts      registers a customer through the HTML form over HTTP (no REST endpoint exists)
  api/rateLimit.ts         429 handling: honour short Retry-After, otherwise fail fast as ENVIRONMENT
  data/customerFactory.ts  unique customer data per test
  fixtures/index.ts        test.extend: api, customer, createCustomer, loggedInPage, page objects, POST throttle
  pages/                   Page Objects (one per screen, locators + intent-level actions, no assertions)
  support/                 PostThrottle, knownDefect, a11y (axe + baseline), money/date formatting
tests/
  api/         business rules, auth, contract              (project: api)
  ui/          end-to-end journeys, client validation      (project: chromium)
  network/     mocked failures, held requests, edge data   (project: chromium)
  a11y/        axe scans + keyboard-only journey           (project: chromium)
  regression/  one test per defect, *.api.spec.ts → api project, others → chromium
```

Key decisions (details in [TEST-STRATEGY.md](docs/TEST-STRATEGY.md)):
- **One runner (Playwright Test) for UI and API**: one report, one tagging scheme, one CI job type. API tests use Playwright's `APIRequestContext`.
- **Business rules at the API layer, journeys at the UI layer.** UI tests assert outcomes against the API as an oracle (e.g. after a UI transfer, both balances are re-read from the server).
- **Fixtures over inheritance.** Asking for `transferPage` gives a browser already signed in as a brand-new customer (`loggedInPage` injects the registration session cookie, so there is no UI login per test).
- **Page Objects hold locators and actions only.** Assertions stay in tests, so failures read as behaviour.
- **Tags** (`@smoke @api @ui @network @a11y @security @defect`) drive selective runs locally and in CI.
- **Contract checks everywhere.** Every successful API call is validated against a zod schema through `parse()`.
- **Guard rails in lint:** no `waitForTimeout`, no `networkidle`, no un-awaited Playwright calls, no `.only`.

## 6. Test data management

- **Every test creates its own customer** by posting the registration form over HTTP (~1 s). Usernames are `qa<base36 timestamp><random hex>`, and name, street, phone and SSN are randomised too (SSNs in the never-issued `9xx` range), so lookups by PII are unambiguous.
- Tests needing several customers (authorization) call `createCustomer()` again.
- **No shared or seeded data, no cleanup ordering, safe under `fullyParallel`.** Expected values are derived from API state read just before the action, never hard-coded.
- **Only our own data is touched.** Cross-customer and data-corrupting tests act on customers created inside that test. Admin endpoints (`cleanDB`, `initializeDB`, `setParameter`) are never called.

## 7. CI (GitHub Actions)

Workflow: [.github/workflows/playwright.yml](.github/workflows/playwright.yml)

| Trigger | Runs |
|---|---|
| push to `main`, pull request | lint + typecheck → **API** job ∥ **Chromium** job |
| nightly 02:30 UTC | the same + **Firefox/WebKit smoke** |
| manual (`workflow_dispatch`) | optional `grep` (e.g. `@smoke`, `BUG-005`) and cross-browser toggle |

- Artifacts: `api-report` / `ui-report` (HTML report + JUnit + JSON, always), `*-failure-traces` (traces, screenshots, videos, on failure only), kept 14 days.
- **Job summary** on each run page: passed / failed / flaky / *known defects reproduced*, with failure names and the list of still-open defects.
- `retries: 1` on CI only. Retried tests appear as **flaky** in the summary, not silently passed.
- `concurrency` ensures one run per branch at a time (shared, rate-limited target).

## 8. Assumptions

- The public instance at parabank.parasoft.com is the system under test. Its data is shared with other users and can be reset at any time, so tests never depend on pre-existing data.
- "Correct" behaviour for defects follows common banking and web standards where the app has no spec: e.g. reject negative or above-balance transfers, 404 for unknown resources, never display passwords, require auth on APIs. Each defect report states its expectation explicitly.
- A new customer's opening balance ($515.50) and the $100 opening deposit for new accounts are **environment behaviour**. Tests read the opening balance from the API rather than assuming it, and assert the documented $100 deposit.
- Transaction dates are stored as midnight UTC. Date searches are formatted in UTC.
- Probing authorization between two customers *we created* is in scope. Attacking other users' data or the environment is not.

## 9. Known limitations

- **Runtime is bound by the environment's rate limit** (about 20 POSTs/min per IP), so a full run takes about 10 minutes. The throttle prevents blocks, but another client on the same IP (e.g. a second local run) can still trigger one. The run then fails fast with an *ENVIRONMENT* message.
- GitHub-hosted runners share IP ranges. If a CI run is blocked by Cloudflare, re-run the job.
- The public database **is reset by others without notice**. This was observed during development (RELIABILITY RC-6). A reset wipes data created seconds earlier, so the few tests in flight at that moment fail. They are auto-annotated as *ENVIRONMENT* and CI's single retry absorbs them, but this cannot be prevented from the client side.
- Accessibility coverage is automated rules + one keyboard journey on four pages. That is not a full WCAG audit (no screen-reader testing).
- Cross-browser coverage is limited to `@smoke` by design.
- Defects confirmed only by reading page source are labelled as such in DEFECTS.md.

## 10. Results snapshot

A clean full local run against the public instance (2 workers):

| Tests | Passed | Known defects reproduced (expected failures) | Failed | Flaky | Duration |
|---|---|---|---|---|---|
| 71 | 50 | 21 tests → 19 defects | 0 | 0 | 9.0 min |

Not every run is clean, because the public database is reset by other users. Two of six recorded runs lost tests to a mid-run reset, and both were auto-diagnosed as *ENVIRONMENT*. The full run history and root causes are in [docs/RELIABILITY.md › Stability verification](docs/RELIABILITY.md#stability-verification).
