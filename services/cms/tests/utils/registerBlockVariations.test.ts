/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals"
import { isValidElement } from "react"

interface RegisteredVariation {
  name: string
  title: string
  icon: unknown
  attributes: { providerNameSlug: string }
}

const loadRegisterBlockVariations = async (
  registerBlockVariation: (blockName: string, variation: RegisteredVariation) => void,
) => {
  await jest.unstable_mockModule("@wordpress/blocks", () => ({ registerBlockVariation }))

  return import("../../src/utils/Gutenberg/registerBlockVariations")
}

describe("registerBlockVariations", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it("registers the extra embed providers with a usable icon", async () => {
    const registerBlockVariation =
      jest.fn<(blockName: string, variation: RegisteredVariation) => void>()
    const { registerBlockVariations } = await loadRegisterBlockVariations(registerBlockVariation)

    registerBlockVariations()

    const variations = registerBlockVariation.mock.calls.map(([blockName, variation]) => ({
      blockName,
      variation,
    }))

    expect(variations.map(({ blockName }) => blockName)).toEqual(["core/embed", "core/embed"])
    expect(variations.map(({ variation }) => variation.name)).toEqual(["mentimeter", "thinglink"])
    expect(variations.map(({ variation }) => variation.attributes.providerNameSlug)).toEqual([
      "mentimeter",
      "thinglink",
    ])
    // A broken icon import would leave this undefined rather than fail at import time.
    for (const { variation } of variations) {
      expect(isValidElement(variation.icon)).toBe(true)
    }
  })
})
