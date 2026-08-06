import type {
  DownloadFileMessage,
  OpenLinkMessage,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import type { LinkCapableMessagePort } from "../../src/client/parentLinks"
import {
  LinkRequestError,
  requestFileDownload,
  requestOpenLink,
} from "../../src/client/parentLinks"

function createFakePort() {
  const posted: unknown[] = []
  const port: LinkCapableMessagePort = {
    postMessage: (message: unknown) => {
      posted.push(message)
    },
  }
  return { port, posted }
}

describe("requestOpenLink", () => {
  it("posts an open-link message with the URL", () => {
    const fake = createFakePort()

    requestOpenLink(fake.port, "https://example.com/page?a=b")

    expect(fake.posted).toEqual([
      { message: "open-link", data: "https://example.com/page?a=b" } satisfies OpenLinkMessage,
    ])
  })

  it("refuses anything but an absolute http(s) URL, without posting", () => {
    const fake = createFakePort()

    expect(() => requestOpenLink(fake.port, "javascript:alert(1)")).toThrow(LinkRequestError)
    expect(() => requestOpenLink(fake.port, "data:text/html,hi")).toThrow(LinkRequestError)
    expect(() => requestOpenLink(fake.port, "/relative/path")).toThrow(LinkRequestError)
    expect(() => requestOpenLink(fake.port, "")).toThrow(LinkRequestError)
    expect(fake.posted).toEqual([])
  })
})

describe("requestFileDownload", () => {
  it("posts a download-file message with the URL and the suggested name", () => {
    const fake = createFakePort()

    requestFileDownload(fake.port, { url: "https://files.example/a", filename: "answer.pdf" })

    expect(fake.posted).toEqual([
      {
        message: "download-file",
        url: "https://files.example/a",
        filename: "answer.pdf",
      } satisfies DownloadFileMessage,
    ])
  })

  it("sends filename as null when none is suggested", () => {
    const fake = createFakePort()

    requestFileDownload(fake.port, { url: "https://files.example/a" })

    expect((fake.posted[0] as DownloadFileMessage).filename).toBeNull()
  })

  it("refuses a non-http(s) URL, without posting", () => {
    const fake = createFakePort()

    expect(() => requestFileDownload(fake.port, { url: "blob:https://example.com/x" })).toThrow(
      LinkRequestError,
    )
    expect(fake.posted).toEqual([])
  })
})
