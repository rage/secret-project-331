// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const PROJECT_ROOT = join(import.meta.dirname, "../..")

const read = (file: string) => readFileSync(join(PROJECT_ROOT, file), "utf8")

/** Dockerfiles whose image runs the production server, which ships without the source tree. */
const serverImages = readdirSync(PROJECT_ROOT)
  .filter((file) => /dockerfile/i.test(file) && file !== ".dockerignore")
  .filter((file) => /CMD \[\s*"node",\s*"server\.mjs"\s*\]/.test(read(file)))

const serverImports = [...read("server.mjs").matchAll(/from "\.\/([^"/]+)"/g)].map(
  (match) => match[1]!,
)

describe("production Dockerfiles", () => {
  it("exist", () => {
    expect(serverImages.length).toBeGreaterThan(0)
  })

  it.each(serverImages)("%s copies every module server.mjs imports", (file) => {
    const copied = read(file)
      .split("\n")
      .filter((line) => line.startsWith("COPY"))
      .join("\n")
    for (const importedFile of serverImports) {
      expect(copied, importedFile).toContain(importedFile)
    }
  })

  it.each(serverImages)("%s installs the pnpm major package.json pins", (file) => {
    const pinned = /^pnpm@(\d+)\./.exec(JSON.parse(read("package.json")).packageManager)?.[1]
    for (const [, major] of read(file).matchAll(/pnpm@(\d+)/g)) {
      expect(major).toBe(pinned)
    }
  })
})
