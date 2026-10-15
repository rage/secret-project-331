import { jest } from "@jest/globals"

// jsdom's Blob does not implement arrayBuffer(), which the multipart body builder relies on.
if (typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.addEventListener("load", () => resolve(reader.result as ArrayBuffer), { once: true })
      reader.addEventListener("error", () => reject(reader.error), { once: true })
      // oxlint-disable-next-line unicorn/prefer-blob-reading-methods -- this is the method being polyfilled
      reader.readAsArrayBuffer(this)
    })
  }
}

const uploadFilesFromExerciseService = jest.fn()

const loadAdapter = async () => {
  await jest.unstable_mockModule("@/generated/api/sdk.generated", () => ({
    __esModule: true,
    uploadFilesFromExerciseService,
  }))
  return await import("../../src/utils/uploadFilesFromExerciseIframe")
}

describe("uploadFilesFromExerciseServiceEditor", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it("uploads under the exercise service's slug so the files are not bound to an answer", async () => {
    uploadFilesFromExerciseService.mockResolvedValue([
      { id: "11111111-0000-4000-8000-000000000000", url: "https://files.example/one" },
    ] as never)
    const { uploadFilesFromExerciseServiceEditor } = await loadAdapter()

    await expect(
      uploadFilesFromExerciseServiceEditor("example-exercise", [new File(["a"], "a.txt")]),
    ).resolves.toEqual([
      { id: "11111111-0000-4000-8000-000000000000", url: "https://files.example/one" },
    ])

    const call = uploadFilesFromExerciseService.mock.calls[0]?.[0] as {
      body: Record<string, File>
      path: { exercise_service_slug: string }
    }
    expect(call.path).toEqual({ exercise_service_slug: "example-exercise" })
    expect(Object.values(call.body).map((file) => file.name)).toEqual(["a.txt"])
  })

  it("rejects a result that does not name every uploaded file", async () => {
    uploadFilesFromExerciseService.mockResolvedValue([] as never)
    const { uploadFilesFromExerciseServiceEditor } = await loadAdapter()

    await expect(
      uploadFilesFromExerciseServiceEditor("example-exercise", [new File(["a"], "a.txt")]),
    ).rejects.toThrow("invalid file result")
  })
})
