/** @jsxImportSource @opentui/solid */ // kilocode_change - new file
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { createSlot, createSolidSlotRegistry, testRender, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { expect, test } from "bun:test"
import type { PermissionRequest } from "@kilocode/sdk/v2"
import { onCleanup, Show } from "solid-js"
import { NudgeProvider } from "../../../../opencode/src/kilocode/cli/cmd/tui/context/nudge"
import { TuiConfigProvider } from "../../../src/config"
import { ArgsProvider } from "../../../src/context/args"
import { ClipboardProvider } from "../../../src/context/clipboard"
import { DataProvider } from "../../../src/context/data"
import { EditorContextProvider } from "../../../src/context/editor"
import { EpilogueProvider } from "../../../src/context/epilogue"
import { ExitProvider } from "../../../src/context/exit"
import { KVProvider } from "../../../src/context/kv"
import { LocalProvider } from "../../../src/context/local"
import { LocationProvider } from "../../../src/context/location"
import { PermissionProvider } from "../../../src/context/permission"
import { ProjectProvider } from "../../../src/context/project"
import { PromptRefProvider, usePromptRef } from "../../../src/context/prompt"
import { RouteProvider, useRoute } from "../../../src/context/route"
import { TuiTerminalEnvironmentProvider } from "../../../src/context/runtime"
import { SDKProvider } from "../../../src/context/sdk"
import { SyncProvider, useSync } from "../../../src/context/sync"
import { ThemeProvider } from "../../../src/context/theme"
import { OpencodeKeymapProvider, registerOpencodeKeymap } from "../../../src/keymap"
import { createPluginRuntime, PluginRuntimeProvider } from "../../../src/plugin/runtime"
import { FrecencyProvider } from "../../../src/prompt/frecency"
import { PromptHistoryProvider } from "../../../src/prompt/history"
import { PromptStashProvider } from "../../../src/prompt/stash"
import { Session } from "../../../src/routes/session"
import { DialogProvider } from "../../../src/ui/dialog"
import { ToastProvider } from "../../../src/ui/toast"
import { wait } from "../../cli/cmd/tui/sync-fixture"
import { tmpdir } from "../../fixture/fixture"
import { TestTuiContexts } from "../../fixture/tui-environment"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"
import { createFetch, directory, eventSource, json } from "../../fixture/tui-sdk"

const parent = {
  id: "ses_parent",
  slug: "parent",
  projectID: "proj_test",
  directory,
  title: "Parent",
  version: "test",
  time: { created: 1, updated: 1 },
}

const child = {
  id: "ses_child",
  parentID: parent.id,
  slug: "child",
  projectID: "proj_test",
  directory,
  title: "Child",
  version: "test",
  time: { created: 2, updated: 2 },
}

const diff = ["--- a/demo.txt", "+++ b/demo.txt", "@@ -1 +1 @@", "-world", "+hello", ""].join("\n")

function request(): PermissionRequest {
  return {
    id: "perm-child-1",
    sessionID: child.id,
    permission: "edit",
    patterns: ["/workspace/demo.txt"],
    metadata: { filepath: "/workspace/demo.txt", diff },
    always: [],
  }
}

async function capture(app: Awaited<ReturnType<typeof testRender>>, text: string, timeout = 4000) {
  const start = Date.now()
  let frame = app.captureCharFrame()
  while (!frame.includes(text)) {
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for "${text}" in frame:\n${frame}`)
    await app.renderOnce()
    await Bun.sleep(10)
    frame = app.captureCharFrame()
  }
  return frame
}

async function mount(root: string, initial: "parent" | "child") {
  await Bun.write(
    `${root}/kv.json`,
    JSON.stringify({ animations_enabled: false, sidebar: "hide", vim_enabled: false }),
  )
  const sessions = [parent, child]
  const calls = createFetch((url) => {
    if (url.pathname === "/session") return json(sessions)
    if (url.pathname === `/session/${parent.id}`) return json(parent)
    if (url.pathname === `/session/${child.id}`) return json(child)
    if (url.pathname === `/session/${parent.id}/message`) return json([])
    if (url.pathname === `/session/${child.id}/message`) return json([])
    if (
      [`/session/${parent.id}/todo`, `/session/${parent.id}/diff`, `/session/${child.id}/todo`, `/session/${child.id}/diff`].includes(
        url.pathname,
      )
    )
      return json([])
    return undefined
  })
  const config = createTuiResolvedConfig()
  const refs: {
    sync?: ReturnType<typeof useSync>
    route?: ReturnType<typeof useRoute>
  } = {}

  async function syncUntil(fn: () => boolean) {
    return wait(fn)
  }

  function Ready() {
    const sync = useSync()
    refs.sync = sync
    return (
      <Show when={sync.status === "complete"}>
        <ThemeProvider mode="dark" source={{ discover: async () => ({}) }}>
          <LocalProvider>
            <PromptStashProvider>
              <DialogProvider>
                <NudgeProvider>
                  <FrecencyProvider>
                    <PromptHistoryProvider>
                      <PromptRefProvider>
                        <EditorContextProvider integration={{}}>
                          <LocationProvider>
                            <Content />
                          </LocationProvider>
                        </EditorContextProvider>
                      </PromptRefProvider>
                    </PromptHistoryProvider>
                  </FrecencyProvider>
                </NudgeProvider>
              </DialogProvider>
            </PromptStashProvider>
          </LocalProvider>
        </ThemeProvider>
      </Show>
    )
  }

  function Content() {
    refs.route = useRoute()
    const dimensions = useTerminalDimensions()
    return (
      <box width={dimensions().width} height={dimensions().height} flexDirection="column">
        <box flexGrow={1} minHeight={0} flexDirection="column">
          <Session />
        </box>
      </box>
    )
  }

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const runtime = {
      ...createPluginRuntime(),
      Slot: createSlot(createSolidSlotRegistry<Record<string, object>>(renderer, {})),
    }
    onCleanup(registerOpencodeKeymap(keymap, renderer, config))
    return (
      <TestTuiContexts directory={root} paths={{ home: root, state: root, worktree: root }}>
        <TuiTerminalEnvironmentProvider value={{ platform: process.platform }}>
          <ClipboardProvider value={{}}>
            <OpencodeKeymapProvider keymap={keymap}>
              <ArgsProvider>
                <KVProvider>
                  <ToastProvider>
                    <RouteProvider initialRoute={{ type: "session", sessionID: sessions.find((s) => s.slug === initial)!.id }}>
                      <TuiConfigProvider config={config}>
                        <PluginRuntimeProvider value={runtime}>
                          <SDKProvider
                            url="http://test"
                            directory={directory}
                            fetch={calls.fetch}
                            events={eventSource()}
                          >
                            <PermissionProvider>
                              <ProjectProvider>
                                <ExitProvider
                                  exit={() => {
                                    throw new Error("Unexpected exit")
                                  }}
                                >
                                  <EpilogueProvider set={() => {}}>
                                    <SyncProvider>
                                      <DataProvider>
                                        <Ready />
                                      </DataProvider>
                                    </SyncProvider>
                                  </EpilogueProvider>
                                </ExitProvider>
                              </ProjectProvider>
                            </PermissionProvider>
                          </SDKProvider>
                        </PluginRuntimeProvider>
                      </TuiConfigProvider>
                    </RouteProvider>
                  </ToastProvider>
                </KVProvider>
              </ArgsProvider>
            </OpencodeKeymapProvider>
          </ClipboardProvider>
        </TuiTerminalEnvironmentProvider>
      </TestTuiContexts>
    )
  }

  const app = await testRender(() => <Harness />, { width: 80, height: 30 })
  try {
    await syncUntil(() => !!refs.sync && refs.sync.status === "complete")
    await Bun.sleep(60)
    await app.flush()
    if (!refs.sync || !refs.route) throw new Error("Expected sync and route contexts")
    return {
      app,
      sync: refs.sync,
      route: refs.route,
      capture(text: string) {
        return capture(app, text)
      },
      [Symbol.dispose]() {
        app.renderer.destroy()
      },
    }
  } catch (err) {
    app.renderer.destroy()
    throw err
  }
}

test("subagent view shows its own pending permission (parentID set)", async () => {
  await using tmp = await tmpdir()
  using scene = await mount(tmp.path, "child")
  scene.sync.set("permission", child.id, [request()])
  expect(await scene.capture("Permission required")).toContain("Permission required")
})

test("root view still aggregates child permissions", async () => {
  await using tmp = await tmpdir()
  using scene = await mount(tmp.path, "parent")
  scene.sync.set("permission", child.id, [request()])
  expect(await scene.capture("Permission required")).toContain("Permission required")
})

test("subagent without a pending permission shows no permission prompt", async () => {
  await using tmp = await tmpdir()
  using scene = await mount(tmp.path, "child")
  await scene.app.flush()
  expect(scene.app.captureCharFrame()).not.toContain("Permission required")
})

test("pending permission re-renders when returning to the parent view", async () => {
  await using tmp = await tmpdir()
  using scene = await mount(tmp.path, "child")
  scene.sync.set("permission", child.id, [request()])
  expect(await scene.capture("Permission required")).toContain("Permission required")
  scene.route.navigate({ type: "session", sessionID: parent.id })
  expect(await scene.capture("Permission required")).toContain("Permission required")
})