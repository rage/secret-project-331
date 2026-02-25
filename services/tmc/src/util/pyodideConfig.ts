/**
 * Pyodide version and base URL. Single source of truth: pyodide-version.json.
 * Workers get the same URL injected at build time via scripts/inject-pyodide-version.cjs.
 */
import config from "./pyodide-version.json"

export const PYODIDE_VERSION = config.version
export const PYODIDE_INDEX_URL = `${config.baseUrl}${config.version}/full/`
export const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`
