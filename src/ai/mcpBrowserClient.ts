import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * Spawns the official Playwright MCP server (@playwright/mcp) as a child
 * process over stdio and connects an MCP client to it. The returned client
 * exposes browser-automation tools (navigate, click, type, snapshot, etc.)
 * that an LLM can call directly.
 *
 * One client == one isolated browser session. Callers MUST call
 * `client.close()` when done (see `runAiTest` / `generate-ai-tests.ts`).
 */
export async function createBrowserMcpClient(): Promise<Client> {
  const headless = process.env.CI ? true : process.env.AI_HEADLESS !== 'false';

  const transport = new StdioClientTransport({
    command: 'npx',
    args: [
      '-y',
      '@playwright/mcp@latest',
      ...(headless ? ['--headless'] : []),
      '--isolated',
    ],
  });

  const client = new Client({ name: 'pw-ai-test-executor', version: '1.0.0' });
  await client.connect(transport);
  return client;
}
