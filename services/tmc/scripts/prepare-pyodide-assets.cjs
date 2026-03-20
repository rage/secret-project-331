/**
 * Prepares self-hosted Pyodide assets under `public/pyodide/v<version>/full/`.
 *
 * We copy from the `pyodide` npm package (already installed) into `tmc/public`
 * so browser/worker runtime can fetch from our own server instead of CDN.
 */

const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..")
const configPath = path.join(root, "src/util/pyodide-version.json")

const { version } = JSON.parse(fs.readFileSync(configPath, "utf8"))

const pyodidePkgDir = path.join(root, "node_modules", "pyodide")
if (!fs.existsSync(pyodidePkgDir)) {
  throw new Error(`pyodide npm package not found at: ${pyodidePkgDir}`)
}

const targetDir = path.join(root, "public", "pyodide", `v${version}`, "full")
fs.mkdirSync(targetDir, { recursive: true })

const entries = fs.readdirSync(pyodidePkgDir, { withFileTypes: true })

let copied = 0
let skipped = 0

for (const entry of entries) {
  if (!entry.isFile()) {
    continue
  }

  const src = path.join(pyodidePkgDir, entry.name)
  const dest = path.join(targetDir, entry.name)

  const srcStat = fs.statSync(src)
  const destStat = fs.existsSync(dest) ? fs.statSync(dest) : null

  if (destStat && destStat.size === srcStat.size) {
    skipped++
    continue
  }

  fs.copyFileSync(src, dest)
  copied++
}

console.log(
  `Prepared Pyodide assets v${version} -> ${targetDir} (copied: ${copied}, skipped: ${skipped}).`,
)
