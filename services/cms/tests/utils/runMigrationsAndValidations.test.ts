import { jest } from "@jest/globals"

import type { BlockInstance } from "@/utils/Gutenberg/types"

const loadRunMigrationsAndValidations = async () => {
  await jest.unstable_mockModule("@wordpress/blocks", () => ({
    __esModule: true,
    getBlockType: jest.fn(() => undefined),
  }))

  const imported = await import("../../src/utils/Gutenberg/runMigrationsAndValidations")
  return imported.default
}

describe("runMigrationsAndValidations", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it("skips recursion safely for non-enabled leaves without innerBlocks", async () => {
    const content = [
      {
        name: "core/paragraph",
        attributes: { content: "Leaf block" },
        clientId: "paragraph",
        isValid: true,
      },
    ] as unknown as BlockInstance[]
    const runMigrationsAndValidations = await loadRunMigrationsAndValidations()
    const result = runMigrationsAndValidations(content)

    expect(result).toEqual([content, 0])
  })

  it("handles enabled blocks without innerBlocks before Gutenberg normalizes them", async () => {
    const content = [
      {
        name: "moocfi/aside",
        attributes: { title: "Legacy aside" },
        clientId: "aside",
        isValid: true,
      },
    ] as unknown as BlockInstance[]
    const runMigrationsAndValidations = await loadRunMigrationsAndValidations()
    const result = runMigrationsAndValidations(content)

    expect(result).toEqual([content, 0])
  })
})
