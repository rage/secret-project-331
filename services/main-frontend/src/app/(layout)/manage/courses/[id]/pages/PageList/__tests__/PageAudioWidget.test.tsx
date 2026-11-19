"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import PageAudioWidget from "../PageAudioWidget"

const mockCreatePageAudioFile = jest.fn().mockResolvedValue({})

jest.mock("@/generated/api/sdk.generated", () => ({
  createPageAudioFile: (...args: unknown[]) => mockCreatePageAudioFile(...args),
}))

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getPageAudioFilesOptions: () => ({
    queryKey: ["page-audio-files"],
    queryFn: () => Promise.resolve([]),
  }),
  deletePageAudioFileMutation: () => ({ mutationFn: jest.fn() }),
}))

function changeFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", { configurable: true, value: files })
  fireEvent.change(input)
}

function renderWidget() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PageAudioWidget id="page-1" open onClose={jest.fn()} />
    </QueryClientProvider>,
  )
}

describe("PageAudioWidget", () => {
  it("uploads the file chosen through the labelled file field", async () => {
    renderWidget()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const audioFile = new File(["sound"], "clip.mp3", { type: "audio/mpeg" })
    changeFiles(fileInput, [audioFile])

    fireEvent.click(screen.getByRole("button", { name: "upload" }))

    await waitFor(() => expect(mockCreatePageAudioFile).toHaveBeenCalledTimes(1))
    expect(mockCreatePageAudioFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: { page_id: "page-1" } }),
    )
  })
})
