// Turns Playwright's JSON report into a Markdown summary for the GitHub Actions job page.
// Usage: node scripts/ci-summary.mjs reports/results.json >> "$GITHUB_STEP_SUMMARY"
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'reports/results.json';
let report;
try {
  report = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  console.log(`### Test summary\n\nNo report found at \`${file}\`. The run probably stopped before any test started (see the global setup output in the log).`);
  process.exit(0);
}

const tests = [];
const walk = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) tests.push({ title: spec.title, file: spec.file, ...t });
  }
  for (const child of suite.suites ?? []) walk(child);
};
report.suites.forEach(walk);

const { expected, unexpected, flaky, skipped, duration } = report.stats;
const knownDefects = tests.filter((t) => t.status === 'expected' && t.expectedStatus === 'failed');
const failures = tests.filter((t) => t.status === 'unexpected');
const flakies = tests.filter((t) => t.status === 'flaky');
const defectId = (t) => t.annotations.find((a) => a.type === 'defect')?.description ?? '';

const openDefects = [...new Set(knownDefects.map((t) => defectId(t) || t.title))].sort();

const lines = [
  `### ${unexpected ? '❌' : '✅'} Playwright results (${(duration / 1000 / 60).toFixed(1)} min)`,
  '',
  '| Passed | Failed | Flaky | Skipped | Known defects reproduced |',
  '|---|---|---|---|---|',
  `| ${expected - knownDefects.length} | ${unexpected} | ${flaky} | ${skipped} | ${openDefects.length} (${knownDefects.length} tests) |`,
  '',
];
const environmentNote = (t) => {
  const note = t.annotations.find((a) => a.type === 'environment');
  return note ? `<br>⚠️ ${note.description}` : '';
};
if (failures.length) {
  lines.push('#### Failures', '', ...failures.map((t) => `- \`${t.projectName}\` ${t.file} › ${t.title}${environmentNote(t)}`), '');
}
if (flakies.length) {
  lines.push('#### Flaky (passed on retry; investigate)', '', ...flakies.map((t) => `- \`${t.projectName}\` ${t.file} › ${t.title}${environmentNote(t)}`), '');
}
if (openDefects.length) {
  lines.push(
    '<details><summary>Known defects still reproducing</summary>',
    '',
    ...openDefects.map((d) => `- ${d}`),
    '',
    '</details>',
  );
}
console.log(lines.join('\n'));
