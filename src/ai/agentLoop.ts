import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export type TranscriptEntry = { role: 'assistant' | 'tool'; content: string };

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenerativeAI(apiKey);
}

/** Maps a JSON-Schema type string (as MCP tools describe their inputs) to Gemini's SchemaType enum. */
function mapSchemaType(t: unknown): SchemaType {
  switch (String(t).toLowerCase()) {
    case 'string':
      return SchemaType.STRING;
    case 'number':
      return SchemaType.NUMBER;
    case 'integer':
      return SchemaType.INTEGER;
    case 'boolean':
      return SchemaType.BOOLEAN;
    case 'array':
      return SchemaType.ARRAY;
    case 'object':
    default:
      return SchemaType.OBJECT;
  }
}

/**
 * Gemini's function-declaration schema only understands a subset of JSON
 * Schema (no `$schema`, `additionalProperties`, etc), and wants its own
 * SchemaType enum values instead of raw strings — so MCP tool schemas need
 * translating rather than passing through as-is.
 */
function sanitizeSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return { type: SchemaType.OBJECT, properties: {} };
  }

  const out: any = { type: mapSchemaType(schema.type) };
  if (schema.description) out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;

  if (out.type === SchemaType.OBJECT) {
    const props = schema.properties ?? {};
    out.properties = Object.fromEntries(
      Object.keys(props).map((key) => [key, sanitizeSchema(props[key])]),
    );
    if (Array.isArray(schema.required) && schema.required.length > 0) {
      out.required = schema.required;
    }
  }

  if (out.type === SchemaType.ARRAY) {
    out.items = sanitizeSchema(schema.items ?? { type: 'string' });
  }

  return out;
}

function mcpToolsToGeminiFunctionDeclarations(
  mcpTools: { name: string; description?: string; inputSchema?: unknown }[],
) {
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    parameters: sanitizeSchema(t.inputSchema ?? { type: 'object', properties: {} }),
  }));
}

function stringifyToolContent(content: unknown): string {
  if (Array.isArray(content)) {
    return content.map((c: any) => (c?.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
  }
  return typeof content === 'string' ? content : JSON.stringify(content);
}

/**
 * Runs the Gemini <-> MCP function-calling loop until the model responds
 * with plain text (no function calls) or `maxTurns` is hit. Every browser
 * action goes through `mcpClient.callTool`, so the transcript reflects what
 * actually happened in the browser, not just what the model claims.
 */
export async function runAgentLoop(params: {
  mcpClient: Client;
  systemPrompt: string;
  firstUserMessage: string;
  maxTurns: number;
}): Promise<{ finalText: string; turns: number; transcript: TranscriptEntry[] }> {
  const { mcpClient, systemPrompt, firstUserMessage, maxTurns } = params;

  const { tools: mcpTools } = await mcpClient.listTools();
  const functionDeclarations = mcpToolsToGeminiFunctionDeclarations(mcpTools);

  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations }],
  });

  const chat = model.startChat();
  const transcript: TranscriptEntry[] = [];

  let turns = 0;
  let finalText = '';
  let nextMessage: string | Array<{ functionResponse: { name: string; response: Record<string, unknown> } }> =
    firstUserMessage;

  while (turns < maxTurns) {
    turns++;

    const result = await chat.sendMessage(nextMessage as any);
    const response = result.response;
    const text = response.text();
    if (text && text.trim()) transcript.push({ role: 'assistant', content: text });

    const functionCalls = response.functionCalls() ?? [];
    if (functionCalls.length === 0) {
      finalText = text;
      break;
    }

    const functionResponseParts: Array<{ functionResponse: { name: string; response: Record<string, unknown> } }> = [];
    for (const call of functionCalls) {
      try {
        const toolResult = await mcpClient.callTool({
          name: call.name,
          arguments: (call.args ?? {}) as Record<string, unknown>,
        });
        const content = stringifyToolContent(toolResult.content);
        transcript.push({
          role: 'tool',
          content: `${call.name}(${JSON.stringify(call.args)}) -> ${content.slice(0, 800)}`,
        });
        functionResponseParts.push({ functionResponse: { name: call.name, response: { result: content } } });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        transcript.push({ role: 'tool', content: `${call.name} -> ERROR: ${message}` });
        functionResponseParts.push({ functionResponse: { name: call.name, response: { error: message } } });
      }
    }
    nextMessage = functionResponseParts;
  }

  return { finalText, turns, transcript };
}
