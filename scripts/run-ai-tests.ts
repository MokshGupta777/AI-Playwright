import fs from 'fs';
import path from 'path';
import { runAiTest, AiTestSpec, AiTestResult } from '../src/ai/aiAgentExecutor';

const SPECS_DIR = path.join(__dirname, '..', 'tests', 'ai', 'specs');
const RESULTS_DIR = path.join(__dirname, '..', 'ai-test-results');

async function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  if (!fs.existsSync(SPECS_DIR)) {
    console.log(`No specs directory found at ${SPECS_DIR}`);
    return;
  }

  const files = fs.readdirSync(SPECS_DIR).filter((f) => f.endsWith('.ai.json'));
  if (files.length === 0) {
    console.log('No AI test specs found in tests/ai/specs — nothing to run.');
    return;
  }

  const results: AiTestResult[] = [];

  for (const file of files) {
    const spec: AiTestSpec = JSON.parse(fs.readFileSync(path.join(SPECS_DIR, file), 'utf-8'));
    console.log(`\n▶ ${spec.title}`);
    const result = await runAiTest(spec);
    results.push(result);

    const icon = result.status === 'PASSED' ? '✅' : result.status === 'FAILED' ? '❌' : '⚠️';
    console.log(`  ${icon} ${result.status} (${result.turns} turns) — ${result.reason}`);

    fs.writeFileSync(path.join(RESULTS_DIR, `${spec.id}.json`), JSON.stringify(result, null, 2));
  }

  fs.writeFileSync(path.join(RESULTS_DIR, 'summary.json'), JSON.stringify(results, null, 2));

  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  console.log(`\n${passedCount}/${results.length} AI test(s) passed. Full results: ai-test-results/`);

  const anyFailed = results.some((r) => r.status !== 'PASSED');
  // AI-driven tests are non-deterministic by design — fail the CI step only
  // if explicitly asked to treat them as a hard gate.
  if (anyFailed && process.env.AI_TESTS_BLOCKING === 'true') {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
