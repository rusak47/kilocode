import type { TuiPlugin, TuiPluginApi } from "@kilocode/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, For, Show, createSignal } from "solid-js"
import { TodoItem } from "../../component/todo-item"
import { SidebarSection, skipSidebar } from "./section"

const id = "internal:sidebar-todo"

function View(props: { api: TuiPluginApi; session_id: string }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.session.todo(props.session_id))
  const show = createMemo(() => list().length > 0 && list().some((item) => item.status !== "completed"))
  const rows = createMemo(() =>
    list().map((item, index) => ({
      index,
      status: item.status,
      statusType: typeof item.status,
      content: item.content,
      contentType: typeof item.content,
      contentLength: typeof item.content === "string" ? item.content.length : null,
    })),
  )
  console.debug("[TUI sidebar todo]", {
    sessionID: props.session_id,
    count: list().length,
    show: show(),
    rows: rows(),
  })

  return (
    <Show when={show()}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => list().length > 2 && setOpen((x) => !x)}>
          <Show when={list().length > 2}>
            <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text}>
            <b>Todo</b>
          </text>
        </box>
        <Show when={list().length <= 2 || open()}>
          <For each={list()}>
            {(item, index) => {
              console.debug("[TUI sidebar todo row]", {
                sessionID: props.session_id,
                index: index(),
                status: item.status,
                statusType: typeof item.status,
                content: item.content,
                contentType: typeof item.content,
                contentLength: typeof item.content === "string" ? item.content.length : null,
              })
              return <TodoItem status={item.status} content={item.content} />
            }}
          </For>
        </Show>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 400,
    slots: {
      sidebar_content(_ctx, props) {
        if (skipSidebar("todo")) return null
        return (
          <SidebarSection name="todo">
            <View api={api} session_id={props.session_id} />
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
