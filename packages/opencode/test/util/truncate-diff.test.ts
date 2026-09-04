// kilocode_change - new file
import { describe, it, expect } from "bun:test"
import { truncateFileList, truncatePatchBytes } from "@/util/truncate-diff"
describe("truncateFileList", () => {
  it("does not truncate under limit", () => {
    const { list, truncated } = truncateFileList([1, 2, 3], 5)
    expect(list).toEqual([1, 2, 3])
    expect(truncated).toBe(false)
  })
  it("truncates excess items", () => {
    const { list, truncated } = truncateFileList([1, 2, 3, 4], 2)
    expect(list).toEqual([1, 2])
    expect(truncated).toBe(true)
  })
})
describe("truncatePatchBytes", () => {
  it("keeps content under byte limit", () => {
    const { content, truncated } = truncatePatchBytes("hello", 10)
    expect(content).toBe("hello")
    expect(truncated).toBe(false)
  })
  it("truncates when over limit", () => {
    const { content, truncated } = truncatePatchBytes("x".repeat(200), 100)
    expect(content).toBe("")
    expect(truncated).toBe(true)
  })
})