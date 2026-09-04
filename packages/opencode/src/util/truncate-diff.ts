// kilocode_change - new file
import { Buffer } from "node:buffer"
export function truncateFileList<T>(list: ReadonlyArray<T>, maxFiles: number): { list: ReadonlyArray<T>; truncated: boolean } {
  if (list.length <= maxFiles) return { list, truncated: false }
  return { list: list.slice(0, maxFiles), truncated: true }
}
export function truncatePatchBytes(content: string, maxBytes: number): { content: string; truncated: boolean } {
  if (Buffer.byteLength(content) <= maxBytes) return { content, truncated: false }
  return { content: "", truncated: true }
}