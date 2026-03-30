/**
 * Pyodide version and base URL. Single source of truth: pyodide-version.json.
 * Workers get the same URL injected at build time via scripts/inject-pyodide-version.cjs.
 */
import config from "./pyodide-version.json"

export const PYODIDE_VERSION = config.version

function normalizeBasePath(basePath?: string) {
  if (!basePath) {
    return ""
  }
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath
}

// NEXT_PUBLIC_BASE_PATH is set to "/tmc" in production (see Dockerfile.production.slim.dockerfile).
// Static files in `public/` are served under that base path too.
const basePath = normalizeBasePath(
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BASE_PATH : undefined,
)

const pyodideBaseUrl = `${basePath}${config.baseUrl}`

export const PYODIDE_INDEX_URL = `${pyodideBaseUrl}${config.version}/full/`
export const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`
