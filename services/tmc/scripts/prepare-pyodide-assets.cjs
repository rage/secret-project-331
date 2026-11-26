/**
 * Copies the Pyodide runtime from the installed npm package to `public/pyodide/<version>/`, with
 * gzip and brotli siblings that server.mjs serves to browsers that accept them.
 *
 * The directory is named after the installed package's version, so a bump moves the assets to a new
 * URL and long-lived caches of the old files cannot mix versions.
 */
const fs = require("fs")
const path = require("path")
const zlib = require("zlib")

const root = path.resolve(__dirname, "..")
const pyodidePackageDir = path.join(root, "node_modules", "pyodide")
const { version } = JSON.parse(
  fs.readFileSync(path.join(pyodidePackageDir, "package.json"), "utf8"),
)
const assetsRoot = path.join(root, "public", "pyodide")
const targetDir = path.join(assetsRoot, version)

// What a worker loads at startup; console pages, maps and typings stay out of the image.
const RUNTIME_FILES = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
]

fs.rmSync(assetsRoot, { recursive: true, force: true })
fs.mkdirSync(targetDir, { recursive: true })

for (const name of RUNTIME_FILES) {
  const contents = fs.readFileSync(path.join(pyodidePackageDir, name))
  const target = path.join(targetDir, name)
  fs.writeFileSync(target, contents)
  // The stdlib is already a zip.
  if (name.endsWith(".zip")) {
    continue
  }
  fs.writeFileSync(`${target}.gz`, zlib.gzipSync(contents, { level: 9 }))
  // Quality 11 saves another 10% on the wasm but takes half a minute on every install.
  fs.writeFileSync(
    `${target}.br`,
    zlib.brotliCompressSync(contents, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: contents.length,
      },
    }),
  )
}

console.log(`Prepared Pyodide ${version} assets in ${targetDir}.`)
