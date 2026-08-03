"use client"

import { renderHook } from "@testing-library/react"

import type {
  DownloadFileMessage,
  OpenLinkMessage,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import useParentLinks from "../../src/react/hooks/useParentLinks"

function createFakePort() {
  const posted: unknown[] = []
  const port = {
    postMessage: jest.fn((message: unknown) => posted.push(message)),
  } as unknown as MessagePort
  return { port, posted }
}

describe("useParentLinks", () => {
  it("throws until connected", () => {
    const { result } = renderHook(() => useParentLinks(null))

    expect(() => result.current.openLink("https://example.com/")).toThrow(
      "Not connected to the parent window yet",
    )
    expect(() => result.current.downloadFile({ url: "https://example.com/a" })).toThrow(
      "Not connected to the parent window yet",
    )
  })

  it("asks the parent to open a link", () => {
    const fake = createFakePort()
    const { result } = renderHook(() => useParentLinks(fake.port))

    result.current.openLink("https://example.com/docs")

    expect(fake.posted).toEqual([
      { message: "open-link", data: "https://example.com/docs" } satisfies OpenLinkMessage,
    ])
  })

  it("asks the parent to download a file", () => {
    const fake = createFakePort()
    const { result } = renderHook(() => useParentLinks(fake.port))

    result.current.downloadFile({ url: "https://files.example/a", filename: "answer.pdf" })

    expect(fake.posted).toEqual([
      {
        message: "download-file",
        url: "https://files.example/a",
        filename: "answer.pdf",
      } satisfies DownloadFileMessage,
    ])
  })

  it("refuses a URL the parent would refuse anyway", () => {
    const fake = createFakePort()
    const { result } = renderHook(() => useParentLinks(fake.port))

    expect(() => result.current.openLink("javascript:alert(1)")).toThrow()
    expect(fake.posted).toEqual([])
  })
})
