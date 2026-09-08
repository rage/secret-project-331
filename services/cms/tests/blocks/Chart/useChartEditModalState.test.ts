/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals"
import { act, renderHook } from "@testing-library/react"

const CLIENT_ID = "block-1"

let justInsertedClientIds: string[] = []

await jest.unstable_mockModule("@wordpress/data", () => ({
  useSelect: (mapSelect: (select: unknown) => unknown) =>
    mapSelect(() => ({
      wasBlockJustInserted: (clientId: string) => justInsertedClientIds.includes(clientId),
    })),
}))

const { useChartEditModalState } = await import("@/blocks/Chart/useChartEditModalState")

beforeEach(() => {
  justInsertedClientIds = []
})

describe("useChartEditModalState", () => {
  it("stays closed for a block loaded from saved content", () => {
    const { result } = renderHook(() => useChartEditModalState({ clientId: CLIENT_ID, spec: "" }))

    expect(result.current.isModalOpen).toBe(false)
  })

  it("opens by itself for a block that was just inserted empty", () => {
    justInsertedClientIds = [CLIENT_ID]

    const { result } = renderHook(() => useChartEditModalState({ clientId: CLIENT_ID, spec: "" }))

    expect(result.current.isModalOpen).toBe(true)
  })

  it("treats a blank spec as empty", () => {
    justInsertedClientIds = [CLIENT_ID]

    const { result } = renderHook(() =>
      useChartEditModalState({ clientId: CLIENT_ID, spec: "  \n" }),
    )

    expect(result.current.isModalOpen).toBe(true)
  })

  it("does not open for a just-inserted block that already has a chart, as a paste does", () => {
    justInsertedClientIds = [CLIENT_ID]

    const { result } = renderHook(() =>
      useChartEditModalState({ clientId: CLIENT_ID, spec: JSON.stringify({ mark: "bar" }) }),
    )

    expect(result.current.isModalOpen).toBe(false)
  })

  it("does not reopen after the teacher closed it", () => {
    justInsertedClientIds = [CLIENT_ID]
    const { result, rerender } = renderHook(() =>
      useChartEditModalState({ clientId: CLIENT_ID, spec: "" }),
    )

    act(() => result.current.closeModal())
    expect(result.current.isModalOpen).toBe(false)

    // The spec is still empty and the block is still "just inserted" as far as the store knows.
    rerender()

    expect(result.current.isModalOpen).toBe(false)
  })

  it("opens and closes on request", () => {
    const { result } = renderHook(() => useChartEditModalState({ clientId: CLIENT_ID, spec: "" }))

    act(() => result.current.openModal())
    expect(result.current.isModalOpen).toBe(true)

    act(() => result.current.closeModal())
    expect(result.current.isModalOpen).toBe(false)
  })
})
