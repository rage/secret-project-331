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

/**
 * The DOM tag an element's component renders, or the element type itself when there is nothing to
 * call.
 *
 * Calls the component instead of mounting it: @wordpress/element resolves react 18 in this install
 * while the test tree runs react 19, so react-dom rejects the elements @wordpress/primitives builds.
 */
const renderedTag = (element: unknown): unknown => {
  if (!isValidElement(element)) {
    return element
  }

  const type: unknown = element.type
  const render =
    typeof type === "function" ? type : (type as { render?: unknown } | undefined)?.render
  if (typeof render !== "function") {
    return type
  }

  return (render(element.props, null) as { type?: unknown } | undefined)?.type
}

/** The tags and path data the icon puts on screen, or the icon itself when it is not an element. */
const iconShape = (icon: unknown) => {
  if (!isValidElement<{ children?: unknown }>(icon)) {
    return icon
  }

  const child = icon.props.children
  return {
    tag: renderedTag(icon),
    childTag: renderedTag(child),
    pathData: isValidElement<{ d?: unknown }>(child) ? child.props.d : undefined,
  }
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

    const expectedIcon = {
      tag: "svg",
      childTag: "path",
      pathData: expect.stringMatching(/^M[\d.]/),
    }
    expect(variations.map(({ variation }) => iconShape(variation.icon))).toEqual([
      expectedIcon,
      expectedIcon,
    ])
  })
})
