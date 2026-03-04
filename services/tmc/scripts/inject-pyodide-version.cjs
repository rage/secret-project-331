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

function injectIndexUrl(filePath) {
  let content = fs.readFileSync(filePath, "utf8")
  content = content.replace(
    /var PYODIDE_INDEX_URL = "[^"]*"/,
    `var PYODIDE_INDEX_URL = ${indexUrlStr}`,
  )
  fs.writeFileSync(filePath, content)
}

injectIndexUrl(runWorkerPath)
injectIndexUrl(browserTestWorkerPath)
console.log("Injected Pyodide index URL:", indexUrl)