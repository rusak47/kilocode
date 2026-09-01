import type { TuiPlugin, TuiPluginApi } from "@kilocode/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, For, Show, createSignal } from "solid-js"
import { writeSync } from "node:fs"
import { Locale } from "../../util/locale"
import { SidebarSection, skipSidebar } from "./section"

const id = "internal:sidebar-files"

function changeCountWidth(item: { additions: number; deletions: number }) {
  return [item.additions ? `+${item.additions}` : "", item.deletions ? `-${item.deletions}` : ""]
    .filter(Boolean)
    .join(" ").length
}

function debugFiles(label: string, value: Record<string, unknown>) {
  if (!process.env.KILO_DEBUG_EVENTS) return
  writeSync(1, `${label} ${JSON.stringify(value)}\n`)
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  // kilocode_change start - guard against rendering diffs for a session whose worktree/directory
  // context is missing or stale (fork + reopen + branch switch). Without a resolvable worktree the
  // sidebar attempts to layout file names that have no valid row, which crashes OpenTUI's
  // TextBuffer creation. Skip the block instead of trying to render an invalid diff list.
  const session = createMemo(() => props.api.state.session.get(props.session_id))
  const validContext = createMemo(() => {
    const s = session()
    if (!s) return false
    const dir = props.api.state.path?.directory
    return typeof dir === "string" && dir.length > 0
  })
  // kilocode_change end
  const raw = createMemo(() => props.api.state.session.diff(props.session_id))
  const list = createMemo(() =>
    // kilocode_change start - only render diff rows that carry a non-empty string file name;
    // a malformed/blank file path is what triggers the OpenTUI TextBuffer layout failure.
    raw().filter((item) => typeof item.file === "string" && item.file.length > 0),
    // kilocode_change end
  )
  debugFiles("[TUI sidebar files state]", {
    sessionID: props.session_id,
    session: session()
      ? {
          directory: session()!.directory,
          workspaceID: session()!.workspaceID,
          parentID: session()!.parentID,
        }
      : null,
    currentDirectory: props.api.state.path?.directory,
    validContext: validContext(),
    rawCount: raw().length,
    renderedCount: list().length,
    rawItems: raw().map((item, index) => ({
      index,
      keys: Object.keys(item),
      value: JSON.stringify(item).slice(0, 500),
    })),
    files: list().map((item, index) => ({
      index,
      file: item.file,
      fileType: typeof item.file,
      additions: item.additions,
      deletions: item.deletions,
      countWidth: changeCountWidth(item),
    })),
  })

  debugFiles("[TUI sidebar files block]", {
    sessionID: props.session_id,
    visible: validContext() && list().length > 0,
    open: open(),
    rowCount: list().length,
  })

  return (
    // kilocode_change start - skip the whole "Modified Files" block (and its OpenTUI
    // TextBuffer layout) when the session's worktree/directory context is not resolvable.
    // On fork + reopen + branch switch the stale worktree can leave `path.directory`
    // empty while the session_diff list still carries entries, which is exactly the
    // combination that produced the TextBuffer crash.
    <Show when={validContext() && list().length > 0}>
      {/* kilocode_change end */}
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => list().length > 2 && setOpen((x) => !x)}>
          <Show when={list().length > 2}>
            <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text}>
            <b>Modified Files</b>
          </text>
        </box>
        <Show when={list().length <= 2 || open()}>
          <For each={list()}>
            {(item, index) => {
              const width = Math.max(2, 36 - changeCountWidth(item))
              const name = Locale.truncateLeft(item.file, width)
              debugFiles("[TUI sidebar files row]", {
                sessionID: props.session_id,
                index: index(),
                file: item.file,
                fileLength: item.file.length,
                additions: item.additions,
                deletions: item.deletions,
                countWidth: changeCountWidth(item),
                width,
                truncated: name,
              })
              return (
                <box flexDirection="row" gap={1} justifyContent="space-between">
                  {/* kilocode_change start - defensive: item.file is filtered to a non-empty string above */}
                  <text fg={theme().textMuted} wrapMode="none">
                    {name}
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
              )
            }}
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
        if (skipSidebar("files")) return null
        return (
          <SidebarSection name="files">
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
