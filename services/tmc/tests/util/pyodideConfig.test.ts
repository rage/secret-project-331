import { existsSync } from "node:fs"
import path from "node:path"

import { version } from "pyodide/package.json"
import { describe, expect, it } from "vitest"

import { pyodideIndexUrl, pythonWorkerUrl } from "@/util/pyodideConfig"

describe("pyodideConfig", () => {
  it("points the worker at the runtime directory postinstall prepared for the installed version", () => {
    expect(pyodideIndexUrl()).toBe(`/pyodide/${version}/`)
    const assetDir = path.join(import.meta.dirname, "..", "..", "public", pyodideIndexUrl())
    expect(existsSync(path.join(assetDir, "pyodide.mjs"))).toBe(true)
  })

  it("passes the runtime directory to the worker as an absolute URL", () => {
    const indexUrl = new URL(pythonWorkerUrl()).searchParams.get("indexURL")
    expect(indexUrl).toBe(new URL(pyodideIndexUrl(), window.location.href).href)
  })
})
