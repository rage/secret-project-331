import { v4 } from "uuid"

import { uploadFilesFromExerciseService } from "@/generated/api/sdk.generated"

import { uploadFilesFromExerciseIframe } from "../uploadFilesFromExerciseIframe"

jest.mock("@/generated/api/sdk.generated", () => ({
  uploadFilesFromExerciseService: jest.fn(),
}))

// Mock `uuid` (not `crypto.randomUUID`): the host is served over plain HTTP from a custom hostname,
// an insecure context where `crypto.randomUUID` is undefined, so the code deliberately does not use
// it. Mocking `crypto.randomUUID` here would both require it to exist and mask that it must not be
// depended on.
jest.mock("uuid", () => ({ v4: jest.fn() }))

const upload = jest.mocked(uploadFilesFromExerciseService)
// `v4` is overloaded (it can also return a Uint8Array); pin the mock to the no-arg string form the
// adapter uses so `mockReturnValueOnce` accepts string ids.
const uuid = jest.mocked(v4 as () => string)

describe("uploadFilesFromExerciseIframe", () => {
  beforeEach(() => {
    upload.mockReset()
    uuid.mockReset()
    uuid
      .mockReturnValueOnce("aaaaaaaa-0000-4000-8000-000000000000")
      .mockReturnValueOnce("bbbbbbbb-0000-4000-8000-000000000000")
  })

  afterEach(() => jest.restoreAllMocks())

  it("does not depend on crypto.randomUUID, which is absent in the host's insecure context", async () => {
    // Reproduce the insecure-context runtime: `crypto` exists but `crypto.randomUUID` does not.
    const originalRandomUUID = globalThis.crypto.randomUUID
    // @ts-expect-error deliberately removing the secure-context-only API for this test
    delete globalThis.crypto.randomUUID
    try {
      upload.mockResolvedValue([
        { id: "aaaaaaaa-0000-4000-8000-000000000000", url: "https://files.example/one" },
      ])

      await expect(
        uploadFilesFromExerciseIframe("file-submission", [new File(["a"], "a.txt")]),
      ).resolves.toEqual([
        { id: "aaaaaaaa-0000-4000-8000-000000000000", url: "https://files.example/one" },
      ])
    } finally {
      globalThis.crypto.randomUUID = originalRandomUUID
    }
  })

  it("assigns UUID multipart names and retains ordered host results for duplicate filenames", async () => {
    const first = new File(["first"], "same.txt", { type: "text/plain" })
    const second = new File(["second"], "same.txt", { type: "text/plain" })
    upload.mockResolvedValue([
      { id: "aaaaaaaa-0000-4000-8000-000000000000", url: "https://files.example/one" },
      { id: "bbbbbbbb-0000-4000-8000-000000000000", url: "https://files.example/two" },
    ])

    await expect(
      uploadFilesFromExerciseIframe("file-submission", [first, second]),
    ).resolves.toEqual([
      { id: "aaaaaaaa-0000-4000-8000-000000000000", url: "https://files.example/one" },
      { id: "bbbbbbbb-0000-4000-8000-000000000000", url: "https://files.example/two" },
    ])

    const options = upload.mock.calls[0]?.[0]
    expect(options?.path).toEqual({ exercise_service_slug: "file-submission" })
    const body = options?.body as Record<string, File>
    // The adapter re-materializes each file into a fresh in-memory File (so the upload is a buffered
    // request, not a stream — see the adapter comment), so assert on the UUID field names and file
    // contents rather than on File object identity.
    expect(Object.keys(body)).toEqual([
      "aaaaaaaa-0000-4000-8000-000000000000",
      "bbbbbbbb-0000-4000-8000-000000000000",
    ])
    expect(body["aaaaaaaa-0000-4000-8000-000000000000"]).toBeInstanceOf(File)
    expect(body["aaaaaaaa-0000-4000-8000-000000000000"]?.name).toBe("same.txt")
    expect(await body["aaaaaaaa-0000-4000-8000-000000000000"]?.text()).toBe("first")
    expect(await body["bbbbbbbb-0000-4000-8000-000000000000"]?.text()).toBe("second")
  })

  it("rejects host results whose IDs do not match multipart UUID order", async () => {
    upload.mockResolvedValue([
      { id: "bbbbbbbb-0000-4000-8000-000000000000", url: "https://files.example/two" },
      { id: "aaaaaaaa-0000-4000-8000-000000000000", url: "https://files.example/one" },
    ])

    await expect(
      uploadFilesFromExerciseIframe("file-submission", [
        new File(["first"], "first.txt"),
        new File(["second"], "second.txt"),
      ]),
    ).rejects.toThrow("invalid file result")
  })

  it.each([
    [[]],
    [[{ id: "host-1" }]],
    [[{ id: "host-1", url: "https://files.example/one" }]],
    [
      [
        { id: "host-1", url: "https://files.example/one" },
        { id: "host-2", url: "https://files.example/two" },
        { id: "host-3", url: "https://files.example/three" },
      ],
    ],
  ])("rejects malformed or mis-sized upload results (%#)", async (response) => {
    upload.mockResolvedValue(response as never)

    await expect(
      uploadFilesFromExerciseIframe("file-submission", [
        new File(["a"], "a.txt"),
        new File(["b"], "b.txt"),
      ]),
    ).rejects.toThrow("invalid file result")
  })
})
