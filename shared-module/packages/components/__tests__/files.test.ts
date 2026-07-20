import { formatFileName, summarizeFiles } from "../src/lib/utils/files"

const labels = {
  empty: "No file selected",
  unnamedFile: "Unnamed file",
  formatMoreFiles: (n: number) => `+${n} more`,
}

describe("file utils", () => {
  test("formats blank names as empty", () => {
    expect(formatFileName("  ")).toBe("")
  })

  test("summarizes empty and null file lists", () => {
    expect(summarizeFiles([], labels)).toBe("No file selected")
    expect(summarizeFiles(null, labels)).toBe("No file selected")
  })

  test("summarizes one file", () => {
    const file = new File(["hello"], "report.pdf", { type: "application/pdf" })
    expect(summarizeFiles([file], labels)).toBe("report.pdf")
  })

  test("summarizes three files", () => {
    const files = [
      new File(["a"], "alpha.txt"),
      new File(["b"], "beta.txt"),
      new File(["c"], "gamma.txt"),
    ]

    expect(summarizeFiles(files, labels)).toBe("alpha.txt, beta.txt, gamma.txt")
  })

  test("summarizes multiple files", () => {
    const files = [
      new File(["a"], "alpha.txt"),
      new File(["b"], "beta.txt"),
      new File(["c"], "gamma.txt"),
      new File(["d"], "delta.txt"),
    ]

    expect(summarizeFiles(files, labels)).toBe("alpha.txt, beta.txt +2 more")
  })
})
