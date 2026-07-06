"use client"

import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"

import FileBlock from "../FileBlock"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeProps = (attrs: any): any => ({
  id: "file-block",
  data: {
    name: "core/file",
    isValid: true,
    clientId: "file-block",
    innerBlocks: [],
    attributes: {
      fileName: "syllabus.pdf",
      href: "https://example.com/syllabus.pdf",
      ...attrs,
    },
  },
})

describe("FileBlock accessibility (issue #69)", () => {
  it("renders the download control as a link with no nested button element", () => {
    render(
      <FileBlock {...makeProps({ showDownloadButton: true, downloadButtonText: "Download" })} />,
    )

    const downloadLink = screen.getByRole("link", { name: "Download" })
    expect(downloadLink.tagName).toBe("A")
    expect(downloadLink).toHaveAttribute("download", "syllabus.pdf")
    // WCAG 1.3.1: no <button> nested inside the link.
    expect(downloadLink.querySelector("button")).toBeNull()

    // No <button> anywhere in the block.
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("gives the download link an accessible name even when the button text is empty", () => {
    render(<FileBlock {...makeProps({ showDownloadButton: true, downloadButtonText: "" })} />)

    // Falls back to the translated "download {{fileName}}" label.
    const downloadLink = screen.getByRole("link", { name: "download-file" })
    expect(downloadLink).toHaveAttribute("aria-label", "download-file")
    expect(downloadLink.querySelector("button")).toBeNull()
  })
})
