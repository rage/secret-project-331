import { fileMatchesType, validateFile } from "../../src/utils/files"

describe("fileMatchesType util", () => {
  const archive = new File(["data"], "archive.zip")
  const image = new File(["data"], "image.png", { type: "image/png" })

  test("doesn't allow file with empty type", () => {
    // Only most common file types have file.type set as demonstrated here.
    expect(archive.type).toBe("")
    expect(fileMatchesType(archive, [""])).toBe(false)
  })

  test("allows file when no restrictions are specified", () => {
    expect(fileMatchesType(image, [])).toBe(true)
  })

  test("doesn't allow file when mimetype doesn't match", () => {
    expect(fileMatchesType(archive, ["image"])).toBe(false)
    expect(fileMatchesType(image, ["image/jpg"])).toBe(false)
  })

  test("allows file when mimetype matches", () => {
    expect(fileMatchesType(image, ["image"])).toBe(true)
    expect(fileMatchesType(image, ["image/png"])).toBe(true)
  })

  test("doesn't allow file when extension doesn't match", () => {
    expect(fileMatchesType(archive, [".png"])).toBe(false)
  })

  test("allows file when extension matches", () => {
    expect(fileMatchesType(image, [".png"])).toBe(true)
  })

  test("works with a file that doesn't have extension", () => {
    const file = new File(["data"], "filename")
    expect(fileMatchesType(file, ["image", ".txt"])).toBe(false)
  })

  test("doesn't match file a starting with period with an extension", () => {
    const file = new File(["data"], ".txt")
    expect(fileMatchesType(file, [".txt"])).toBe(false)
  })
})

describe("validateFile util", () => {
  const image = new File(["data"], "image.png", { type: "image/png" })

  test("throws if file is empty", () => {
    const emptyFile = new File([], "empty")
    expect(() => validateFile(emptyFile, [])).toThrowError()
  })

  test("throws if file is too big", () => {
    expect(() => validateFile(image, [], 1)).toThrowError()
  })

  test("allows a valid file", () => {
    expect(() => validateFile(image, ["image/svg", "image/png"])).not.toThrow()
    expect(() => validateFile(image, ["image"])).not.toThrow()
  })

  test("thows if file is invalid", () => {
    const sha = new File(["data"], "kubectl.sha256", { type: "" })
    expect(() => validateFile(sha, ["image"])).toThrow()
  })
})
