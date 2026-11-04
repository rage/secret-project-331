"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

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

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("gives the download link an accessible name even when the button text is empty", () => {
    render(<FileBlock {...makeProps({ showDownloadButton: true, downloadButtonText: "" })} />)

    const downloadLink = screen.getByRole("link", { name: "download-file" })
    expect(downloadLink).toHaveAttribute("aria-label", "download-file")
    expect(downloadLink.querySelector("button")).toBeNull()
  })

  it("renders rich-text file names as formatted text and downloads under the plain name", () => {
    const { container } = render(
      <FileBlock
        {...makeProps({
          fileName: "<strong>Tom</strong> &amp; Jerry.pdf",
          showDownloadButton: true,
          downloadButtonText: "Get <em>it</em>",
        })}
      />,
    )

    const fileLink = container.querySelector('a[href="https://example.com/syllabus.pdf"]')
    expect(fileLink).toHaveTextContent("Tom & Jerry.pdf")
    expect(fileLink?.querySelector("strong")).toHaveTextContent("Tom")
    const downloadLink = screen.getByRole("link", { name: "Get it" })
    expect(downloadLink).toHaveAttribute("download", "Tom & Jerry.pdf")
    expect(downloadLink.querySelector("em")).toHaveTextContent("it")
  })

  it("disables the download control when the file has no href, so it does not link to the current page", () => {
    render(
      <FileBlock
        {...makeProps({
          href: undefined,
          showDownloadButton: true,
          downloadButtonText: "Download",
        })}
      />,
    )

    const downloadControl = screen.getByText("Download").closest("a")
    expect(downloadControl).not.toBeNull()
    // Exposed as disabled to assistive technology.
    expect(downloadControl).toHaveAttribute("aria-disabled", "true")
    // Clicking must not trigger a navigation (default action is prevented).
    const clickNotPrevented = fireEvent.click(downloadControl as HTMLAnchorElement)
    expect(clickNotPrevented).toBe(false)
  })
})
