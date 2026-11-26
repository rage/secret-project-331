import { version as pyodideVersion } from "pyodide/package.json"

import basePath from "@/lib/basePath"

/**
 * Where the self-hosted Pyodide runtime is served, ending in a slash. Named after the installed
 * package's version, as scripts/prepare-pyodide-assets.cjs lays it out.
 */
export function pyodideIndexUrl(): string {
  return `${basePath()}/pyodide/${pyodideVersion}/`
}

/** URL of the module worker that runs Python for both Run and Test. */
export function pythonWorkerUrl(): string {
  const url = new URL(`${basePath()}/pythonWorker.js`, window.location.href)
  url.searchParams.set("indexURL", new URL(pyodideIndexUrl(), window.location.href).href)
  return url.href
}
