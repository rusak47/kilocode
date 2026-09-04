import type { TuiPlugin, TuiPluginApi } from "@kilocode/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, For, Show, createSignal } from "solid-js"
import { Locale } from "../../util/locale"
// kilocode_change start
import { truncateFileList } from "@/util/truncate-diff"
// kilocode_change end

const id = "internal:sidebar-files"

function changeCountWidth(item: { additions: number; deletions: number }) {
  return [item.additions ? `+${item.additions}` : "", item.deletions ? `-${item.deletions}` : ""]
    .filter(Boolean)
    .join(" ").length
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const raw = createMemo(() => props.api.state.session.diff(props.session_id))
  // kilocode_change start - cap rendered rows based on diff.max_files config
  const maxFiles = () => props.api.state.config?.diff?.max_files ?? 1000
  const truncated = createMemo(() => raw().length > maxFiles())
   const list = createMemo(() => (truncated() ? truncateFileList(raw(), maxFiles()).list : raw()))
  // kilocode_change end

  return (
    <Show when={list().length > 0}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => list().length > 2 && setOpen((x) => !x)}>
          <Show when={list().length > 2}>
            <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text}>
            <b>Modified Files</b>
          </text>
        </box>
        {/* kilocode_change start - show truncation warning when file limit exceeded */}
        <Show when={truncated() && (list().length <= 2 || open())}>
          <text fg={theme().textMuted}>{`Showing ${list().length} of ${raw().length} files.`}</text>
        </Show>
        {/* kilocode_change end */}
        <Show when={list().length <= 2 || open()}>
          <For each={list()}>
            {(item) => (
              <box flexDirection="row" gap={1} justifyContent="space-between">
                {/* kilocode_change start - truncated badge */}
                <text fg={theme().textMuted} wrapMode="none">
                  {Locale.truncateLeft(
                    item.file + (item.truncated ? " (trunc)" : ""),
                    Math.max(2, 36 - changeCountWidth(item)),
                  )}
                </text>
                {/* kilocode_change end */}
                <box flexDirection="row" gap={1} flexShrink={0}>
                  <Show when={item.additions}>
                    <text fg={theme().diffAdded}>+{item.additions}</text>
                  </Show>
                  <Show when={item.deletions}>
                    <text fg={theme().diffRemoved}>-{item.deletions}</text>
                  </Show>
                </box>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 500,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
