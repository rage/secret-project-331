/**
 * Single source of truth for Pyodide version and CDN URL.
 * Used by pyodideLoader (main thread) and by public/pythonTestWorker.js (worker).
 * Keep the worker's PYODIDE_CDN_VERSION in sync with PYODIDE_VERSION when changing.
 */
export const PYODIDE_VERSION = "0.29.3"
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`
export const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`
