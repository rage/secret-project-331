"use client"

import "@testing-library/jest-dom"
import { render } from "@testing-library/react"
import React from "react"

import ImageBlock from "../ImageBlock"
import { ImageInteractivityContext } from "../ImageInteractivityContext"

// react-medium-image-zoom ships ESM that jest can't transform; mock it out.
jest.mock("react-medium-image-zoom", () => ({
  __esModule: true,
  // oxlint-disable-next-line react/jsx-no-useless-fragment -- a component mock must return an element, not bare ReactNode
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeProps = (attrs: any): any => ({
  id: "image-block",
  data: {
    name: "core/image",
    isValid: true,
    clientId: "image-block",
    innerBlocks: [],
    attributes: {
      url: "https://example.com/photo.jpg",
      alt: "A photo",
      caption: "A descriptive caption",
      ...attrs,
    },
  },
})

const renderBlock = (props: unknown) =>
  render(
    // Disable interactivity so we avoid the image-zoom wrapper in jsdom.
    <ImageInteractivityContext.Provider value={{ disableInteractivity: true }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ImageBlock {...(props as any)} />
    </ImageInteractivityContext.Provider>,
  )

describe("ImageBlock accessibility (issue #75)", () => {
  it("renders the figcaption as a child of the figure element", () => {
    const { container } = renderBlock(makeProps({}))

    const figure = container.querySelector("figure")
    expect(figure).not.toBeNull()

    const figcaption = container.querySelector("figcaption")
    expect(figcaption).not.toBeNull()
    // WCAG 1.3.1: the caption must be a child of the associated figure.
    expect(figcaption?.parentElement).toBe(figure)
  })

  it("does not render a figcaption when there is no caption", () => {
    const { container } = renderBlock(makeProps({ caption: "" }))
    expect(container.querySelector("figcaption")).toBeNull()
    expect(container.querySelector("figure")).not.toBeNull()
  })
})
