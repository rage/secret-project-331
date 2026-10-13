/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import type { ChartDataFile } from "@/blocks/Chart/useChartDataFile"

const MEDIA_PICKER_TEST_ID = "media-placeholder"

interface MediaPlaceholderProps {
  labels: { title: string; instructions: string }
  accept: string
  onSelect: (media: { url: string }) => void
  onError: (error: unknown) => void
}

// The real MediaPlaceholder drags in the whole WP media library; this stands in for the parts the
// section wires up to it.
await jest.unstable_mockModule("@wordpress/block-editor", () => ({
  BlockIcon: () => null,
  MediaPlaceholder: ({ labels, accept, onSelect, onError }: MediaPlaceholderProps) => (
    <div data-testid={MEDIA_PICKER_TEST_ID} data-accept={accept}>
      <p>{labels.title}</p>
      <p>{labels.instructions}</p>
      <button type="button" onClick={() => onSelect({ url: "/uploads/picked.csv" })}>
        pick
      </button>
      <button type="button" onClick={() => onError(new Error("upload failed"))}>
        fail
      </button>
    </div>
  ),
}))
await jest.unstable_mockModule("@wordpress/components", () => ({
  Placeholder: ({
    label,
    instructions,
    children,
  }: {
    label: string
    instructions: string
    children: React.ReactNode
  }) => (
    <div>
      <p>{label}</p>
      <p>{instructions}</p>
      {children}
    </div>
  ),
}))
await jest.unstable_mockModule("@/utils/useCmsTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: {}, ready: true }),
}))
// The shared Button translates its own loading state, and warns loudly without an i18next instance.
await jest.unstable_mockModule("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: {}, ready: true }),
}))

const { default: ChartDataFileSection } = await import("@/blocks/Chart/ChartDataFileSection")

const dataFile = (overrides: Partial<ChartDataFile> = {}): ChartDataFile => ({
  error: undefined,
  isExtracting: false,
  extractedDataUrl: undefined,
  isDetached: false,
  restoreConfirmed: false,
  removeButtonRef: React.createRef<HTMLButtonElement>(),
  selectFile: jest.fn<ChartDataFile["selectFile"]>(),
  reportUploadError: jest.fn<ChartDataFile["reportUploadError"]>(),
  removeFile: jest.fn<ChartDataFile["removeFile"]>(),
  reinsertFile: jest.fn<ChartDataFile["reinsertFile"]>(),
  scheduleExtraction: jest.fn<ChartDataFile["scheduleExtraction"]>(),
  ...overrides,
})

const button = (name: string) => screen.getByRole("button", { name })

describe("ChartDataFileSection", () => {
  describe("with no file attached", () => {
    it("offers the media picker, restricted to the formats Vega can read", () => {
      render(<ChartDataFileSection dataFile={dataFile()} dataFileUrl={undefined} />)

      expect(screen.getByTestId(MEDIA_PICKER_TEST_ID).dataset.accept).toBe(
        "text/csv,application/json",
      )
      expect(screen.getByText("chart-data-file-instructions")).toBeDefined()
    })

    it("passes a chosen file on", () => {
      const file = dataFile()
      render(<ChartDataFileSection dataFile={file} dataFileUrl={undefined} />)

      fireEvent.click(button("pick"))

      expect(file.selectFile).toHaveBeenCalledWith({ url: "/uploads/picked.csv" })
    })

    it("passes a failed upload on", () => {
      const file = dataFile()
      render(<ChartDataFileSection dataFile={file} dataFileUrl={undefined} />)

      fireEvent.click(button("fail"))

      expect(file.reportUploadError).toHaveBeenCalled()
    })

    it("hides the picker while inline data is being lifted out into a file", () => {
      render(
        <ChartDataFileSection
          dataFile={dataFile({ isExtracting: true })}
          dataFileUrl={undefined}
        />,
      )

      expect(screen.queryByTestId(MEDIA_PICKER_TEST_ID)).toBeNull()
      expect(screen.getByText("separating-chart-data")).toBeDefined()
    })
  })

  describe("with a file attached", () => {
    it("names the file and offers to remove it", () => {
      render(<ChartDataFileSection dataFile={dataFile()} dataFileUrl="/uploads/my data.csv" />)

      expect(screen.getByText("my data.csv")).toBeDefined()
      expect(button("remove")).toBeDefined()
      expect(screen.queryByTestId(MEDIA_PICKER_TEST_ID)).toBeNull()
    })

    it("decodes an escaped file name, and falls back to the raw one when it cannot", () => {
      const { rerender } = render(
        <ChartDataFileSection dataFile={dataFile()} dataFileUrl="/uploads/my%20data.csv" />,
      )
      expect(screen.getByText("my data.csv")).toBeDefined()

      rerender(<ChartDataFileSection dataFile={dataFile()} dataFileUrl="/uploads/100%.csv" />)
      expect(screen.getByText("100%.csv")).toBeDefined()
    })

    it("removes the file on request", () => {
      const file = dataFile()
      render(<ChartDataFileSection dataFile={file} dataFileUrl="/uploads/data.csv" />)

      fireEvent.click(button("remove"))

      expect(file.removeFile).toHaveBeenCalled()
    })

    it("gives the remove button the ref that focus falls back to", () => {
      const file = dataFile()
      render(<ChartDataFileSection dataFile={file} dataFileUrl="/uploads/data.csv" />)

      expect(file.removeButtonRef.current).toBe(button("remove"))
    })

    it("offers the file back, in a live region, once an edit has dropped it", () => {
      const file = dataFile({ isDetached: true })
      render(<ChartDataFileSection dataFile={file} dataFileUrl="/uploads/data.csv" />)

      const notice = screen.getByText("chart-data-file-missing-from-spec")
      expect(notice.closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite")

      fireEvent.click(button("chart-data-file-reinsert"))
      expect(file.reinsertFile).toHaveBeenCalled()
    })

    it("announces the restore, since nothing else about it is announceable", () => {
      render(
        <ChartDataFileSection
          dataFile={dataFile({ restoreConfirmed: true })}
          dataFileUrl="/uploads/data.csv"
        />,
      )

      const notice = screen.getByText("chart-data-file-reinserted")
      expect(notice.closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite")
      expect(screen.queryByRole("button", { name: "chart-data-file-reinsert" })).toBeNull()
    })

    it("does not offer a restore that has not been lost", () => {
      render(<ChartDataFileSection dataFile={dataFile()} dataFileUrl="/uploads/data.csv" />)

      expect(screen.queryByRole("button", { name: "chart-data-file-reinsert" })).toBeNull()
      expect(screen.queryByText("chart-data-file-missing-from-spec")).toBeNull()
    })
  })

  it("shows a failure above the controls", () => {
    render(
      <ChartDataFileSection
        dataFile={dataFile({ error: "storage is full" })}
        dataFileUrl={undefined}
      />,
    )

    expect(screen.getByText(/storage is full/)).toBeDefined()
  })

  it("links to the file inline data was lifted into, so the teacher can check it", () => {
    render(
      <ChartDataFileSection
        dataFile={dataFile({ extractedDataUrl: "/uploads/chart-data.json" })}
        dataFileUrl="/uploads/chart-data.json"
      />,
    )

    const link = screen.getByRole("link", { name: "view-data-file" })
    expect(link.getAttribute("href")).toBe("/uploads/chart-data.json")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
    expect(screen.getByText(/chart-data-extracted-warning/)).toBeDefined()
  })
})
