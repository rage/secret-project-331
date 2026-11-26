import { Zstd } from "@hpcc-js/wasm-zstd"
import { afterEach, describe, expect, it, vi } from "vitest"

import { initialEditorFiles } from "@/util/answerArchive"
import { tarStudentFiles } from "@/util/canonicalArchive"
import type { PublicSpec } from "@/util/stateInterfaces"

const ARCHIVE_HOST = "http://files.example/"
const STUB_URL = `${ARCHIVE_HOST}stub.tar.zst`
const PREVIOUS_URL = `${ARCHIVE_HOST}previous.tar.zst`

const BROWSER_SPEC: PublicSpec = {
  type: "browser",
  archive_name: "part01/name_and_age.tar.zst",
  stub_download_url: STUB_URL,
  student_file_paths: ["src/helper.py", "src/name_and_age.py"],
  checksum: "abc",
  main_file: "src/name_and_age.py",
  archive_prefix: "name_and_age",
}

/** A course exercise's stub: everything a VS Code download has, tests and tooling included. */
const STUB_FILES = {
  ".tmcproject.yml": "tests_timeout_ms: 10000\n",
  "src/helper.py": "# helper\n",
  "src/name_and_age.py": "# Write your solution here\n",
  "test/__init__.py": "",
  "test/test_name_and_age.py": "exercise = 'src.name_and_age'\n",
  "tmc/utils.py": "def load_module(): pass\n",
}

async function tarZstd(prefix: string, files: Record<string, string>): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const tar = tarStudentFiles(
    prefix,
    Object.entries(files).map(([path, contents]) => ({ path, contents: encoder.encode(contents) })),
  )
  return (await Zstd.load()).compress(tar)
}

/**
 * Serves the given archives on `files.example` and records which were asked for. Anything else
 * falls through to the real fetch: zstddec loads its wasm decoder that way.
 */
function serveArchives(archives: Record<string, Uint8Array>): string[] {
  const requested: string[] = []
  const realFetch = globalThis.fetch
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (!url.startsWith(ARCHIVE_HOST)) {
        return realFetch(input, init)
      }
      requested.push(url)
      const archive = archives[url]
      return Promise.resolve(
        archive === undefined
          ? new Response("missing", { status: 404 })
          : new Response(new Uint8Array(archive), { status: 200 }),
      )
    }),
  )
  return requested
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("initialEditorFiles", () => {
  it("seeds the editor with the stub's student files, main file first", async () => {
    const requested = serveArchives({ [STUB_URL]: await tarZstd("stub", STUB_FILES) })
    const seed = await initialEditorFiles(BROWSER_SPEC, null)
    expect(requested).toEqual([STUB_URL])
    expect(seed.files.map((f) => f.filepath)).toEqual(["src/name_and_age.py", "src/helper.py"])
    expect(seed.startingFiles).toEqual(seed.files)
  })

  it("seeds from a previous answer stored in the old whole-stub layout, keeping only student files", async () => {
    serveArchives({
      [STUB_URL]: await tarZstd("stub", STUB_FILES),
      [PREVIOUS_URL]: await tarZstd("tmp-5f3a9c", {
        ...STUB_FILES,
        "src/name_and_age.py": "print('mine')\n",
      }),
    })
    const seed = await initialEditorFiles(BROWSER_SPEC, PREVIOUS_URL)
    expect(seed.files).toEqual([
      { filepath: "src/name_and_age.py", contents: "print('mine')\n" },
      { filepath: "src/helper.py", contents: "# helper\n" },
    ])
    expect(seed.startingFiles[0]?.contents).toBe("# Write your solution here\n")
  })

  it("keeps a source file a VS Code answer added, which the spec cannot name", async () => {
    serveArchives({
      [STUB_URL]: await tarZstd("stub", STUB_FILES),
      [PREVIOUS_URL]: await tarZstd("name_and_age", {
        "src/name_and_age.py": "import extra\n",
        "src/extra.py": "x = 1\n",
      }),
    })
    const seed = await initialEditorFiles(BROWSER_SPEC, PREVIOUS_URL)
    expect(seed.files.map((f) => f.filepath)).toEqual(["src/name_and_age.py", "src/extra.py"])
  })

  it("gives an editor-mode exercise no editor files", async () => {
    const requested = serveArchives({})
    const seed = await initialEditorFiles({ ...BROWSER_SPEC, type: "editor" }, null)
    expect(seed).toEqual({ files: [], startingFiles: [] })
    expect(requested).toEqual([])
  })
})
