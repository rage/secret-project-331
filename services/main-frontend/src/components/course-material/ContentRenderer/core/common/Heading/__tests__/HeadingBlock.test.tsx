"use client"

import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { headingAnchorIdPart } from "@/shared-module/common/utils/headingAnchors"

import HeadingBlock from "../HeadingBlock"

const CLIENT_ID_A = "3f2b8c1a-0000-4000-8000-000000000000"
const CLIENT_ID_B = "9a7d4e2b-0000-4000-8000-000000000000"

const renderHeading = (clientId: string, content: string, anchor?: string) =>
  render(
    <HeadingBlock
      id={clientId}
      isExam={false}
      data={{
        name: "core/heading",
        isValid: true,
        clientId,
        attributes: { content, level: 2, ...(anchor === undefined ? {} : { anchor }) },
        innerBlocks: [],
      }}
    />,
  )

const headingId = () => screen.getByRole("heading").getAttribute("id")

describe("HeadingBlock", () => {
  it("puts the client id fragment before the readable slug", () => {
    renderHeading(CLIENT_ID_A, "Getting started")
    expect(headingId()).toBe("3f2b8c1a-getting-started")
    expect(screen.getByRole("link")).toHaveAttribute("href", "#3f2b8c1a-getting-started")
  })

  it("prefers an author-set anchor over the generated one", () => {
    renderHeading(CLIENT_ID_A, "Getting started", " intro ")
    expect(headingId()).toBe("intro")
    expect(screen.getByRole("link")).toHaveAttribute("href", "#intro")
  })

  it("ignores a blank author-set anchor", () => {
    renderHeading(CLIENT_ID_A, "Getting started", "   ")
    expect(headingId()).toBe("3f2b8c1a-getting-started")
  })

  it("gives headings that share their text different anchors", () => {
    renderHeading(CLIENT_ID_A, "Summary")
    renderHeading(CLIENT_ID_B, "Summary")
    const ids = screen.getAllByRole("heading").map((heading) => heading.getAttribute("id"))
    expect(ids).toEqual(["3f2b8c1a-summary", "9a7d4e2b-summary"])
  })

  it("keeps the id fragment when the heading is reworded, so old links still resolve", () => {
    const { unmount } = renderHeading(CLIENT_ID_A, "Old title")
    const before = headingId()
    unmount()
    renderHeading(CLIENT_ID_A, "New title")
    const after = headingId()
    expect(after).not.toBe(before)
    expect(headingAnchorIdPart(after ?? "")).toBe(headingAnchorIdPart(before ?? ""))
  })

  it("keeps the anchor link out of the heading's accessible name", () => {
    renderHeading(CLIENT_ID_A, "When <em>connection</em> is opened")
    expect(screen.getByRole("heading", { name: "When connection is opened" })).toBeInTheDocument()
  })
})
