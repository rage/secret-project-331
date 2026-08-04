import {
  isFileUploadMessage,
  isMessageFromIframe,
  isMessageToIframe,
  isUploadResultMessage,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"

describe("file upload protocol guards", () => {
  const file = new File(["contents"], "duplicate-name.txt", { type: "text/plain" })

  it("accepts only correlated File arrays from iframe clients", () => {
    const request = {
      message: "file-upload",
      requestId: "request-1",
      files: [file, new File(["other"], "duplicate-name.txt")],
    }

    expect(isFileUploadMessage(request)).toBe(true)
    expect(isMessageFromIframe(request)).toBe(true)
    expect(isFileUploadMessage({ ...request, requestId: undefined })).toBe(false)
    expect(isFileUploadMessage({ ...request, files: new Map([[file.name, file]]) })).toBe(false)
    expect(isFileUploadMessage({ ...request, files: [file, new Blob(["not a File"])] })).toBe(false)
  })

  it("requires ordered host id and URL entries on successful replies", () => {
    const success = {
      message: "upload-result",
      requestId: "request-1",
      success: true,
      files: [
        { id: "host-file-1", url: "https://files.example/one" },
        { id: "host-file-2", url: "https://files.example/two" },
      ],
    }
    const failure = {
      message: "upload-result",
      requestId: "request-2",
      success: false,
      error: "quota exceeded",
    }

    expect(isUploadResultMessage(success)).toBe(true)
    expect(isMessageToIframe(success)).toBe(true)
    expect(isUploadResultMessage(failure)).toBe(true)
    expect(isMessageToIframe(failure)).toBe(true)
    expect(isUploadResultMessage({ ...success, files: [{ id: "host-file-1" }] })).toBe(false)
    expect(isUploadResultMessage({ ...success, requestId: null })).toBe(false)
    expect(isUploadResultMessage({ ...failure, error: null })).toBe(false)
  })
})
