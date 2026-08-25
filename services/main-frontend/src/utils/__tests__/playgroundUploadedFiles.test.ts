import {
  playgroundSubmissionFiles,
  recordPlaygroundUploads,
  type PlaygroundUploadedFiles,
} from "../playgroundUploadedFiles"

const fileOf = (name: string, mime: string, contents: string) =>
  new File([contents], name, { type: mime })

describe("recordPlaygroundUploads", () => {
  it("pairs each upload result with the file at the same index", () => {
    const recorded = recordPlaygroundUploads(
      {},
      [fileOf("a.txt", "text/plain", "aa"), fileOf("b.png", "image/png", "bbbb")],
      [
        { id: "id-a", url: "http://host/a" },
        { id: "id-b", url: "http://host/b" },
      ],
    )
    expect(recorded).toEqual({
      "id-a": {
        id: "id-a",
        name: "a.txt",
        mime: "text/plain",
        size_bytes: 2,
        download_url: "http://host/a",
      },
      "id-b": {
        id: "id-b",
        name: "b.png",
        mime: "image/png",
        size_bytes: 4,
        download_url: "http://host/b",
      },
    })
  })

  it("keeps files from earlier uploads", () => {
    const first = recordPlaygroundUploads(
      {},
      [fileOf("a.txt", "text/plain", "aa")],
      [{ id: "id-a", url: "http://host/a" }],
    )
    const second = recordPlaygroundUploads(
      first,
      [fileOf("b.txt", "text/plain", "b")],
      [{ id: "id-b", url: "http://host/b" }],
    )
    expect(Object.keys(second).toSorted()).toEqual(["id-a", "id-b"])
  })
})

describe("playgroundSubmissionFiles", () => {
  const known: PlaygroundUploadedFiles = recordPlaygroundUploads(
    {},
    [fileOf("a.txt", "text/plain", "aa"), fileOf("b.txt", "text/plain", "b")],
    [
      { id: "id-a", url: "http://host/a" },
      { id: "id-b", url: "http://host/b" },
    ],
  )

  it("returns the files in the order the answer named them", () => {
    expect(playgroundSubmissionFiles(["id-b", "id-a"], known).map((file) => file.name)).toEqual([
      "b.txt",
      "a.txt",
    ])
  })

  it("is empty for an answer with no files", () => {
    expect(playgroundSubmissionFiles(undefined, known)).toEqual([])
  })

  it("throws rather than dropping a file it has no metadata for", () => {
    expect(() => playgroundSubmissionFiles(["id-a", "id-missing"], known)).toThrow("id-missing")
  })
})
