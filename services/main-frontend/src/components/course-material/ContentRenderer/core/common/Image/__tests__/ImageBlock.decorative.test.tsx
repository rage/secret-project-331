"use client"

import "@testing-library/jest-dom"
import { render } from "@testing-library/react"
import React from "react"

import ImageBlock from "../ImageBlock"
import { ImageInteractivityContext } from "../ImageInteractivityContext"

jest.mock("react-medium-image-zoom", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="zoom">{children}</div>
  ),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeProps = (attrs: any): any => ({
  id: "image-block",
  data: {
    name: "core/image",
    isValid: true,
    clientId: "image-block",
    innerBlocks: [],
    attributes: { url: "https://example.com/photo.jpg", alt: "A photo", ...attrs },
  },
})

const renderStatic = (props: unknown) =>
  render(
    <ImageInteractivityContext.Provider value={{ disableInteractivity: true }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ImageBlock {...(props as any)} />
    </ImageInteractivityContext.Provider>,
  )

describe("ImageBlock decorative images (B-043)", () => {
  it("hides a decorative image from assistive technology and renders no figure", () => {
    const { container, queryByRole } = renderStatic(
      makeProps({ isDecorative: true, caption: "", title: "ornament" }),
    )
    const img = container.querySelector("img")
    expect(img).toHaveAttribute("alt", "")
    expect(img).toHaveAttribute("role", "presentation")
    expect(img).not.toHaveAttribute("title")
    expect(queryByRole("img")).toBeNull()
    expect(container.querySelector("figure")).toBeNull()
  })

  it("keeps the figure for a decorative image that has a caption", () => {
    const { container } = renderStatic(makeProps({ isDecorative: true, caption: "Caption" }))
    expect(container.querySelector("figure")).not.toBeNull()
  })

  it("does not wrap a decorative image in the zoom interaction", () => {
    const { queryByTestId } = render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <ImageBlock {...(makeProps({ isDecorative: true, caption: "" }) as any)} />,
    )
    expect(queryByTestId("zoom")).toBeNull()
  })
})
