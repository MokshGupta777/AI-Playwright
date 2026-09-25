import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

export type TranscriptEntry = { role: 'assistant' | 'tool'; content: string };

/** Converts MCP tool definitions into the shape the Anthropic Messages API expects. */
export function mcpToolsToAnthropicTools(mcpTools: { name: string; description?: string; inputSchema?: unknown }[]) {
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    input_schema: (t.inputSchema as Anthropic.Tool['input_schema']) ?? { type: 'object', properties: {} },
  }));
}

function stringifyToolContent(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (c?.type === 'text' ? c.text : JSON.stringify(c)))
      .join('\n');
  }
  return typeof content === 'string' ? content : JSON.stringify(content);
}

/**
 * Runs the standard Claude <-> MCP tool-use loop until the model stops
 * calling tools (i.e. it has a final text answer) or `maxTurns` is hit.
 *
 * Every actual browser action goes through `mcpClient.callTool`, so the
 * transcript is a real record of what happened in the browser, not just
 * what the model claims happened.
 */
export async function runAgentLoop(params: {
  anthropic: Anthropic;
  mcpClient: Client;
  systemPrompt: string;
  firstUserMessage: string;
  maxTurns: number;
  maxTokens?: number;
}): Promise<{ finalText: string; turns: number; transcript: TranscriptEntry[] }> {
  const { anthropic, mcpClient, systemPrompt, firstUserMessage, maxTurns, maxTokens = 1536 } = params;

  const { tools: mcpTools } = await mcpClient.listTools();
  const tools = mcpToolsToAnthropicTools(mcpTools);

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: firstUserMessage }];
  const transcript: TranscriptEntry[] = [];

  let turns = 0;
  let finalText = '';

  while (turns < maxTurns) {
    turns++;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );

    for (const block of textBlocks) {
      if (block.text.trim()) transcript.push({ role: 'assistant', content: block.text });
    }

    if (toolUses.length === 0) {
      finalText = textBlocks.map((b) => b.text).join('\n');
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      try {
        const result = await mcpClient.callTool({ name: use.name, arguments: use.input as Record<string, unknown> });
        const content = stringifyToolContent(result.content);
        transcript.push({ role: 'tool', content: `${use.name}(${JSON.stringify(use.input)}) -> ${content.slice(0, 800)}` });
        toolResults.push({ type: 'tool_result', tool_use_id: use.id, content });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        transcript.push({ role: 'tool', content: `${use.name} -> ERROR: ${message}` });
        toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: `ERROR: ${message}`, is_error: true });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { finalText, turns, transcript };
}
