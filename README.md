# TUI Freeze Investigation

This branch, `debug/tui-freeze-investigation-202608`, preserves the diagnostic
instrumentation used to investigate a Kilo TUI freeze and
`Failed to create TextBuffer` failure when reopening an old session after fork,
reopen, or branch-switch workflows.

## Scope

This is an investigation branch, not a production fix. It records the
observations and debugging controls needed to reproduce and isolate the
failure. Runtime logs and the session database remain outside Git under
`/tmp/trash`.

## Main findings

- Headless or piped execution renders the session because the sidebar is absent.
- Skipping the entire sidebar also avoids the failure.
- Skipping only the Files sidebar block makes the broken session render and
  remain interactive.
- The failing session's persisted diff contains 8,074 entries but only 2,016
  unique paths. Most records are repeated four times.
- The persisted diff reports 588,527 additions and 107,118 deletions, which is
  not a normal working-tree change set.
- The Files sidebar attempts to create a native row for every persisted entry;
  the failing run reaches row index `8073`.
- The session directory and current TUI directory are valid in the failing
  run, so a missing worktree is not sufficient to explain the current case.
- The likely contributing factors are accumulated duplicate session diffs and
  unbounded Files sidebar rendering. The exact source of the accumulation is
  not fixed on this branch.

## Debug flags

All flags are temporary diagnostics and are enabled by setting them to `1`.

### Sidebar isolation

```text
KILO_DEBUG_SKIP_SIDEBAR=1
KILO_DEBUG_SKIP_SIDEBAR_TITLE=1
KILO_DEBUG_SKIP_SIDEBAR_CONTEXT=1
KILO_DEBUG_SKIP_SIDEBAR_FILES=1
KILO_DEBUG_SKIP_SIDEBAR_LSP=1
KILO_DEBUG_SKIP_SIDEBAR_MCP=1
KILO_DEBUG_SKIP_SIDEBAR_TODO=1
KILO_DEBUG_SKIP_SIDEBAR_USAGE=1
KILO_DEBUG_SKIP_SIDEBAR_MEMORY=1
KILO_DEBUG_SKIP_SIDEBAR_FOOTER=1
KILO_DEBUG_SKIP_SIDEBAR_PLUGIN_FOOTER=1
```

`KILO_DEBUG_SKIP_SIDEBAR_FILES=1` is the most important control: it suppresses
the Modified Files block while leaving the rest of the sidebar enabled.

### Transcript and event diagnostics

```text
KILO_DEBUG_EVENTS=1
KILO_DEBUG_TEXT_PART=1
KILO_DEBUG_MAX_PARTS=<number>
```

These trace event delivery, text-part rendering, and an optional transcript
part cap. Capping transcript parts to `1` or `25` did not prevent the native
failure, which weakened the large-history and markdown-content hypotheses.

## Instrumentation added

- Session route, mount, unmount, route-transition, and session-fetch traces.
- SDK handler registration, event queue, flush, and cleanup traces.
- Worker RPC and event-bus delivery traces.
- Sync-store update traces, including `command.list` updates.
- App-level and nested error-boundary stack traces.
- Renderer state snapshots with terminal dimensions and destruction status.
- Transcript message/part counts and bounded per-part diagnostics.
- Sidebar section boundaries and independent skip controls.
- Files sidebar state diagnostics:
  - session and current directories;
  - workspace and parent IDs;
  - raw and filtered diff counts;
  - diff item keys and bounded values;
  - filename and numeric-field types;
  - count widths, truncation widths, and rendered row metadata.
- Routed model label and other sidebar plugin diagnostics.

The instrumentation uses synchronous `writeSync(1, ...)` where reliable output
is required in captured TTY runs. Row-by-row Files logging can itself distort
timing, so those traces should not be used for performance conclusions.

## Relevant files

- `packages/tui/src/feature-plugins/sidebar/files.tsx`
- `packages/tui/src/feature-plugins/sidebar/section.tsx`
- `packages/tui/src/routes/session/sidebar.tsx`
- `packages/tui/src/routes/session/index.tsx`
- `packages/tui/src/context/sync.tsx`
- `packages/tui/src/context/sdk.tsx`
- `packages/tui/src/app.tsx`
- `packages/opencode/src/session/summary.ts`
- `packages/opencode/src/kilocode/session-portability/cumulative-diff.ts`

## Follow-up mitigation

The proposed production mitigation is tracked separately in Saga task #2:
apply a bounded render limit to the Files sidebar, using the upstream OpenCode
diff-limit approach as a reference:

```json
{
  "diff": {
    "max_files": 1000,
    "max_patch_bytes": 102400
  }
}
```

The sidebar should preserve the full stored diff for other consumers, limit
only native row creation, and display a warning such as:

```text
Showing 1,000 of 8,074 files.
```

This would reduce the crash risk but would not repair the accumulated session
diff data or establish why duplicate records were appended.
