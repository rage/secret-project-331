import {
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

describe("startFileDownload", () => {
  const clicked: { href: string; download: string; target: string; rel: string }[] = []
  let clickSpy: jest.SpyInstance

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
  })

  afterEach(() => {
    clickSpy.mockRestore()
  })

  it("clicks a download anchor that cannot navigate the host page away", () => {
    startFileDownload("https://files.example/a", "answer.pdf")

    expect(clicked).toEqual([
      {
        href: "https://files.example/a",
        download: "answer.pdf",
        target: "_blank",
        rel: "noopener noreferrer",
      },
    ])
  })

  it("leaves the name to the browser when none was suggested", () => {
    startFileDownload("https://files.example/a", null)

    expect(clicked[0]?.download).toBe("")
  })

  it("does not leave the anchor in the document", () => {
    startFileDownload("https://files.example/a", "answer.pdf")

    expect(document.querySelectorAll("a")).toHaveLength(0)
  })
})
