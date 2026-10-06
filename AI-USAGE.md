# AI Usage

## Tools used
- **Claude Code** (Anthropic's agentic coding CLI) with the **Claude Opus 5.5** model, running in a terminal on my machine. It could read the assessment PDF, run shell commands, write files, and run Playwright scripts and tests against the live ParaBank instance.
- No other AI tools were used.

## How it was used
| Phase | What the AI did | How the output was checked |
|---|---|---|
| Understanding the brief | Read the 9-page assessment PDF and summarised the required deliverables | Checked against the PDF's section 7 / 12 checklists |
| Planning | Proposed a plan (stack, structure, coverage, data strategy, CI) in plan mode before any code was written | I approved the plan and chose the repo location and how to publish |
| Exploration | Wrote throw-away Playwright/HTTP scripts to register test users, capture every page's XHR calls, read page scripts, and probe API business rules | Every candidate defect was **re-run in isolation on a fresh customer** before it was accepted |
| Rate-limit investigation | Measured Cloudflare's limit with paced GET and POST probes | Numbers are recorded in docs/RELIABILITY.md (RC-2) |
| Framework and tests | Wrote the config, fixtures, API client, page objects and all specs | `tsc --noEmit`, ESLint, and repeated full runs against the live site |
| Debugging | Diagnosed failures from Playwright errors and traces (RC-1 … RC-5) | Each fix was re-run. Root causes are written up in docs/RELIABILITY.md |
| Documentation | Drafted README, TEST-STRATEGY, DEFECTS, RELIABILITY and this file | Claims were cross-checked against probe output and test results. Unverified claims were relabelled (see below) |

## Examples of useful prompts
- *"I have one task — first read all things, I will give you one pdf"*, followed by the PDF path, in **plan mode**. Starting in plan mode meant the AI explored and proposed an approach before writing anything.
- *"Are you able to do this task properly?"* This got an explicit statement of what the AI could and couldn't do (no `gh` CLI, the submission form and video are mine to do, I must be able to explain the code).
- Working rules the AI set for itself in its plan, which proved valuable (worth stating explicitly in future prompts):
  - Only file defects reproduced on a fresh customer, and label anything that comes only from reading page source.
  - Regression tests assert the correct behaviour and are marked as expected failures only after their preconditions pass.
  - Never touch data the tests did not create, and never call the admin or database-reset endpoints of the shared environment.

## Significant AI-generated output that I used
- The whole framework: `src/` (fixtures, API client + zod schemas, page objects, POST throttle, axe helper, `knownDefect`), all specs under `tests/`, `playwright.config.ts`, the GitHub Actions workflow and `scripts/ci-summary.mjs`.
- The defect investigation and reports in `docs/DEFECTS.md`, and the test strategy and reliability documents.

## Issues found in AI-generated output (and how they were fixed)
These were real mistakes made during the session, caught by running the code or re-checking the evidence:

1. **Wrong assumption about a defect.** From reading page JavaScript, the AI predicted that Find Transactions would show a system error for an unknown transaction id. The regression test unexpectedly *passed*. Investigation showed the UI proxy returns 404 (only the public REST API returns 400). The defect was **dropped**, not reported.
2. **Test-data flaw causing a false pass.** The first data factory gave every customer the same name and SSN, so the BUG-003 regression test "passed" because the lookup could not find the customer. Fixed with unique PII plus a precondition assertion (RELIABILITY RC-4).
3. **Self-inflicted timeouts.** The first version of the POST throttle held form submissions inside a click, exceeding the 15 s action timeout. Redesigned to reserve capacity during fixture setup (RC-5).
4. **Unsafe class-field initialisation in page objects.** The first drafts initialised locators from `this.page` in field initialisers, which can run before the constructor parameter is assigned. They were rewritten to assign in the constructor before any test ran.
5. **Rate limit not anticipated.** Exploration scripts fired requests too fast and got the IP blocked for 5 minutes, twice. That led to measuring the limit and designing the throttle.
6. **Overstated evidence in docs.** A draft claimed some defects were reproduced through the UI when they had been confirmed only via the API plus page source, and one root-cause note cited a trace that had not actually been opened. Both were corrected to state exactly what was verified.
7. **Incomplete accessibility baseline.** The AI built the axe baseline from truncated output and missed a critical `select-name` violation on the Transfer page. The first full run failed on it, as designed. It was added to BUG-020 and the baseline.
8. **Guessed locators and messages** (e.g. the activity page's `#accountType` and the bill-payment transaction description) were not trusted until the tests using them passed against the live site.

## What I modified or validated myself
<!-- Candidate: replace this list with what you personally reviewed, changed or re-ran. Be specific; you'll be asked about it. -->
- [ ] Read through every file in `src/` and `tests/` and can explain the fixture chain (`customer` → `loggedInPage` → page objects) and the POST throttle.
- [ ] Re-ran `npm test` locally and checked the HTML report.
- [ ] Reproduced at least the critical defects (BUG-001, 002, 003, 005) by hand.
- [ ] Reviewed the CI run, its job summary and artifacts on GitHub.
- [ ] Changes I made: …
