import { useProject } from "../../context/project"
import { useSync } from "../../context/sync"
import { createMemo, Show } from "solid-js"
import { useTheme } from "../../context/theme"
import { useTuiConfig } from "../../config"
import { InstallationChannel, InstallationVersion } from "@opencode-ai/core/installation/version"
import { usePluginRuntime } from "../../plugin/runtime"

import { getScrollAcceleration } from "../../util/scroll"
import { WorkspaceLabel } from "../../component/workspace-label"
import { skipSidebar } from "../../feature-plugins/sidebar/section"

export function Sidebar(props: { sessionID: string; overlay?: boolean }) {
  const pluginRuntime = usePluginRuntime()
  const project = useProject()
  const sync = useSync()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const session = createMemo(() => sync.session.get(props.sessionID))
  const workspace = () => {
    const workspaceID = session()?.workspaceID
    if (!workspaceID) return
    return project.workspace.get(workspaceID)
  }
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))
  console.debug("[TUI sidebar state]", {
    sessionID: props.sessionID,
    session: session()
      ? {
          directory: session()!.directory,
          workspaceID: session()!.workspaceID,
          title: session()!.title,
        }
      : null,
    path: sync.path,
    diffCount: sync.data.session_diff[props.sessionID]?.length ?? 0,
    todoCount: sync.data.todo[props.sessionID]?.length ?? 0,
    messageCount: sync.data.message[props.sessionID]?.length ?? 0,
    mcpCount: sync.data.mcp.length,
    lspCount: sync.data.lsp.length,
  })

  return (
    <Show when={session()}>
      <box
        backgroundColor={theme.backgroundPanel}
        width={42}
        height="100%"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        position={props.overlay ? "absolute" : "relative"}
      >
        <scrollbox
          flexGrow={1}
          scrollAcceleration={scrollAcceleration()}
          verticalScrollbarOptions={{
            trackOptions: {
              backgroundColor: theme.background,
              foregroundColor: theme.borderActive,
            },
          }}
        >
          <box flexShrink={0} gap={1} paddingRight={1}>
            <Show when={!skipSidebar("title")}>
              <pluginRuntime.Slot
                name="sidebar_title"
                mode="single_winner"
                session_id={props.sessionID}
                title={session()!.title}
                share_url={session()!.share?.url}
              >
                <box paddingRight={1}>
                  <text fg={theme.text}>
                    <b>{session()!.title}</b>
                  </text>
                  <Show when={InstallationChannel !== "latest"}>
                    <text fg={theme.textMuted}>{props.sessionID}</text>
                  </Show>
                  <Show when={session()!.workspaceID}>
                    <text fg={theme.textMuted}>
                      <Show
                        when={workspace()}
                        fallback={<WorkspaceLabel type="unknown" name={session()!.workspaceID!} status="error" icon />}
                      >
                        {(item) => (
                          <WorkspaceLabel
                            type={item().type}
                            name={item().name}
                            status={project.workspace.status(item().id) ?? "error"}
                            icon
                          />
                        )}
                      </Show>
                    </text>
                  </Show>
                  <Show when={session()!.share?.url}>
                    <text fg={theme.textMuted}>{session()!.share!.url}</text>
                  </Show>
                </box>
              </pluginRuntime.Slot>
            </Show>
            <pluginRuntime.Slot name="sidebar_content" session_id={props.sessionID} />
          </box>
        </scrollbox>

        <Show when={!skipSidebar("footer")}>
          <box flexShrink={0} gap={1} paddingTop={1}>
            <pluginRuntime.Slot name="sidebar_footer" mode="single_winner" session_id={props.sessionID}>
            {/* kilocode_change start */}
            <text fg={theme.textMuted}>
              <span style={{ fg: theme.success }}>•</span> <b>Kilo</b> <span>{InstallationVersion}</span>
            </text>
            {/* kilocode_change end */}
            </pluginRuntime.Slot>
          </box>
        </Show>
      </box>
    </Show>
  )
}
