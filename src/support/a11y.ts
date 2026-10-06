import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

/**
 * Known accessibility defects (axe rule id -> defect id in docs/DEFECTS.md).
 *
 * The app ships with serious WCAG violations. Failing every run on them would hide new
 * regressions behind a permanently red check, so known issues are baselined, reported as
 * annotations, and linked to a defect. Any other serious or critical violation fails the test.
 */
export const KNOWN_A11Y_DEFECTS: Record<string, string> = {
  label: 'BUG-020', // inputs (incl. login and registration) have no programmatic label
  'select-name': 'BUG-020', // transfer "from"/"to" account drop-downs have no accessible name
  'color-contrast': 'BUG-021', // captions and form labels below 4.5:1
  'html-has-lang': 'BUG-022', // shared page template issues
  'image-alt': 'BUG-022',
  'link-name': 'BUG-022',
};

/**
 * Runs axe against WCAG 2.1 A/AA, attaches the full report to the test, and fails on any
 * serious or critical violation that is not in the known-defect baseline.
 */
export async function expectNoNewA11yViolations(page: Page, testInfo: TestInfo, pageName: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  await testInfo.attach(`axe-${pageName}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''));
  for (const v of blocking.filter((v) => v.id in KNOWN_A11Y_DEFECTS)) {
    testInfo.annotations.push({
      type: 'known a11y defect',
      description: `${KNOWN_A11Y_DEFECTS[v.id]}: ${v.id} on ${pageName} (${v.nodes.length} element(s)) - ${v.help}`,
    });
  }

  const unexpected = blocking
    .filter((v) => !(v.id in KNOWN_A11Y_DEFECTS))
    .map((v) => ({ rule: v.id, impact: v.impact, help: v.help, elements: v.nodes.map((n) => n.target.join(' ')) }));

  expect(unexpected, `New serious/critical WCAG violations on ${pageName}`).toEqual([]);
}
