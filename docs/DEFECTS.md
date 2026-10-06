# Defect Reports: ParaBank

Every defect below was reproduced against the live instance and is pinned by an automated regression test (except where noted).
Each regression test asserts the **correct** behaviour and is marked as an expected failure with `knownDefect()` while the bug is open. If a defect gets fixed, the run reports *"expected to fail, but passed"*, which is the cue to remove the marker so the test becomes a permanent guard.

**Environment:** https://parabank.parasoft.com/parabank (public instance, REST API `/services/bank`, UI proxy `/services_proxy/bank`) ·
found 2026-10-06 · Chromium (Playwright 1.63), Node 24, Windows 11 · every probe used freshly registered test customers only.

**Severity scale:** Critical = money loss, data breach or permanent data corruption · High = wrong financial result or security weakness with a plausible path to harm · Medium = broken behaviour with a workaround / misleading errors · Low = robustness, hygiene, standards.

## Summary

| ID | Title | Severity | Area | Regression test |
|---|---|---|---|---|
| [BUG-001](#bug-001) | REST API has no authentication: anyone can read customer PII (incl. SSN) and move money | Critical | Security | `regression/access-control.api.spec.ts` |
| [BUG-002](#bug-002) | Signed-in customer can read and debit **other customers'** accounts (IDOR) | Critical | Security | `regression/access-control.api.spec.ts` |
| [BUG-003](#bug-003) | "Forgot login info" displays the plaintext password and signs the visitor in | Critical | Security | `regression/access-control.api.spec.ts` |
| [BUG-004](#bug-004) | Profile page embeds the plaintext password in its JavaScript and sends it in a URL | High | Security | `regression/access-control.api.spec.ts` |
| [BUG-005](#bug-005) | A $0.005 transfer permanently corrupts both accounts (HTTP 500 on every read) | Critical | Money / data integrity | `regression/money-movement.api.spec.ts` |
| [BUG-006](#bug-006) | Negative transfer amounts are accepted and pull money out of the destination | High | Money | `regression/money-movement.api.spec.ts` |
| [BUG-007](#bug-007) | A negative bill payment **credits** the paying account | High | Money | `regression/money-movement.api.spec.ts` |
| [BUG-008](#bug-008) | No balance check on transfers: unlimited overdraft | High | Money | `regression/money-movement.api.spec.ts` |
| [BUG-009](#bug-009) | Same-account and zero-amount transfers are accepted and recorded | Medium | Money | `regression/money-movement.api.spec.ts` |
| [BUG-010](#bug-010) | Double-clicking **Transfer** submits the payment twice | High | UI / money | `regression/ui-defects.spec.ts` |
| [BUG-011](#bug-011) | Empty or non-numeric transfer amount shows "An internal error has occurred" | Medium | UI / validation | `regression/ui-defects.spec.ts` |
| [BUG-012](#bug-012) | Account pages without a session answer HTTP 500 instead of asking the user to log in | Medium | UI / session | `regression/ui-defects.spec.ts` |
| [BUG-013](#bug-013) | Open Account error handler crashes with `ReferenceError: error is not defined` | Low | UI / error handling | `network/error-handling.spec.ts` |
| [BUG-014](#bug-014) | Registration accepts malformed SSN, phone and zip, and whitespace-only names | Medium | Validation | `regression/ui-defects.spec.ts` |
| [BUG-015](#bug-015) | Profile-update API accepts empty required fields | Medium | Validation / API | `regression/api-robustness.api.spec.ts` |
| [BUG-016](#bug-016) | REST API reports "not found" as 400 (and the UI proxy is inconsistent: 404 / 500) | Low | API contract | `regression/api-robustness.api.spec.ts` |
| [BUG-017](#bug-017) | `createAccount`: unknown type → HTTP 500 HTML page; response shows balance 0; spec mismatch | Low | API contract | `regression/api-robustness.api.spec.ts` |
| [BUG-018](#bug-018) | Posting the registration form on a new session → HTTP 500 | Low | Robustness | `regression/api-robustness.api.spec.ts` |
| [BUG-019](#bug-019) | Session id is exposed in URLs (`;jsessionid=…`) | Low | Security hygiene | `regression/api-robustness.api.spec.ts` |
| [BUG-020](#bug-020) | Form fields have no programmatic labels (login, registration, transfer…) | High (a11y) | Accessibility | `a11y/accessibility.spec.ts` (baseline) |
| [BUG-021](#bug-021) | Text colour contrast below WCAG AA 4.5:1 | Medium (a11y) | Accessibility | `a11y/accessibility.spec.ts` (baseline) |
| [BUG-022](#bug-022) | Page template: no `lang`, image link without text, image without `alt` | Medium (a11y) | Accessibility | `a11y/accessibility.spec.ts` (baseline) |

Rejected during investigation: *"Find Transactions shows an error for an unknown transaction id"*. Code reading suggested it (the page only handles 404 while the REST API returns 400), but the UI goes through `services_proxy`, which **does** return 404, and the page correctly shows an empty result. It was not filed. The client-side contract is pinned in `network/error-handling.spec.ts`.

---

## Security

### BUG-001
**REST API has no authentication: anyone can read customer PII (incl. SSN) and move money** · Critical · P1

The OpenAPI spec declares no security scheme, and no endpoint under `/services/bank` checks the caller.

1. With no cookies or credentials: `GET /parabank/services/bank/customers/{id}` with `Accept: application/json`
2. `POST /parabank/services/bank/transfer?fromAccountId={someone else's account}&toAccountId={any}&amount=1`

**Expected:** 401 Unauthorized for both.
**Actual:** `200` with full name, address, phone and **full SSN**. The transfer returns `200 Successfully transferred $1…` and the victim's balance drops.
**Impact:** complete loss of confidentiality and integrity for every customer. Customer and account ids are small sequential integers, so enumeration is trivial. Combined with BUG-003 this becomes account takeover.

### BUG-002
**Signed-in customer can read and debit other customers' accounts through `services_proxy` (IDOR)** · Critical · P1

The UI's own proxy checks that *a* user is logged in (anonymous calls get `401 {"message":"User login required"}`) but not that the user **owns** the customer or account in the URL.

1. Register customers A and B. Keep A's `JSESSIONID`.
2. As A: `GET /parabank/services_proxy/bank/customers/{B.id}` → B's profile incl. SSN.
3. As A: `POST /parabank/services_proxy/bank/transfer?fromAccountId={B's account}&toAccountId={A's account}&amount=1`

**Expected:** 403 for both. **Actual:** `200`, and $1 moves from B to A.
Related, verified through the REST API: `createAccount?customerId={A}&fromAccountId={B's account}` succeeds, so A's new account is funded with $100 of B's money.

### BUG-003
**"Forgot login info" displays the plaintext password and signs the visitor in** · Critical · P1

1. Open *Forgot login info?* (`lookup.htm`).
2. Enter first/last name, address, zip and SSN of a customer.

**Expected:** a reset link sent to a verified channel. The password is never shown, and the visitor is not logged in.
**Actual:** *"Your login information was located successfully. You are now logged in. Username: … Password: …"*.
**Impact:** every input the form asks for is public through BUG-001, so any account can be taken over in two requests. It also proves passwords are stored reversibly (not hashed).

### BUG-004
**Profile page embeds the plaintext password in its JavaScript and sends it in a URL** · High · P1

1. Log in and open *Update Contact Info* (`updateprofile.htm`); view source.
2. Click *Update Profile* and watch the network tab.

**Expected:** credentials never appear in page content or URLs.
**Actual:** the inline script contains `"&username=<user>&password=<password>"`, and the update request is `POST services_proxy/bank/customers/update/{id}?...&username=…&password=…`. Query strings end up in proxy, CDN and server access logs and in browser history.

## Money movement and data integrity

### BUG-005
**A $0.005 transfer permanently corrupts both accounts** · Critical · P1

1. Register a customer, open a second account.
2. `POST /services/bank/transfer?fromAccountId={A1}&toAccountId={A2}&amount=0.005` → `200 Successfully transferred $0.005`
3. `GET /services/bank/accounts/{A1}` (or A2, or `customers/{id}/accounts`, or `accounts/{A2}/transactions`)

**Expected:** amounts with more than 2 decimals are rejected (400). In any case, existing data stays readable.
**Actual:** every read of either account answers **HTTP 500** from then on. The customer's *Accounts Overview* can no longer load. A $0.01 transfer works fine, so the third decimal place is what breaks it (most likely a 2-decimal rounding/scale failure on read).
**Impact:** permanent denial of service for the customer, caused by a valid-looking request. Per the page source, the Transfer page forwards the amount as typed (no decimal-place check), so the UI can trigger it as well.

### BUG-006
**Negative transfer amounts are accepted** · High · P1

`POST /services/bank/transfer?fromAccountId={A1}&toAccountId={A2}&amount=-50` → `200 Successfully transferred $-50`.
**Expected:** 400. **Actual:** A1 *gains* $50 and A2 *loses* $50, so the money flows backwards. Combined with BUG-002, a user can pull money out of anyone's account.

### BUG-007
**A negative bill payment credits the paying account** · High · P1

`POST /services/bank/billpay?accountId={A}&amount=-20` (any payee) → `200 {"amount":-20,…}`.
**Expected:** 400. **Actual:** account A's balance goes **up** by $20 (observed $105.00 → $125.00). Per the page source, the Bill Pay page only checks `isNaN(parseFloat(amount))`, which lets `-20` through, so the UI can trigger it as well.

### BUG-008
**No balance check on transfers: unlimited overdraft** · High · P2

Transfer `balance + 10000` out of an account → `200`, and the balance becomes deeply negative (observed −$99,644.75). The overview then shows *Available Amount $0.00*, which is inconsistent with the server allowing the transfer.
**Expected:** reject transfers above the available balance (or above an agreed overdraft limit).

### BUG-009
**Same-account and zero-amount transfers are accepted** · Medium · P3

`transfer?fromAccountId=X&toAccountId=X&amount=5` and `transfer?…&amount=0` both return `200 Successfully transferred…` and write transactions to the history. The Transfer page **pre-selects the same account in both drop-downs**, so a user who only types an amount performs a self-transfer and gets a misleading "Transfer Complete!".

### BUG-010
**Double-clicking Transfer submits the payment twice** · High · P2

1. Log in, open *Transfer Funds*, enter an amount, choose two different accounts.
2. Double-click **Transfer** (or click again before the first response; on a slow network that is a long window).

**Expected:** one transfer. The button is disabled while the request is in flight (or the server de-duplicates).
**Actual:** two `POST services_proxy/bank/transfer` requests are sent, and the money moves twice.
Found with network interception: the test holds the first request so the second click deterministically lands while it is in flight.

## UI, validation and error handling

### BUG-011
**Empty or non-numeric transfer amount shows "An internal error has occurred"** · Medium · P3

1. *Transfer Funds*: leave **Amount** empty (or type `abc`) and click *Transfer*.

**Expected:** inline *"The amount cannot be empty."* / *"Please enter a valid amount."* Those messages exist in the page markup.
**Actual:** the request goes to the server (`400`), and the whole form is replaced by *"Error! An internal error has occurred and has been logged."*
**Root cause (from page source):** the validation is dead code. Both messages share the id `amount.errors`, and `$('#amount.errors')` selects *id=amount AND class=errors*, so it never matches.

### BUG-012
**Account pages without a session answer HTTP 500 instead of asking the user to log in** · Medium · P3

Open `overview.htm` (or `transfer.htm`) in a fresh browser, or after *Log Out*.
**Expected:** a redirect or 200 login page with a "please log in" message. **Actual:** **HTTP 500** with *"An internal error has occurred and has been logged."* Every session expiry is reported (and logged server-side) as a server error, which misleads users and pollutes monitoring. The pages do not leak data.

### BUG-013
**Open Account error handler crashes with `ReferenceError: error is not defined`** · Low · P4

When the accounts lookup fails (simulated with a mocked 503), `showError()` shows the error panel and then reads `error.status` from an undefined variable, throwing a JavaScript `ReferenceError`. The user sees the right message, but the diagnostic `console.error` never runs and script execution stops. Found through network mocking; a real outage would trigger it too.

### BUG-014
**Registration accepts malformed SSN, phone and zip, and whitespace-only names** · Medium · P3

Register with SSN `not-a-ssn`, phone `call me maybe`, zip `ZIP!!`, or first/last name and address of only spaces → *"Your account was created successfully"*.
**Expected:** format validation (SSN `NNN-NN-NNNN`, digits for zip and phone) and trimming of required text fields. Bad identity data breaks lookups (BUG-003 relies on SSN matching) and downstream KYC processes.

### BUG-015
**Profile-update API accepts empty required fields** · Medium · P3

`POST /services/bank/customers/update/{id}?firstName=&lastName=X&…` → `200 Successfully updated customer profile`, and the stored first name is now `""`. The UI marks the field as required, but only the browser enforces it. The same endpoint also lets the caller overwrite the **SSN**, which the UI does not expose.

## API contract and robustness

### BUG-016
**REST API reports "not found" as 400** · Low · P4

`GET /services/bank/accounts/99999999` → `400 Could not find account #99999999`. The same happens for `customers/{id}` and `transactions/{id}`.
**Expected:** 404 (400 means the *request* was malformed). The UI proxy disagrees with the REST API: `services_proxy/bank/transactions/{unknown}` → **404**, while `services_proxy/bank/accounts/{unknown}` → **500** HTML page. Clients cannot handle "not found" consistently.

### BUG-017
**`createAccount` contract problems** · Low · P4

- `newAccountType=9` (unknown) → **HTTP 500** with an HTML error page instead of a 400 JSON error.
- The spec describes `newAccountType` as "CHECKING, SAVINGS, LOAN" but types it as `integer`. Sending `CHECKING` → 404.
- The response reports `"balance": 0` although the account was just funded with $100 (a following `GET` shows 100.00).
- `newAccountType=2` creates a **LOAN** account directly, bypassing the loan-approval flow. *(Needs product confirmation: listed here, not covered by a test.)*

### BUG-018
**Posting the registration form on a new session → HTTP 500** · Low · P4

`POST register.htm` from a client that has not loaded the form first (no `JSESSIONID`) answers **500 "An internal error has occurred"**, even for invalid input. The server expects a session-scoped form object. Robustness issue for API clients, bookmarks and expired sessions. Discovered while building the test-data helper (see `docs/RELIABILITY.md`, RC-1).

### BUG-019
**Session id exposed in URLs** · Low · P4

A first visit to `index.htm` renders every link and asset as `…htm;jsessionid=<id>`. Session ids in URLs leak through Referer headers, logs, bookmarks and copy-pasted links (session fixation / hijacking risk). Cookies alone should carry the session (`tracking-mode=COOKIE`).

## Accessibility (WCAG 2.1 AA, found with axe-core 4.13)

These are tracked as a **baseline** in `src/support/a11y.ts`. The accessibility tests attach the full axe report, annotate each known violation with its defect id, and fail only on *new* serious or critical violations.

### BUG-020
**Form fields have no programmatic labels** · High · WCAG 1.3.1 / 4.1.2 (axe `label` and `select-name`, both critical)
Visible captions are plain `<b>` text in table cells, with no `<label for>` or `aria-label`. Confirmed by axe on the scanned pages: login (`username`, `password`, on every public page), all registration fields, and the Transfer page's amount input and **From / To account drop-downs** (`#fromAccountId`, `#toAccountId`). The bill pay, loan and open-account forms use the same markup (not scanned). Screen-reader users hear "edit text" or "combo box" with no name, so the login form and transfers are not usable non-visually.

### BUG-021
**Insufficient colour contrast** · Medium · WCAG 1.4.3 (axe `color-contrast`, serious)
Examples: the header caption `#828282` on white is 3.84:1; the "ATM Services / Online Services" captions `#ac9601` on white are 2.95:1; the registration labels `#5f7a77` on `#d5e2ff` are 3.56:1. All need 4.5:1.

### BUG-022
**Page template issues** · Medium · WCAG 3.1.1, 1.1.1, 2.4.4 (axe `html-has-lang`, `image-alt`, `link-name`)
On every page: `<html>` has no `lang`, and the top-left *Admin Page* link is an image (`images/clear.gif`) with no `alt` and no text, so it has no accessible name.

## Observations needing product clarification (not filed as defects)
- A **LOAN** account's balance (the amount owed) is added to the *Total* on Accounts Overview as if it were money the customer has.
- Loan requests with a negative amount are denied with *"insufficient funds"* rather than a validation error.
- `transactions/onDate/2026-13-45` (an impossible date) returns `200 []` instead of a validation error.
