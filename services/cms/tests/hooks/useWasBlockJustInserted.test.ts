/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals"
import { renderHook } from "@testing-library/react"

let justInsertedClientIds: string[] = []
let selectedStore: string | null = null

await jest.unstable_mockModule("@wordpress/data", () => ({
  useSelect: (mapSelect: (select: unknown) => unknown) =>
    mapSelect((store: string) => {
      selectedStore = store
      return {
        wasBlockJustInserted: (clientId: string) => justInsertedClientIds.includes(clientId),
      }
    }),
}))

const { useWasBlockJustInserted } = await import("@/hooks/useWasBlockJustInserted")

beforeEach(() => {
  justInsertedClientIds = []
  selectedStore = null
})

describe("useWasBlockJustInserted", () => {
  it("reports false for a block that arrived with saved content", () => {
    const { result } = renderHook(() => useWasBlockJustInserted("block-1"))

    expect(result.current).toBe(false)
  })

  it("reports true for a block the editor just inserted", () => {
    justInsertedClientIds = ["block-1"]

    const { result } = renderHook(() => useWasBlockJustInserted("block-1"))

    expect(result.current).toBe(true)
  })

  it("answers for the block it was given, not for any other one", () => {
    justInsertedClientIds = ["block-2"]

    const { result } = renderHook(() => useWasBlockJustInserted("block-1"))

    expect(result.current).toBe(false)
  })

  it("asks the block editor store", () => {
    renderHook(() => useWasBlockJustInserted("block-1"))

    expect(selectedStore).toBe("core/block-editor")
  })

  it("re-reads when the block changes", () => {
    justInsertedClientIds = ["block-2"]

    const { result, rerender } = renderHook(({ clientId }) => useWasBlockJustInserted(clientId), {
      initialProps: { clientId: "block-1" },
    })
    expect(result.current).toBe(false)

    rerender({ clientId: "block-2" })

    expect(result.current).toBe(true)
  })
})
