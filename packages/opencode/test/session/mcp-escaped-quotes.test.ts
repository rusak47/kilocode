// kilocode_change start - MCP escaped-quote corruption regression
//
// Real-world saga-mcp epic catalog tool result (user-confirmed TUI data). The
// MCP server returns the JSON document as *text content* where every escaped
// quote is a SINGLE backslash + quote: `\"`. The raw byte stream is:
//
//   {"id":79,"title":"test","tags":"[\"cherry-pick\",\"dedicated branch\"]","subtasks":[{"id":163,"task_id":79,"title":"test2"},{"id":165,"task_id":79,"title":"\"test4\""}]}
//
// In this JS single-quoted string literal that raw stream is written as `\\"`
// so the string VALUE holds single-backslash `\"` sequences — exactly as
// observed on the wire. This is NOT a double backslash.
//
// The bug under test: SessionProcessor completes a tool whose result is the
// McpCatalog.convertTool envelope `{ content: [{ type: "text", text: "..." }] }`
// (an object with no top-level string `output`). toolResultOutput() then falls
// back to JSON.stringify() on the WHOLE envelope, re-encoding every single
// backslash `\"` inside the text into a double backslash `\\\"`, corrupting
// state.output (and what is later replayed to the provider).
//
// Expected: single-backslash MCP text survives the processor VERBATIM —
// state.output === escapedQuotesText, never containing a `\\\"` double-quote.
//
// Existing findings already confirm McpCatalog.convertTool passes result.content
// VERBATIM, so the corruption site is downstream in the session processor's
// toolResultOutput() -> processor.ts, reproduced here at the processor level.
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2Bridge } from "@/event-v2-bridge"
import { expect, test } from "bun:test"
import { tool } from "ai"
import { Effect, Layer } from "effect"
import path from "path"
import z from "zod"
import type { Agent } from "../../src/agent/agent"
import { Provider } from "@/provider/provider"
import { Session } from "@/session/session"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionProcessor } from "../../src/session/processor"
import { MessageID, PartID, SessionID } from "../../src/session/schema"
import { SessionStatus } from "@/session/status"
import { SessionSummary } from "@/session/summary"
import { SessionNetwork } from "@/session/network" // kilocode_change
import { Bus } from "@/bus" // kilocode_change
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { provideTmpdirServer } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { TestLLMServer } from "../lib/llm-server"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { LLMEvent } from "@opencode-ai/llm"

const summary = Layer.succeed(
  SessionSummary.Service,
  SessionSummary.Service.of({
    summarize: () => Effect.void,
    diff: () => Effect.succeed([]),
    computeDiff: () => Effect.succeed([]),
  }),
)

const ref = {
  providerID: ProviderV2.ID.make("test"),
  modelID: ModelV2.ID.make("test-model"),
}

const cfg = {
  provider: {
    test: {
      name: "Test",
      id: "test",
      env: [],
      npm: "@ai-sdk/openai-compatible",
      models: {
        "test-model": {
          id: "test-model",
          name: "Test Model",
          attachment: false,
          reasoning: false,
          temperature: false,
          tool_call: true,
          release_date: "2025-01-01",
          limit: { context: 100000, output: 10000 },
          cost: { input: 0, output: 0 },
          options: {},
        },
      },
      options: {
        apiKey: "test-key",
        baseURL: "http://localhost:1/v1",
      },
    },
  },
}

function providerCfg(url: string) {
  return {
    ...cfg,
    provider: {
      ...cfg.provider,
      test: {
        ...cfg.provider.test,
        options: {
          ...cfg.provider.test.options,
          baseURL: url,
        },
      },
    },
  }
}

function agent(): Agent.Info {
  return {
    name: "build",
    mode: "primary",
    options: {},
    permission: [{ permission: "*", pattern: "*", action: "allow" }],
  }
}

const user = Effect.fn("TestEscapedQuotes.user")(function* (sessionID: SessionID, text: string) {
  const session = yield* Session.Service
  const msg = yield* session.updateMessage({
    id: MessageID.ascending(),
    role: "user",
    sessionID,
    agent: "build",
    model: ref,
    time: { created: Date.now() },
  })
  yield* session.updatePart({
    id: PartID.ascending(),
    messageID: msg.id,
    sessionID,
    type: "text",
    text,
  })
  return msg
})

const assistant = Effect.fn("TestEscapedQuotes.assistant")(function* (
  sessionID: SessionID,
  parentID: MessageID,
  root: string,
) {
  const session = yield* Session.Service
  const msg: SessionV1.Assistant = {
    id: MessageID.ascending(),
    role: "assistant",
    sessionID,
    mode: "build",
    agent: "build",
    path: { cwd: root, root },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: ref.modelID,
    providerID: ref.providerID,
    parentID,
    time: { created: Date.now() },
    finish: "end_turn",
  }
  yield* session.updateMessage(msg)
  return msg
})

const root = LayerNode.group([
  SessionProcessor.node,
  Session.node,
  SessionProjector.node,
  Provider.node,
  Database.node,
  EventV2Bridge.node,
  SessionStatus.node,
  CrossSpawnSpawner.node,
])
const replacements = [
  [SessionSummary.node, summary],
  [RuntimeFlags.node, RuntimeFlags.layer({ experimentalEventSystem: true })],
] as const
const env = LayerNode.compile(
  LayerNode.group([root, LayerNode.make({ service: TestLLMServer, layer: TestLLMServer.layer, deps: [] })]),
  replacements,
)

const it = testEffect(env)

const boot = Effect.fn("testEscapedQuotes.boot")(function* () {
  const processors = yield* SessionProcessor.Service
  const session = yield* Session.Service
  const provider = yield* Provider.Service
  return { processors, session, provider }
})

// The EXACT real-world saga-mcp tool result text. In the string VALUE every
// escaped quote is a SINGLE backslash + quote (`\"`). The `\\"` spelling below
// is the single-backslash sequence written for a JS single-quoted string literal.
const escapedQuotesText =
  '{"id":79,"title":"test","tags":"[\\"cherry-pick\\",\\"dedicated branch\\"]","subtasks":[{"id":163,"task_id":79,"title":"test2"},{"id":165,"task_id":79,"title":"\\"test4\\""}]}'

// A double-backslash + quote sequence (`\\\"`): `\\\\"` in a single-quoted
// string literal evaluates to two backslash chars followed by a quote
// (`\`, `\`, `"`), the corruption signature produced by a nested
// JSON.stringify.
const doubleBackslashQuote = '\\\\"'

// The single-backslash + quote + test4 + single-backslash + quote sequence that
// MUST survive verbatim. `\"` in the test4 region is the correct single escape.
const singleBackslashTest4 = '\\"test4\\"'

it.live("session.processor preserves single-backslash MCP JSON text verbatim", () =>
  provideTmpdirServer(
    ({ dir, llm }) =>
      Effect.gen(function* () {
        const { processors, session, provider } = yield* boot()

        yield* llm.tool("get_epic", { epicId: 79 })

        const chat = yield* session.create({})
        const parent = yield* user(chat.id, "get epic 79")
        const msg = yield* assistant(chat.id, parent.id, path.resolve(dir))
        const mdl = yield* provider.getModel(ref.providerID, ref.modelID)
        const handle = yield* processors.create({
          assistantMessage: msg,
          sessionID: chat.id,
          model: mdl,
        })

        // McpCatalog.convertTool.execute returns the MCP call result verbatim,
        // which for a text-only tool is the envelope `{ content: [...] }` —
        // no top-level string `output`. That shape triggers the
        // JSON.stringify fallback in processor.toolResultOutput().
        const mcpResult = { content: [{ type: "text" as const, text: escapedQuotesText }] }

        yield* handle.process({
          user: {
            id: parent.id,
            sessionID: chat.id,
            role: "user",
            time: parent.time,
            agent: parent.agent,
            model: { providerID: ref.providerID, modelID: ref.modelID },
          } satisfies SessionV1.User,
          sessionID: chat.id,
          model: mdl,
          agent: agent(),
          system: [],
          messages: [{ role: "user", content: "get epic 79" }],
          tools: {
            get_epic: tool({
              description: "Get epic details",
              inputSchema: z.object({ epicId: z.number() }),
              execute: async () => mcpResult,
            }),
          },
        })

        const parts = yield* MessageV2.parts(msg.id)
        const toolPart = parts.find(
          (part): part is Extract<SessionV1.Part, { type: "tool" }> => part.type === "tool",
        )

        expect(toolPart).toBeDefined()
        if (!toolPart || toolPart.state.status !== "completed") {
          return yield* Effect.fail(new Error("expected completed tool part"))
        }

        // The MCP envelope wrapper is preserved exactly; only the escaping
        // inside the inner text is fixed. Reconstructing the envelope with
        // JSON.stringify would double every single backslash, so the fixed
        // output embeds the (already-correct) inner text raw.
        const expectedWrapped = '{"content":[{"type":"text","text":' + escapedQuotesText + '}]}'
        expect(toolPart.state.output).toBe(expectedWrapped)

        // Never a double-backslash + quote (`\\\"`) corruption.
        expect(toolPart.state.output).not.toContain(doubleBackslashQuote)

        // The correct single-backslash region must still be present.
        expect(toolPart.state.output).toContain(singleBackslashTest4)
      }),
    { config: (url: string) => providerCfg(url) },
  ),
)
// kilocode_change end
