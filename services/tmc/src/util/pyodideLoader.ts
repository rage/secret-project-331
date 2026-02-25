/**
 * Lazy-loads Pyodide in the browser from CDN via script tag.
 * Avoids bundler "expression is too dynamic" by not using import("pyodide").
 */

import { PYODIDE_INDEX_URL, PYODIDE_SCRIPT_URL } from "@/util/pyodideConfig"

export interface PyodideInterface {
  runPythonAsync(code: string): Promise<unknown>
  setStdout(options: { batched?: (msg: string) => void; raw?: (byte: number) => void }): void
  setStderr(options: { batched?: (msg: string) => void; raw?: (byte: number) => void }): void
  setStdin?(options: { stdin?: () => string | undefined }): void
  FS: {
    mkdirTree(path: string): void
    writeFile(path: string, data: string | Uint8Array, opts?: { encoding?: string }): void
  }
}

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>
  }
}

let pyodidePromise: Promise<PyodideInterface> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document not available"))
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      const rs = existing.readyState
      if (rs === "loaded" || rs === "complete") {
        resolve()
        return
      }
      existing.onload = () => resolve()
      existing.onerror = () => {
        existing.remove()
        reject(new Error(`Failed to load script: ${src}`))
      }
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      reject(new Error(`Failed to load script: ${src}`))
    }
    document.head.appendChild(script)
  })
}

export async function getPyodide(): Promise<PyodideInterface> {
  if (pyodidePromise !== null) {
    return pyodidePromise
  }
  pyodidePromise = (async () => {
    try {
      await loadScript(PYODIDE_SCRIPT_URL)
      const loadPyodide = window.loadPyodide
      if (!loadPyodide) {
        throw new Error("loadPyodide not found on window after loading pyodide.js")
      }
      return await loadPyodide({ indexURL: PYODIDE_INDEX_URL })
    } catch (err) {
      pyodidePromise = null
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Pyodide load failed: ${message}`)
    }
  })()
  return pyodidePromise
}
