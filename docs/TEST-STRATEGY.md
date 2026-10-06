# Test Strategy: ParaBank

## 1. Goal
Give fast, trustworthy feedback on the risks that matter most for an online bank: **money moving correctly, customers' data and accounts being protected, and core journeys working**. The suite is deliberately small (≈70 tests). Each test exists because it covers a distinct risk, not to raise a count.

## 2. What I learned about the system (exploration first)
Before writing tests I explored the live app, its OpenAPI spec and each page's client script:

```
Browser (JSP pages + jQuery)
   │  XHR (session cookie)
   ▼
/parabank/services_proxy/bank/*   ← UI backend: requires a login, but not resource ownership (BUG-002)
   │
/parabank/services/bank/*          ← public REST API: no authentication at all (BUG-001), XML by default, JSON on request
   │
Shared database for every visitor (public demo, reset without notice), behind a Cloudflare rate limit
```

These facts drove the design:
- Registration exists **only** as an HTML form → the test-data helper posts that form over HTTP.
- Logged-in pages fetch their data via `services_proxy` XHR calls → clean seams for network interception.
- The environment is **shared and rate-limited** (about 20 POSTs/min per IP, then a 5-minute block) → per-test data isolation, a POST budget, low parallelism (see `RELIABILITY.md`).

## 3. Risk assessment and coverage

Impact × likelihood decides priority. Likelihood is informed by what exploration actually revealed.

| # | Risk | Impact | Likelihood | Priority | Covered by (layer → spec) |
|---|---|---|---|---|---|
| R1 | Money moves incorrectly (wrong amounts, one-sided ledger, negative/overdraft/sub-cent/duplicate transfers) | Critical | High (confirmed) | **P1** | API → `api/transfers`, `regression/money-movement` · UI → `ui/transfer`, `regression/ui-defects` (double submit) |
| R2 | One customer can see or move another customer's money / PII | Critical | High (confirmed) | **P1** | API → `regression/access-control` |
| R3 | Credentials or sessions leak (password disclosure, password in page, session in URL) | Critical | High (confirmed) | **P1** | API/HTTP → `regression/access-control`, `regression/api-robustness` |
| R4 | Customer cannot register / log in / log out correctly | High | Medium | **P1** | UI → `ui/registration`, `ui/login` · API → `api/auth` |
| R5 | Balances or accounts shown in the UI differ from the back end | High | Medium | **P1** | UI + API oracle → `ui/accounts`, `network/accounts-overview` |
| R6 | Account opening, bill pay and loan decisions wrong | High | Medium | P2 | API → `api/accounts`, `api/loans`, `api/billpay-transactions` · UI → `ui/accounts`, `ui/billpay`, `ui/loans` |
| R7 | Back-end failures leave the user with a false success or a broken page | High | Medium | P2 | Network mocks → `network/transfer-network`, `network/error-handling` |
| R8 | Input validation gaps (client and server) | Medium | High (confirmed) | P2 | UI → `ui/registration`, `ui/billpay`, `ui/find-transactions`, `ui/profile` · API → `regression/api-robustness` |
| R9 | Transaction history / search incorrect | Medium | Low | P3 | API → `api/billpay-transactions` · UI → `ui/find-transactions` |
| R10 | API contract drift (shape, types, content negotiation) | Medium | Medium | P3 | zod schemas validated in every API call + `api/contract` |
| R11 | Pages unusable with assistive technology | Medium | High (confirmed) | P3 | `a11y/accessibility` (axe WCAG 2.1 AA + keyboard journey) |
| R12 | Browser-specific breakage | Medium | Low | P4 | `@smoke` on Firefox + WebKit (nightly) |

## 4. Choosing the layer: API or UI

| Validate through the **API** when… | Validate through the **UI** when… |
|---|---|
| The rule is about data or money (balances, ledger entries, loan decisions) | The risk is in what the user sees or does (journeys, messages, navigation) |
| Many negative inputs are needed (cheap, precise status codes) | Validation lives in the browser (bill pay, find transactions, profile) |
| Authorization must be probed (UI can't express "call with another id") | Rendering and formatting matter (overview totals, negative balances) |
| Setup and assertions for UI tests (**API as test oracle**) | The page's own requests must be checked (request spy in `ui/transfer`) |

So the API layer covers the business rules **in depth**, and the UI layer covers each journey **once, end to end**, verifying the outcome through the API rather than by re-reading the UI.

## 5. Mocked vs real back end
- **Real back end by default.** Functional truth (balances, ledger, auth) can only come from the real system.
- **Mock only what is unsafe or impossible to produce on a shared environment:** 5xx errors, outages, dropped connections, latency, and edge-case data such as a negative balance or seven-figure amounts. Mocks replace only the data call (`services_proxy/...`). The page, session and scripts stay real.
- **Intercept without mocking** where the question is "what did the UI send?" (transfer request spy) or "what if the user acts while a request is in flight?" (held request → found BUG-010).
- A mock pins the **UI's contract** (e.g. "404 means no results"). A matching real-backend test catches when the server diverges from it (that check is how a suspected defect was ruled out, see `DEFECTS.md`).

## 6. Test data
- **One fresh customer per test**, registered over HTTP in about 1 s (`createCustomer` fixture). Unique username and unique PII, nothing shared, nothing seeded, no cleanup order. Tests that need two customers (authorization) create two.
- **Arrange through the API, act through the layer under test, assert against the API.** Expected values are computed from state read just before the action, never hard-coded (e.g. the $515.50 opening balance is environment data, not a test constant).
- **Never touch data we did not create**, and never call admin endpoints (`cleanDB`, `initializeDB`, `setParameter`). The environment is shared with other people.
- Data-driven tables where inputs vary but the behaviour is the same (login failures, loan denials, find-transaction validation, required registration fields).

## 7. Defects and regression
Every confirmed defect gets a report (`DEFECTS.md`) and a regression test that asserts the **correct** behaviour, marked with `knownDefect(id)` *after* its preconditions. The suite stays green while defects are open, every run re-confirms they still reproduce, and a fix is detected automatically ("expected to fail, but passed"). Exploratory findings that could not be confirmed were not filed.

## 8. Accessibility
axe-core (WCAG 2.1 A/AA) on the four highest-traffic pages (home/login, register, accounts overview, transfer), plus a keyboard-only login journey, because automated rules cannot judge operability. Known violations are **baselined** against defect ids, so the check fails only on *new* serious or critical violations rather than staying permanently red.

## 9. Not automated, and why
| Area | Reason |
|---|---|
| Performance / load, penetration testing | Out of scope per brief; would also abuse a shared public environment. Authorization was probed only between our own test customers. |
| Admin page, DB init/clean, JMS, SOAP/data-access modes | Global, destructive settings that would disrupt every other user of the shared instance |
| Every input permutation | Risk-based: representative equivalence classes + boundaries (zero, negative, sub-cent, overdraft) |
| Visual/pixel testing | Low value for this legacy UI. Formatting is asserted textually |
| Full suite on Firefox/WebKit | Only `@smoke` cross-browser. The app is server-rendered jQuery with low browser-specific risk, and the POST budget is better spent on depth |
| Positions / stock-trading endpoints | Not reachable from the UI; lower risk than core banking flows |

## 10. CI and reporting
GitHub Actions on push, PR, nightly and manual dispatch (with a `grep` input for tags or defect ids). Lint and typecheck gate the jobs, then API and browser jobs run in parallel. Artifacts: HTML report, JUnit XML and JSON results always; traces, screenshots and videos on failure. A job summary lists passed, failed and flaky tests and **which known defects still reproduce**. Details are in the README.

## 11. Exit criteria for a run
- 0 unexpected failures, and every `@defect` test still failing as expected (or deliberately un-marked after a fix).
- Retried tests are reported as *flaky* and investigated (`RELIABILITY.md` holds the root-cause log).
- A run blocked by the environment (429, outage) is reported as **ENVIRONMENT**, not as a product result, and is re-run.
