import { promises as fs } from "fs"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"

import { extractProject, prepareExerciseRepository } from "@/tmc/langs"

import { handlePrepareRepository } from "./prepareRepository"

// tmc-langs is a CLI subprocess and the checkout download hits the network; the stubs stand in for
// a checkout with one exercise. System tests cover the full flow.
vi.mock("@/lib", () => ({
  downloadStream: vi.fn(() => Promise.resolve(undefined)),
}))
vi.mock("@/tmc/langs", () => ({
  extractProject: vi.fn(),
  prepareExerciseRepository: vi.fn(),
}))
vi.mock("@/shared-module/common/errors/reportErrorOccurrence", () => ({
  reportErrorOccurrence: vi.fn(() => Promise.resolve(undefined)),
}))

function post(body: unknown): Request {
  return new Request("http://localhost/api/prepare-repository", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

/**
 * Makes the stubbed extraction produce the given files and the preparation find `part01/ex`,
 * reporting `writtenFiles` as written.
 */
function checkoutWith(files: Record<string, string>, writtenFiles: string[]) {
  vi.mocked(extractProject).mockImplementation(async (_archive, checkout) => {
    for (const [relative, contents] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(checkout, relative)), { recursive: true })
      await fs.writeFile(path.join(checkout, relative), contents)
    }
  })
  vi.mocked(prepareExerciseRepository).mockImplementation((checkout) =>
    Promise.resolve([
      {
        path: path.join(checkout, "part01/ex"),
        part: "part01",
        name: "ex",
        plugin: "python3",
        tests_timeout_ms: 1000,
        written_files: writtenFiles,
      },
    ]),
  )
}

describe("POST /api/prepare-repository", () => {
  it("rejects a body without the checkout URL with 400", async () => {
    const res = await handlePrepareRepository(post({}))
    expect(res.status).toBe(400)
  })

  it("reports each exercise with the files langs wrote and its plugin", async () => {
    checkoutWith(
      {
        ".tmcproject.yml": "tests_timeout_ms: 1000\n",
        "part01/ex/.tmcproject.yml": "merged: true\n",
      },
      [".tmcproject.yml"],
    )
    const res = await handlePrepareRepository(post({ checkout_download_url: "http://files/c" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      exercises: [
        {
          part: "part01",
          name: "ex",
          path: "part01/ex",
          files: [{ path: ".tmcproject.yml", contents: "merged: true\n" }],
          details: { plugin: "python3" },
        },
      ],
    })
  })

  it("sends no files when langs wrote none", async () => {
    checkoutWith({ "part01/ex/.tmcproject.yml": "own: true\n" }, [])
    const res = await handlePrepareRepository(post({ checkout_download_url: "http://files/c" }))
    const body = (await res.json()) as { exercises: { files: unknown[] }[] }
    expect(body.exercises[0]?.files).toEqual([])
  })
})
