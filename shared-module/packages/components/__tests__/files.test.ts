"use client"

/* eslint-disable i18next/no-literal-string */

import { formatFileName, summarizeFiles } from "../src/lib/utils/files"

describe("file utils", () => {
  test("formats blank names safely", () => {
    expect(formatFileName("  ")).toBe("Unnamed file")
  })

  test("summarizes one file", () => {
    const file = new File(["hello"], "report.pdf", { type: "application/pdf" })
    expect(summarizeFiles([file])).toBe("report.pdf")
  })

  test("summarizes multiple files", () => {
    const files = [
      new File(["a"], "alpha.txt"),
      new File(["b"], "beta.txt"),
      new File(["c"], "gamma.txt"),
      new File(["d"], "delta.txt"),
    ]

    expect(summarizeFiles(files)).toBe("alpha.txt, beta.txt +2 more")
  })
})
