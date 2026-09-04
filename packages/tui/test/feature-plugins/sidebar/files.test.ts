// kilocode_change - new file
import { describe, expect, it, test } from "bun:test"

import { truncateFileList, truncatePatchBytes } from "@/util/truncate-diff"
import { DiffFull } from "@/kilocode/snapshot/diff-full"

describe("truncate-diff utility", () => {
  it("truncates file list when exceeding limit", () => {
    const input = Array.from({ length: 1500 }, (_, i) => ({ file: `file${i}` }))
    const result = truncateFileList(input, 1000)
    expect(result.list.length).toBe(1000)
    expect(result.truncated).toBe(true)
  })

  it("keeps file list under limit", () => {
    const input = Array.from({ length: 500 }, (_, i) => ({ file: `file${i}` }))
    const result = truncateFileList(input, 1000)
    expect(result.list.length).toBe(500)
    expect(result.truncated).toBe(false)
  })

  it("truncates patch bytes when exceeding MAX_PATCH_BYTES", () => {
    const content = "x".repeat(DiffFull.MAX_PATCH_BYTES * 2)
    const result = truncatePatchBytes(content, DiffFull.MAX_PATCH_BYTES)
    expect(result.content).toBe("")
    expect(result.truncated).toBe(true)
  })

  it("keeps patch bytes under limit", () => {
    const content = "hello world"
    const result = truncatePatchBytes(content, 102_400)
    expect(result.content).toBe(content)
    expect(result.truncated).toBe(false)
  })
})

describe("sidebar files truncation math", () => {
  function changeCountWidth(additions?: number, deletions?: number) {
    return [additions ? `+${additions}` : "", deletions ? `-${deletions}` : ""]
      .filter(Boolean)
      .join(" ").length
  }

  it("cap width accounts for change counts", () => {
    expect(Math.max(2, 36 - changeCountWidth(10, 5))).toBe(30)
  })

  it("truncateFileList caps list and flags truncation", () => {
    const input = Array.from({ length: 2500 }, (_, i) => ({ file: `file${i}` }))
    const { list, truncated } = truncateFileList(input, 1000)
    expect(list.length).toBe(1000)
    expect(truncated).toBe(true)
  })

  it("empty diff list is not truncated", () => {
    const { list, truncated } = truncateFileList([], 1000)
    expect(list.length).toBe(0)
    expect(truncated).toBe(false)
  })

})
