# Reliability, Debugging & Root-Cause Log

This document records every intermittent or surprising failure met while building the suite: how it was investigated, what the root cause was, and how it was fixed. It also lists the design rules that keep the suite deterministic.

## Root-cause log

### RC-1: Test-data setup failed with HTTP 500 on registration
**Symptom.** The first version of the HTTP registration helper (`POST register.htm` with the form fields) failed every time with *"An internal error has occurred"*. The same data typed into the browser worked.
**Investigation.** I compared two otherwise identical scripted requests side by side. One loaded `register.htm` first and the other posted straight away. The warmed-up one returned `200` and created the user. The cold one returned `500`, every time.
**Root cause.** The server keeps the registration form object in the HTTP session and dereferences it on POST. Without a prior GET, there is no session and no form object, so the server throws. Filed as **BUG-018**.
**Fix.** `registerViaForm()` (`src/api/registration.ts`) always loads the form first. It now registers a user in about 1 s, versus about 5 s through the browser.

### RC-2: Whole run suddenly fails with HTTP 429 for five minutes (Cloudflare rate limit)
**Symptom.** During exploration, every request (pages, API, assets) started returning `429` with a Cloudflare *"Error 1015: You are being rate limited"* body and `Retry-After: ~300`. In a test run this looks like dozens of unrelated failures.
**Investigation.** I measured the limit instead of guessing:

| Probe | Result |
|---|---|
| 150 GETs at ~0.8 req/s (190 s) | no 429 |
| 250 GETs at ~1.7 req/s (144 s) | no 429 |
| POSTs at ~1.7 req/s | **429 after 22 POSTs in 13 s**, `Retry-After: 300` |
| POSTs paced at 1 per 4.5 s (~13/min) | no 429 over the whole exploration run |

The earlier block had come after about 30 POSTs (registrations, transfers, account openings) spread over about 2 minutes.
**Root cause.** A rate-limiting rule at the CDN counts **POST** requests per client IP (about 20 per minute) and blocks the IP **for all traffic** for 300 s. It is an environment policy, not an application defect.
**Fix.** Rather than retries or sleeps, the suite:
1. **Paces POSTs** with `PostThrottle` (`src/support/PostThrottle.ts`). A sliding window allows `POST_BUDGET` (default 15) POSTs per 60 s, split evenly across workers so no cross-process coordination is needed. API client POSTs and browser POSTs both go through it: a `context.route` handler throttles form submissions and XHR POSTs.
2. **Fails fast and clearly**. `global-setup.ts` checks for an active block before any test runs. `withRateLimitRetry()` honours a short `Retry-After` but throws a `RateLimitedError` ("ENVIRONMENT: … not a product failure") for long blocks. Browser tests annotate the report when they see a 429.
3. **Keeps volume low**: default 2 workers, cross-browser runs limited to `@smoke`, and data set up through the API instead of the UI.

**Trade-off.** The full suite is bound by the POST budget (about 135 POSTs / 15 per min ≈ 9–10 min). That is acceptable for CI and nightly runs, and the honest cost of testing against a shared public environment. On a private environment, raising `POST_BUDGET` removes the bottleneck.

### RC-3: Update Profile could silently submit stale data (race, prevented)
**Finding.** While reading `updateprofile.htm`, I noticed the form renders empty and is filled by an AJAX call (`GET customers/{id}`) after page load. A test that types before that call returns has its input **overwritten** by the server values, so the test then "passes" while saving the old data, or fails intermittently depending on network speed.
**Fix.** `UpdateProfilePage.goto(expectedFirstName)` waits with a web-first assertion until the server data is in the form (`toHaveValue(firstName)`) before handing it to the test. This was caught by reading the page code, before it ever flaked.

### RC-4: A regression test passed for the wrong reason (test-data collision)
**Symptom.** The BUG-003 test ("Forgot login info must not reveal the password") reported *expected to fail, but passed*. On its face, that meant the bug was fixed.
**Investigation.** The defect had reproduced by hand minutes earlier with a customer whose name and SSN were unique. The test only checked that the response did *not* contain the password, so any response in which the lookup did not succeed would also "pass". The lookup matches on name, address and SSN, and the factory generated identical values for every test customer.
**Root cause.** A test-data design flaw. Every test customer had the **same** name, address and SSN, so the lookup could not identify one customer, and the test had no check that the lookup worked.
**Fix.** (1) `buildCustomer()` now generates unique last name, street, phone and SSN per customer (the SSN is in the never-issued `9xx` range). (2) The test asserts its **precondition** ("login information was located") *before* `knownDefect()`, so a broken lookup now fails loudly instead of masquerading as a fix. With both changes the test reproduces BUG-003 as intended. The same precondition-first pattern is used in every regression test.
**Lesson.** A test that asserts the *absence* of something needs a positive check that it looked in the right place.

### RC-5: Clicks timed out "waiting for scheduled navigations to finish" (self-inflicted by the throttle)
**Symptom.** After adding browser-side POST throttling, the two registration UI tests failed: `locator.click: Timeout 15000ms exceeded … waiting for scheduled navigations to finish`. The rest of the UI suite passed.
**Investigation.** Both tests submit a full-page form (a navigation POST). Their durations (~28 s) matched "throttle wait + action timeout". Tests whose POSTs were XHR or API calls were slow but green.
**Root cause.** When the worker's POST window was full, the route handler held the form-submission request. Playwright's `click()` waits for the navigation it triggered to commit, and that wait counts against the 15 s **action** timeout. So the click timed out while the request was legitimately queued.
**Fix.** `PostThrottle.waitForCapacity(n)` is called during **fixture setup** (`context` fixture): before a browser test starts, it waits until the worker can send `postHeadroom` POSTs immediately. The default is 3, the most any browser test sends. The double-submit test needs 4 and says so with `test.use({ postHeadroom: 4 })`. Any queuing now happens during setup, which falls under the 120 s test timeout, never inside an action. I kept the action timeout at 15 s rather than raising it, so genuinely stuck UI actions still fail fast.
**Follow-up.** A first version reserved 4 POSTs for every browser test. Correct, but browser tests then spent up to 60 s waiting for headroom they mostly did not use. Sizing the headroom to what tests really send keeps the safety and recovers throughput.

### RC-6: Two Firefox smoke tests failed together; freshly created data had vanished (shared database reset)
**Symptom.** In the first cross-browser run, 2 of 4 Firefox tests failed at the same moment with `toBeOK()` errors. Re-running passed, and 24 further Firefox/WebKit executions (`--repeat-each=3`) all passed. Classic "flaky".
**Investigation.** The JSON report of the failing run had the exact responses:
- *Registration test*: the UI registration succeeded ("Welcome …"), then about 2 s later `GET login/{that user}` → `400 Invalid username and/or password`.
- *Transfer test*: `createAccount` returned account **#85827**, then about 1 s later `GET accounts/85827` → `400 Could not find account #85827`.

Two independent customers' brand-new data disappeared within the same second (09:35:26–27 UTC). A customer registered a few minutes later received id **16985** / account **21003**, when ids had already passed 85000. The id sequences had **restarted from the seed values**.
**Root cause.** The shared public database was **reset** (re-initialised to its demo data) mid-run, by another visitor or a scheduled job. Anything created before the reset is gone. Neither the product nor the tests caused it, and it is not Firefox-specific.
**Fix and mitigation.**
1. Per-test data already keeps the exposure window to seconds. A reset only hits tests that are mid-flight.
2. **Automatic diagnosis**: when a test fails unexpectedly, the `createCustomer` fixture checks whether the customers it created still exist. If not, it annotates the test: *"ENVIRONMENT: … the shared ParaBank database was reset during the test"*. The CI job summary shows that note next to the failure, so nobody debugs the product for an environment event.
3. CI's single retry absorbs the rare hit, and the test is then listed as *flaky* with the note rather than silently passing.
4. Process lesson: re-running locally overwrote `test-results/`. The evidence survived only because the JSON report was written to `reports/`. CI keeps both as artifacts.

**Recurrence: the diagnosis in action.** About 13 minutes later, the final full run lost one test the same way. *"rejects a username that is already taken"* re-registered its customer's username and was *not* rejected, because that customer no longer existed. The fixture annotated it automatically (*"ENVIRONMENT: customer … no longer exists …"*), and the CI summary showed the note next to the failure. I checked the diagnosis independently rather than trusting it, since a broken duplicate check could produce the same symptom: a customer created at 09:39 UTC was also gone, and the next new customer got id **13544** (down from about 17000+). That is a second reset at about 09:48 UTC. **Two resets in about 13 minutes** show this is a regular feature of the public instance, most likely other people's practice suites calling ParaBank's database-initialise endpoint, which this suite deliberately never calls.

## Design rules that keep the suite deterministic

| Concern | Rule in this suite |
|---|---|
| Asynchronous UI | Web-first assertions (`toBeVisible`, `toHaveText`, `toHaveValue`) everywhere. `selectOption()` waits for AJAX-loaded options. **No `waitForTimeout`**, enforced by ESLint (`playwright/no-wait-for-timeout`, `no-networkidle`, `missing-playwright-await`). |
| Network timing | Slow-network scenarios **hold** a request on a promise and release it from the test (`network/transfer-network.spec.ts`), with no sleeps and no timing guesses. |
| Test data | Each test registers its own customer over HTTP. No seeded or shared data, no cleanup dependencies, nothing read from another test. Expected values come from API state read just before the action (e.g. the opening balance is never hard-coded). |
| Parallel execution | `fullyParallel: true`. Data is isolated per test, usernames are `qa<base36 time><random>`, and the POST budget is split per worker. |
| Authentication | UI tests reuse the session cookie created by registration (`loggedInPage`). No UI login in setup, and login itself is tested explicitly in `ui/login.spec.ts`. |
| Dynamic UI | Locators by role/text, or by stable `name`/`id`. Bill Pay's phone field gets a **random GUID id per page load**, so that page object uses `name` attributes only. |
| Time zones | Transaction dates are midnight UTC. `toParaBankDate()` formats in UTC, so results do not depend on the runner's zone (CI is UTC, the author's laptop UTC+5:30). |
| Destructive defects | Tests that corrupt data (BUG-005) or move money between customers (BUG-001/002) only use customers created in that test. Admin endpoints (`cleanDB`, `initializeDB`, `setParameter`) are never called. |
| Retries | `retries: 1` in CI only, as a safety net. Retried tests are reported as *flaky* in the job summary for follow-up, never silently accepted. Locally, retries are 0 so flakiness is visible. |
| Diagnostics | On failure: trace, screenshot and video. Axe JSON is attached to every a11y test. `knownDefect` annotations link test → defect id. The CI job summary lists failures, flaky tests and the defects still reproducing. |

## Stability verification

All runs against the live public instance on 2026-10-06, Windows 11, 2 workers, default `POST_BUDGET=15`.

| Run | Scope | Result | Duration | Notes |
|---|---|---|---|---|
| 1 | Full (api + chromium), 71 tests | 70 ✓ · 1 ✗ | 9.5 min | ✗ = a genuine accessibility violation (`select-name`) missing from the baseline. Added to BUG-020 |
| 2 | Full, 71 tests | **71 ✓** | 9.0 min | 0 flaky, 0 rate-limit hits |
| 3 | Smoke (`@smoke`), 7 tests | **7 ✓** | 20 s | |
| 4 | Cross-browser smoke (Firefox + WebKit), 8 tests | 6 ✓ · 2 ✗ | 53 s | ✗ = shared database reset mid-run (RC-6) |
| 5 | Cross-browser smoke `--repeat-each=3`, 24 tests | **24 ✓** | 1.9 min | |
| 6 | Full (final code), 71 tests | 70 ✓ · 1 ✗ | 8.6 min | ✗ = second database reset (RC-6), auto-annotated *ENVIRONMENT* and independently confirmed |

Across these runs (≈250 test executions) **no rate-limit block occurred** with the throttle active, and every failure traced to a root cause above: one real accessibility finding and two external database resets. No failure was caused by test timing or test-to-test interference. 21 expected-failure tests re-confirm 19 open defects on every run (BUG-020 to BUG-022 are tracked through the a11y baseline).
