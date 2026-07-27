import { uploadFilesFromExerciseService } from "@/generated/api/sdk.generated"

import { uploadFilesFromExerciseIframe } from "../uploadFilesFromExerciseIframe"

jest.mock("@/generated/api/sdk.generated", () => ({
  uploadFilesFromExerciseService: jest.fn(),
}))

const upload = jest.mocked(uploadFilesFromExerciseService)

describe("uploadFilesFromExerciseIframe", () => {
  beforeEach(() => {
    upload.mockReset()
    jest
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("aaaaaaaa-0000-4000-8000-000000000000")
      .mockReturnValueOnce("bbbbbbbb-0000-4000-8000-000000000000")
  })

  afterEach(() => jest.restoreAllMocks())

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

    expect(upload).toHaveBeenCalledWith({
      path: { exercise_service_slug: "file-submission" },
      body: {
        "aaaaaaaa-0000-4000-8000-000000000000": first,
        "bbbbbbbb-0000-4000-8000-000000000000": second,
      },
    })
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
