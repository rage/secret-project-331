import {
  MAX_BLOB_DOWNLOAD_BYTES,
  parseSafeHttpUrl,
  sanitizeDownloadFilename,
  startFileDownload,
} from "../src/parentLinkActions"

describe("parseSafeHttpUrl", () => {
  it("accepts absolute http and https URLs", () => {
    expect(parseSafeHttpUrl("https://example.com/a?b=c#d")?.href).toBe(
      "https://example.com/a?b=c#d",
    )
    expect(parseSafeHttpUrl("http://project-331.local/api/v0/files/x")?.href).toBe(
      "http://project-331.local/api/v0/files/x",
    )
  })

  it("rejects every other scheme", () => {
    expect(parseSafeHttpUrl("javascript:alert(1)")).toBeNull()
    expect(parseSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull()
    expect(parseSafeHttpUrl("blob:https://example.com/x")).toBeNull()
    expect(parseSafeHttpUrl("file:///etc/passwd")).toBeNull()
  })

  it("rejects relative URLs instead of resolving them against the host page", () => {
    expect(parseSafeHttpUrl("/manage/courses")).toBeNull()
    expect(parseSafeHttpUrl("files/x.pdf")).toBeNull()
  })

  it("rejects values that are not strings", () => {
    expect(parseSafeHttpUrl(undefined)).toBeNull()
    expect(parseSafeHttpUrl(null)).toBeNull()
    expect(parseSafeHttpUrl(42)).toBeNull()
    expect(parseSafeHttpUrl("")).toBeNull()
  })

  it("normalizes an internationalized host so the confirmation shows what the browser will visit", () => {
    expect(parseSafeHttpUrl("https://пример.рф/a")?.href).toBe("https://xn--e1afmkfd.xn--p1ai/a")
  })
})

describe("sanitizeDownloadFilename", () => {
  it("keeps an ordinary file name", () => {
    expect(sanitizeDownloadFilename("answer.pdf")).toBe("answer.pdf")
  })

  it("collapses directory components so the name cannot escape the download folder", () => {
    expect(sanitizeDownloadFilename("../../etc/passwd")).toBe(".._.._etc_passwd")
    expect(sanitizeDownloadFilename("C:\\Windows\\evil.exe")).toBe("C:_Windows_evil.exe")
  })

  it("strips control characters", () => {
    expect(sanitizeDownloadFilename("an\u0000swer\u001F.pdf")).toBe("answer.pdf")
  })

  it("returns null when nothing usable is left", () => {
    expect(sanitizeDownloadFilename("   ")).toBeNull()
    expect(sanitizeDownloadFilename("..")).toBeNull()
    expect(sanitizeDownloadFilename(null)).toBeNull()
    expect(sanitizeDownloadFilename(12)).toBeNull()
  })

  it("truncates absurdly long names", () => {
    expect(sanitizeDownloadFilename("a".repeat(500))).toHaveLength(200)
  })
})

/** A fetch Response whose body streams `bytes` in one chunk, the shape `startFileDownload` reads. */
const streamedResponse = (bytes: Uint8Array, contentType = ""): Response =>
  ({
    ok: true,
    headers: { get: (name: string) => (name === "Content-Type" ? contentType : null) },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    }),
  }) as unknown as Response

describe("startFileDownload", () => {
  const clicked: { href: string; download: string; target: string; rel: string }[] = []
  let clickSpy: jest.SpyInstance
  const originalCreateObjectUrl = URL.createObjectURL
  const originalRevokeObjectUrl = URL.revokeObjectURL

  beforeEach(() => {
    clicked.length = 0
    clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push({
          href: this.href,
          download: this.download,
          target: this.target,
          rel: this.rel,
        })
      })
    URL.createObjectURL = jest.fn(() => "blob:mock-url")
    URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    clickSpy.mockRestore()
    URL.createObjectURL = originalCreateObjectUrl
    URL.revokeObjectURL = originalRevokeObjectUrl
    jest.unstubAllGlobals()
    jest.useRealTimers()
  })

  // Every platform file URL redirects to cross-origin storage, so this is the path a real download
  // takes: `download` is honored for a blob regardless of where its bytes came from.
  describe("when the file can be fetched", () => {
    beforeEach(() => {
      jest.stubGlobal("fetch", jest.fn().mockResolvedValue(streamedResponse(new Uint8Array([1]))))
    })

    it("downloads a blob URL instead of navigating to the original, cross-origin one", async () => {
      await startFileDownload("https://files.example/a", "answer.pdf")

      expect(clicked).toEqual([
        { href: "blob:mock-url", download: "answer.pdf", target: "", rel: "" },
      ])
    })

    it("leaves the name to the browser when none was suggested", async () => {
      await startFileDownload("https://files.example/a", null)

      expect(clicked[0]?.download).toBe("")
    })

    it("frees the blob URL only once the save has had time to start", async () => {
      jest.useFakeTimers()
      await startFileDownload("https://files.example/a", "answer.pdf")

      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
      jest.runAllTimers()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
    })

    it("keeps the response's content type on the downloaded blob", async () => {
      jest.stubGlobal(
        "fetch",
        jest.fn().mockResolvedValue(streamedResponse(new Uint8Array([1]), "application/pdf")),
      )

      await startFileDownload("https://files.example/a", "answer.pdf")

      expect(URL.createObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({ type: "application/pdf" }),
      )
    })
  })

  // A network error or a storage backend that never grants this origin CORS access must not leave the
  // user with nothing: today's best-effort direct link is the floor, not a new failure mode.
  describe("when the file cannot be fetched", () => {
    beforeEach(() => {
      jest.stubGlobal("fetch", jest.fn().mockRejectedValue(new Error("network error")))
    })

    it("falls back to a direct link that cannot navigate the host page away", async () => {
      await startFileDownload("https://files.example/a", "answer.pdf")

      expect(clicked).toEqual([
        {
          href: "https://files.example/a",
          download: "answer.pdf",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      ])
    })

    it("does not leave the anchor in the document", async () => {
      await startFileDownload("https://files.example/a", "answer.pdf")

      expect(document.querySelectorAll("a")).toHaveLength(0)
    })
  })

  // A response over MAX_BLOB_DOWNLOAD_BYTES must not be buffered into memory in full before this is
  // noticed — the whole point of streaming instead of calling response.blob() outright. The mock chunk
  // below only claims to be oversized (a plain object with a `byteLength`), so the test itself never
  // allocates anywhere near that much memory either.
  describe("when the response exceeds the size limit", () => {
    it("falls back to a direct link instead of building a blob from an oversized response", async () => {
      const cancel = jest.fn().mockResolvedValue(undefined)
      const response = {
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({ done: false, value: { byteLength: MAX_BLOB_DOWNLOAD_BYTES + 1 } }),
            cancel,
          }),
        },
      } as unknown as Response
      jest.stubGlobal("fetch", jest.fn().mockResolvedValue(response))

      await startFileDownload("https://files.example/a", "answer.pdf")

      expect(cancel).toHaveBeenCalled()
      expect(URL.createObjectURL).not.toHaveBeenCalled()
      expect(clicked).toEqual([
        {
          href: "https://files.example/a",
          download: "answer.pdf",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      ])
    })
  })
})
