import type { TuiPlugin, TuiPluginApi } from "@kilocode/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, For, Show, createSignal } from "solid-js"
import { SidebarSection, skipSidebar } from "./section"

const id = "internal:sidebar-lsp"

function View(props: { api: TuiPluginApi }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.lsp())
  const off = createMemo(() => !props.api.state.config.lsp)
  console.debug("[TUI sidebar lsp]", {
    count: list().length,
    disabled: off(),
    rows: list().map((item, index) => ({
      index,
      id: item.id,
      idType: typeof item.id,
      root: item.root,
      rootType: typeof item.root,
      status: item.status,
      statusType: typeof item.status,
    })),
  })

  return (
    <box>
      <box flexDirection="row" gap={1} onMouseDown={() => list().length > 2 && setOpen((x) => !x)}>
        <Show when={list().length > 2}>
          <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
        </Show>
        <text fg={theme().text}>
          <b>LSP</b>
        </text>
      </box>
      <Show when={list().length <= 2 || open()}>
        <Show when={list().length === 0}>
          <text fg={theme().textMuted}>{off() ? "LSPs are disabled" : "LSPs will activate as files are read"}</text>
        </Show>
        <For each={list()}>
          {(item) => (
            <box flexDirection="row" gap={1}>
              <text
                flexShrink={0}
                style={{
                  fg: item.status === "connected" ? theme().success : theme().error,
                }}
              >
                •
              </text>
              <text fg={theme().textMuted}>
                {item.id} {item.root}
              </text>
            </box>
          )}
        </For>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 300,
    slots: {
      sidebar_content() {
        if (skipSidebar("lsp")) return null
        return (
          <SidebarSection name="lsp">
            <View api={api} />
          </SidebarSection>
        )
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
