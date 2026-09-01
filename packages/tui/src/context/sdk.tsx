import { createKiloClient } from "@kilocode/sdk/v2"
import type { GlobalEvent } from "@kilocode/sdk/v2"
import { Flag } from "@opencode-ai/core/flag/flag"
import { createSimpleContext } from "./helper"
import { batch, onCleanup, onMount } from "solid-js"
import { writeSync } from "node:fs"

export type EventSource = {
  subscribe: (handler: (event: GlobalEvent) => void) => Promise<() => void>
}

export const { use: useSDK, provider: SDKProvider } = createSimpleContext({
  name: "SDK",
    init: (props: {
      url: string
      directory?: string
      fetch?: typeof fetch
      headers?: RequestInit["headers"]
      events?: EventSource
    }) => {
      if (process.env.KILO_DEBUG_EVENTS) {
        writeSync(1, "[TUI SDK init] url=" + props.url + " directory=" + (props.directory ?? "undefined") + " hasEvents=" + (!!props.events) + "\n")
      }
      const abort = new AbortController()
      let sse: AbortController | undefined
      // kilocode_change - unique provider instance id so we can correlate teardown with this specific init scope
      const providerInstanceId = Math.random().toString(36).slice(2, 8)

      function createSDK() {
        if (process.env.KILO_DEBUG_EVENTS) {
          writeSync(1, "[TUI SDK createSDK] id=" + providerInstanceId + "\n")
        }
        return createKiloClient({
          baseUrl: props.url,
          signal: abort.signal,
          directory: props.directory,
          fetch: props.fetch,
          headers: props.headers,
        })
      }

    let sdk = createSDK()

    const handlers = new Set<(event: GlobalEvent) => void>()
    const emitter = {
      emit(_type: "event", event: GlobalEvent) {
        if (process.env.KILO_DEBUG_EVENTS) {
          writeSync(1, "[TUI emit] handlers=" + handlers.size + " type=" + ((event as any)?.payload?.type ?? ((event as any)?.type ?? "?")) + " aggregateID=" + ((event as any)?.aggno) + " provider=" + providerInstanceId + "\n")
        }
        for (const handler of handlers) handler(event)
      },
      on(_type: "event", handler: (event: GlobalEvent) => void) {
        handlers.add(handler)
        if (process.env.KILO_DEBUG_EVENTS) {
          writeSync(1, "[TUI handler add] provider=" + providerInstanceId + " handlers=" + handlers.size + "\n")
        }
        return () => {
          handlers.delete(handler)
          if (process.env.KILO_DEBUG_EVENTS) {
            writeSync(1, "[TUI handler remove] provider=" + providerInstanceId + " handlers=" + handlers.size + "\n")
          }
        }
      },
    }

    let queue: GlobalEvent[] = []
    let timer: Timer | undefined
    let last = 0
    const retryDelay = 1000
    const maxRetryDelay = 30000

    const flush = () => {
      if (queue.length === 0) return
      const events = queue
      queue = []
      timer = undefined
      last = Date.now()
      // Batch all event emissions so all store updates result in a single render
      batch(() => {
        for (const event of events) {
          emitter.emit("event", event)
        }
      })
      if (process.env.KILO_DEBUG_EVENTS) {
        writeSync(1, "[TUI flush] n=" + events.length + "\n")
      }
    }

    const handleEvent = (event: GlobalEvent) => {
      queue.push(event)
      const elapsed = Date.now() - last
      if (process.env.KILO_DEBUG_EVENTS) {
        writeSync(1, "[TUI hold] type=" + ((event as any)?.payload?.type ?? ((event as any)?.type ?? "?")) + " aggregateID=" + ((event as any)?.aggno) + " qlen=" + queue.length + " timer=" + (timer ? "on" : "off") + " elapsed=" + elapsed + "\n")
      }
      if (timer) return
      // If we just flushed recently (within 16ms), batch this with future events
      // Otherwise, process immediately to avoid latency
      if (elapsed < 16) {
        timer = setTimeout(flush, 16)
        return
      }
      flush()
    }

    function startSSE() {
      sse?.abort()
      const ctrl = new AbortController()
      sse = ctrl
      ;(async () => {
        let attempt = 0
        while (true) {
          if (abort.signal.aborted || ctrl.signal.aborted) break

          const events = await sdk.global.event({
            signal: ctrl.signal,
            sseMaxRetryAttempts: 0,
          })

          if (Flag.KILO_EXPERIMENTAL_WORKSPACES) {
            // Start syncing workspaces, it's important to do this after
            // we've started listening to events
            await sdk.sync.start().catch(() => {})
          }

          for await (const event of events.stream) {
            if (ctrl.signal.aborted) break
            handleEvent(event)
          }

          if (timer) clearTimeout(timer)
          if (queue.length > 0) flush()
          attempt += 1
          if (abort.signal.aborted || ctrl.signal.aborted) break

          // Exponential backoff
          const backoff = Math.min(retryDelay * 2 ** (attempt - 1), maxRetryDelay)
          await new Promise((resolve) => setTimeout(resolve, backoff))
        }
      })().catch(() => {})
    }

        onMount(async () => {
      if (process.env.KILO_DEBUG_EVENTS) {
        writeSync(1, "[TUI SDKProvider onMount] id=" + providerInstanceId + " directory=" + (props.directory ?? "undefined") + "\n")
      }
      if (props.events) {
        const unsub = await props.events.subscribe(handleEvent)
        onCleanup(() => {
          if (process.env.KILO_DEBUG_EVENTS) {
            writeSync(1, "[TUI SDKProvider cleanup events] id=" + providerInstanceId + "\n")
          }
          unsub()
        })

        if (Flag.KILO_EXPERIMENTAL_WORKSPACES) {
          // Start syncing workspaces, it's important to do this after
          // we've started listening to events
          await sdk.sync.start().catch(() => {})
        }
      } else {
        startSSE()
      }
    })

    onCleanup(() => {
      if (process.env.KILO_DEBUG_EVENTS) {
        writeSync(1, "[TUI SDK onCleanup] id=" + providerInstanceId + " handlersBeforeClear=" + handlers.size + " queue=" + queue.length + "\n")
      }
      abort.abort()
      sse?.abort()
      if (timer) clearTimeout(timer)
      if (process.env.KILO_DEBUG_EVENTS) {
        writeSync(1, "[TUI SDK clear handlers] id=" + providerInstanceId + " handlersBeforeClear=" + handlers.size + "\n")
      }
      handlers.clear()
      if (process.env.KILO_DEBUG_EVENTS) {
        writeSync(1, "[TUI SDK handlers cleared] id=" + providerInstanceId + " handlersAfterClear=" + handlers.size + "\n")
      }
    })

    return {
      get client() {
        return sdk
      },
      directory: props.directory,
      event: emitter,
      fetch: props.fetch ?? fetch,
      url: props.url,
    }
  },
})
