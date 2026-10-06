import { test } from '@playwright/test';

/**
 * Marks the rest of the current test as an expected failure for an open defect.
 *
 * Regression tests for defects assert the CORRECT behaviour. While the defect is open, they
 * would fail on every run, so call this right before the assertions that expose the bug:
 *
 *  - Setup that runs before this call keeps normal semantics. A broken environment or test
 *    still fails loudly instead of hiding behind the "expected failure".
 *  - When the defect is fixed, Playwright reports the test as "expected to fail, but passed".
 *    That is the signal to delete this call, after which the test becomes a plain regression guard.
 *
 * Defect details live in docs/DEFECTS.md under the same id.
 */
export function knownDefect(id: string, summary: string) {
  test.info().annotations.push({ type: 'defect', description: `${id}: ${summary} (docs/DEFECTS.md)` });
  test.fail(true, `${id} is open`);
}
