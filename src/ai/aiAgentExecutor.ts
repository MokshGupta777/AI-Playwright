import { createBrowserMcpClient } from './mcpBrowserClient';
import { runAgentLoop, TranscriptEntry } from './agentLoop';
import { env } from '../config/env';
import { users } from '../data/users';

export interface AiTestSpec {
  id: string;
  title: string;
  baseUrl?: string;
  steps: string[];
  successCriteria: string;
  maxTurns?: number;
}

export interface AiTestResult {
  id: string;
  title: string;
  status: 'PASSED' | 'FAILED' | 'ERROR';
  turns: number;
  transcript: TranscriptEntry[];
  reason: string;
}

function buildSystemPrompt(spec: AiTestSpec): string {
  return `You are a QA automation agent. You drive a REAL web browser exclusively through the tools you were given (Playwright MCP). You have no other way to interact with the page.

Base URL: ${spec.baseUrl ?? env.baseUrl}

Test data you may use if a step calls for it (do not invent credentials):
- Valid user: email="${users.validUser.email}", password="${users.validUser.password}"
- Invalid user: email="${users.invalidUser.email}", password="${users.invalidUser.password}"

Test: "${spec.title}"

Perform these steps, in order, using the browser tools:
${spec.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Success criteria: ${spec.successCriteria}

Rules:
- Use a tool for every action and every check. Take a page snapshot before deciding an element is present or absent.
- Never assume a step succeeded without tool evidence (a snapshot, visible text, URL, etc).
- If a step fails or an expected element is missing, stop and report FAILED with what you actually observed.
- When finished, your FINAL message must be plain text (no tool call) starting with exactly "RESULT: PASSED" or "RESULT: FAILED", followed by one concise sentence citing the evidence you saw in the browser.`;
}

/**
 * Executes a single natural-language test spec end to end:
 * spins up an isolated browser via Playwright MCP, lets Claude drive it
 * step by step, and parses the agent's final verdict.
 */
export async function runAiTest(spec: AiTestSpec): Promise<AiTestResult> {
  const mcpClient = await createBrowserMcpClient();
  const maxTurns = spec.maxTurns ?? 25;

  try {
    const { finalText, turns, transcript } = await runAgentLoop({
      mcpClient,
      systemPrompt: buildSystemPrompt(spec),
      firstUserMessage: 'Begin the test now.',
      maxTurns,
    });

    const passed = /RESULT:\s*PASSED/i.test(finalText);
    const failed = /RESULT:\s*FAILED/i.test(finalText);

    return {
      id: spec.id,
      title: spec.title,
      status: passed ? 'PASSED' : failed ? 'FAILED' : 'ERROR',
      turns,
      transcript,
      reason: finalText.trim() || `Agent used all ${maxTurns} turns without returning a RESULT line.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { id: spec.id, title: spec.title, status: 'ERROR', turns: 0, transcript: [], reason: message };
  } finally {
    await mcpClient.close();
  }
}
