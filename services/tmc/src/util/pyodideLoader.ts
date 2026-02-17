/**
 * Lazy-loads Pyodide in the browser from CDN via script tag.
 * Avoids bundler "expression is too dynamic" by not using import("pyodide").
 */

const PYODIDE_CDN_VERSION = "0.29.3"
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_CDN_VERSION}/full/`
const SCRIPT_URL = `${INDEX_URL}pyodide.js`

export interface PyodideInterface {
  runPythonAsync(code: string): Promise<unknown>
  setStdout(options: { batched?: (msg: string) => void; raw?: (byte: number) => void }): void
  setStderr(options: { batched?: (msg: string) => void; raw?: (byte: number) => void }): void
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
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

export async function getPyodide(): Promise<PyodideInterface> {
  if (pyodidePromise !== null) {
    return pyodidePromise
  }
  pyodidePromise = (async () => {
    await loadScript(SCRIPT_URL)
    const loadPyodide = window.loadPyodide
    if (!loadPyodide) {
      throw new Error("loadPyodide not found on window after loading pyodide.js")
    }
    return loadPyodide({ indexURL: INDEX_URL })
  })()
  return pyodidePromise
}
