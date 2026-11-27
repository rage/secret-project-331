import { describe, expect, it } from "vitest"

import type { PublicSpec } from "@/util/stateInterfaces"
import { comparePaths, isStudentFile, studentFilesInEditorOrder } from "@/util/studentFiles"

const SPEC: PublicSpec = {
  type: "browser",
  archive_name: "part01/ex.tar.zst",
  stub_download_url: "http://files.example/stub.tar.zst",
  student_file_paths: ["src/b.py", "src/data.txt"],
  checksum: "abc",
  main_file: "src/b.py",
}

const file = (filepath: string) => ({ filepath, contents: "" })

describe("comparePaths", () => {
  it("orders by path component, as tmc-langs walks a directory", () => {
    expect(["src.py", "src/a-b.py", "src/a/b.py"].toSorted(comparePaths)).toEqual([
      "src/a/b.py",
      "src/a-b.py",
      "src.py",
    ])
  })
})

describe("isStudentFile", () => {
  it("accepts the spec's files and python sources outside tests and tooling", () => {
    expect(isStudentFile("src/data.txt", SPEC)).toBe(true)
    expect(isStudentFile("src/added.py", SPEC)).toBe(true)
    expect(isStudentFile("__init__.py", SPEC)).toBe(true)
    expect(isStudentFile("src/test/helpers.py", SPEC)).toBe(true)
  })

  it("rejects tests, the tmc package, virtualenvs and project configuration", () => {
    for (const path of [
      ".tmcproject.yml",
      "test/test_b.py",
      "tmc/utils.py",
      ".venv/lib/x.py",
      "src/other.txt",
    ]) {
      expect(isStudentFile(path, SPEC)).toBe(false)
    }
  })

  it("reads a directory entry, as older specs listed them, as everything under it", () => {
    expect(isStudentFile("src/notes.txt", { ...SPEC, student_file_paths: ["src"] })).toBe(true)
  })
})

describe("studentFilesInEditorOrder", () => {
  it("opens a source file rather than an __init__.py when the spec names no main file", () => {
    const { main_file: _main, ...withoutMain } = SPEC
    expect(
      studentFilesInEditorOrder(
        ["src/__init__.py", "src/hello.py"].map((p) => file(p)),
        withoutMain,
      ).map((f) => f.filepath),
    ).toEqual(["src/hello.py", "src/__init__.py"])
  })

  it("drops non-student files and puts the main file first", () => {
    const files = [".tmcproject.yml", "src/a.py", "test/test_b.py", "src/b.py"].map((p) => file(p))
    expect(studentFilesInEditorOrder(files, SPEC).map((f) => f.filepath)).toEqual([
      "src/b.py",
      "src/a.py",
    ])
  })

  it("sorts by path when the spec names no main file", () => {
    const { main_file: _, ...spec } = SPEC
    expect(
      studentFilesInEditorOrder(
        ["src/b.py", "src/a.py"].map((p) => file(p)),
        spec,
      ).map((f) => f.filepath),
    ).toEqual(["src/a.py", "src/b.py"])
  })
})
