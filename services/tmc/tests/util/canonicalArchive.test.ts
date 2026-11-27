// @vitest-environment node
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { Zstd } from "@hpcc-js/wasm-zstd"
import { describe, expect, it } from "vitest"

import { packAnswerArchive, tarStudentFiles } from "@/util/canonicalArchive"

const FIXTURE_DIR = path.join(import.meta.dirname, "canonical-archive")
const EXERCISE_NAME = "python_exercise"
const EXERCISE_DIR = path.join(FIXTURE_DIR, EXERCISE_NAME)
/**
 * `tmc-langs compress-project --compression tar --deterministic` of the fixture exercise (0.43.1;
 * 0.42.0 writes the same bytes). Covers path order, a GNU long name and a non-UTF-8 file.
 */
const GOLDEN_TAR = path.join(FIXTURE_DIR, `${EXERCISE_NAME}.tar`)
/** What langs' `get-exercise-packaging-configuration` lists for the fixture, in its order. */
const STUDENT_FILES = [
  "src/a-b.py",
  "src/a/b.py",
  "__init__.py",
  "src/data.bin",
  "src/main.py",
  "src/a_directory_name_long_enough_that_with_the_prefix_the_path_exceeds_one_hundred_bytes/module.py",
]

const studentEntries = () =>
  STUDENT_FILES.map((p) => ({
    path: p,
    contents: new Uint8Array(readFileSync(path.join(EXERCISE_DIR, p))),
  }))

/** The langs binary `bin/tmc-langs-setup` installs, when this checkout has one. */
function installedLangsCli(): string | null {
  const binDir = path.join(import.meta.dirname, "..", "..", "bin")
  try {
    const cli = readdirSync(binDir).find(
      (name) => name.startsWith("tmc-langs-cli-") && !name.endsWith(".sha256"),
    )
    return cli === undefined ? null : path.join(binDir, cli)
  } catch {
    return null
  }
}

describe("tarStudentFiles", () => {
  it("writes the bytes tmc-langs writes for a deterministic student-file archive", () => {
    const ours = tarStudentFiles(EXERCISE_NAME, studentEntries())
    expect(Buffer.from(ours).equals(readFileSync(GOLDEN_TAR))).toBe(true)
  })

  it.skipIf(installedLangsCli() === null)("matches the installed tmc-langs", () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "canonical-archive-"))
    try {
      const output = path.join(outDir, "langs.tar")
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the test is skipped without one
      execFileSync(installedLangsCli()!, [
        "compress-project",
        "--exercise-path",
        EXERCISE_DIR,
        "--output-path",
        output,
        "--compression",
        "tar",
        "--deterministic",
      ])
      const ours = tarStudentFiles(EXERCISE_NAME, studentEntries())
      expect(Buffer.from(ours).equals(readFileSync(output))).toBe(true)
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
  })
})

describe("packAnswerArchive", () => {
  it("compresses the canonical tar into a zstd frame named like a VS Code upload", async () => {
    const file = await packAnswerArchive("ex", [
      { filepath: "src/main.py", contents: "print(1)\n" },
    ])
    expect(file.name).toBe("submission.tar.zst")
    expect(file.type).toBe("application/x-zstd-compressed-tar")
    const zstd = await Zstd.load()
    const tar = zstd.decompress(new Uint8Array(await file.arrayBuffer()))
    expect(Buffer.from(tar)).toEqual(
      Buffer.from(
        tarStudentFiles("ex", [
          { path: "src/main.py", contents: new TextEncoder().encode("print(1)\n") },
        ]),
      ),
    )
  })
})

describe("a packed browser answer", () => {
  const langsCli = installedLangsCli()

  it.skipIf(langsCli === null)(
    "is graded from its student files by prepare-submission",
    async () => {
      const workDir = mkdtempSync(path.join(tmpdir(), "browser-answer-"))
      try {
        const answer = path.join(workDir, "answer.tar.zst")
        const sandbox = path.join(workDir, "sandbox.tar")
        const studentCode = 'print("Hello " + input())\n'
        const archive = await packAnswerArchive("hello_name", [
          { filepath: "src/hello_name.py", contents: studentCode },
        ])
        writeFileSync(answer, new Uint8Array(await archive.arrayBuffer()))
        // oxlint-disable-next-line typescript/no-non-null-assertion -- the test is skipped without one
        execFileSync(langsCli!, [
          "prepare-submission",
          "--clone-path",
          path.join(import.meta.dirname, "..", "fixtures", "hello-name"),
          "--submission-path",
          answer,
          "--submission-compression",
          "zstd",
          "--output-path",
          sandbox,
          "--output-format",
          "tar",
          "--no-archive-prefix",
        ])
        const extracted = path.join(workDir, "sandbox")
        mkdirSync(extracted)
        execFileSync("tar", ["-xf", sandbox, "-C", extracted])
        expect(readFileSync(path.join(extracted, "src", "hello_name.py"), "utf8")).toBe(studentCode)
        expect(readdirSync(path.join(extracted, "test"))).toContain("test_hello_name.py")
      } finally {
        rmSync(workDir, { recursive: true, force: true })
      }
    },
  )
})
