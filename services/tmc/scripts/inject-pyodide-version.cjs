/**
 * Injects Pyodide index URL into worker scripts from pyodide-version.json (single source of truth).
 */
const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..")
const configPath = path.join(root, "src/util/pyodide-version.json")
const runWorkerPath = path.join(root, "public/runWorker.js")
const browserTestWorkerPath = path.join(root, "public/browserTestWorker.js")

const { version, baseUrl } = JSON.parse(fs.readFileSync(configPath, "utf8"))
const indexUrl = `${baseUrl}${version}/full/`
const indexUrlStr = JSON.stringify(indexUrl)

const PYODIDE_URL_PATTERN = /var PYODIDE_INDEX_URL = "[^"]*"/

function injectIndexUrl(filePath) {
  const content = fs.readFileSync(filePath, "utf8")
  if (!PYODIDE_URL_PATTERN.test(content)) {
    throw new Error(`PYODIDE_INDEX_URL pattern not found in ${filePath}`)
  }
  const updated = content.replace(PYODIDE_URL_PATTERN, `var PYODIDE_INDEX_URL = ${indexUrlStr}`)
  if (updated !== content) {
    fs.writeFileSync(filePath, updated)
  }
}

injectIndexUrl(runWorkerPath)
injectIndexUrl(browserTestWorkerPath)
console.log("Injected Pyodide index URL:", indexUrl)
