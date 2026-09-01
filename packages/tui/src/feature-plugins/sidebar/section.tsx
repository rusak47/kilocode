// kilocode_change - isolate sidebar plugin failures so unrelated sections keep rendering
import { ErrorBoundary, type ParentProps } from "solid-js"

export function skipSidebar(name: string) {
  if (process.env.KILO_DEBUG_SKIP_SIDEBAR === "1") return true
  const key = `KILO_DEBUG_SKIP_SIDEBAR_${name.replace(/[^a-z0-9]/gi, "_").toUpperCase()}`
  return process.env[key] === "1"
}

export function SidebarSection(props: ParentProps<{ name: string }>) {
  return (
    <ErrorBoundary
      fallback={(error) => {
        console.error("[TUI sidebar section error]", {
          section: props.name,
          errorName: error instanceof Error ? error.name : undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        })
        return null
      }}
    >
      {props.children}
    </ErrorBoundary>
  )
}
