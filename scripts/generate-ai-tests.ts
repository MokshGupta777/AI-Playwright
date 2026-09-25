import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { createBrowserMcpClient } from '../src/ai/mcpBrowserClient';
import { runAgentLoop } from '../src/ai/agentLoop';
import { env } from '../src/config/env';

const SPECS_DIR = path.join(__dirname, '..', 'tests', 'ai', 'specs');
const anthropic = new Anthropic();

function listExistingTestTitles(): string[] {
  if (!fs.existsSync(SPECS_DIR)) return [];
  return fs
    .readdirSync(SPECS_DIR)
    .filter((f) => f.endsWith('.ai.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(SPECS_DIR, f), 'utf-8')).title as string;
      } catch {
        return f;
      }
    });
}

async function main() {
  const scope = process.argv[2] || 'the whole application, focusing on the most important user flows';
  const existingTitles = listExistingTestTitles();

  const mcpClient = await createBrowserMcpClient();

  try {
    const systemPrompt = `You are a QA engineer exploring a live web app at ${env.baseUrl} using real browser tools (Playwright MCP). Actually navigate and interact with the app — do not guess at its behavior.

Scope for this exploration session: ${scope}

Tests that already exist (do NOT propose duplicates of these):
${existingTitles.length ? existingTitles.map((t) => `- ${t}`).join('\n') : '- (none yet)'}

When you have finished exploring, respond with ONLY a raw JSON array (no markdown fences, no commentary before or after) of up to 5 new test case proposals, each shaped exactly as:
{"id": "kebab-case-unique-id", "title": "string", "steps": ["step 1", "step 2"], "successCriteria": "string"}

Base every proposal on something you actually observed in the browser during this session.`;

    const { finalText, turns } = await runAgentLoop({
      anthropic,
      mcpClient,
      systemPrompt,
      firstUserMessage: 'Begin exploring now.',
      maxTurns: 25,
      maxTokens: 2048,
    });

    console.log(`Exploration finished after ${turns} turn(s).`);

    let proposals: Array<{ id: string; title: string; steps: string[]; successCriteria: string }>;
    try {
      proposals = JSON.parse(finalText.trim());
    } catch {
      console.error('Could not parse the agent\'s final response as a JSON array:\n', finalText);
      process.exitCode = 1;
      return;
    }

    fs.mkdirSync(SPECS_DIR, { recursive: true });
    let written = 0;
    for (const p of proposals) {
      if (!p.id || !p.title || !Array.isArray(p.steps)) continue;
      const filePath = path.join(SPECS_DIR, `${p.id}.ai.json`);
      if (fs.existsSync(filePath)) {
        console.log(`Skipping "${p.id}" — a spec with that id already exists.`);
        continue;
      }
      fs.writeFileSync(filePath, JSON.stringify(p, null, 2));
      written++;
      console.log(`Wrote new spec: tests/ai/specs/${p.id}.ai.json`);
    }

    console.log(`\n${written} new AI test spec(s) generated out of ${proposals.length} proposed.`);
  } finally {
    await mcpClient.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
