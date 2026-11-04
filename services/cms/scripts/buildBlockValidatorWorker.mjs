// Bundles the headless block validator into one self-contained file that runs as a worker thread,
// so the production image needs neither the sources nor jsdom in node_modules.
// Usage: node scripts/buildBlockValidatorWorker.mjs [--watch] [--outfile <path>]

import { readFileSync } from "fs"
import path from "path"

import * as esbuild from "esbuild"

const CMS_ROOT = path.join(import.meta.dirname, "..")
const DEFAULT_OUTFILE = path.join(CMS_ROOT, "dist", "block-validator-worker.cjs")

/** Editor-only packages that can't load in a CommonJS bundle and that validation never calls. */
const EDITOR_ONLY_PACKAGES =
  /^(vega-canvas|vega-embed|react-vega|@monaco-editor\/react|monaco-editor)(\/.*)?$/
const EDITOR_ONLY_STUB = `
const stub = new Proxy(function () { return stub }, {
  get: (_target, key) => (key === Symbol.toPrimitive ? () => "" : stub),
  apply: () => stub,
  construct: () => stub,
})
export default stub
export const canvas = stub, image = stub, VegaLite = stub, Editor = stub, DiffEditor = stub,
  loader = stub, useMonaco = stub, editor = stub, languages = stub, Uri = stub, KeyCode = stub,
  KeyMod = stub
`

/** jsdom reads two files next to its sources at load time, which a bundle doesn't have. */
const jsdomFileReads = {
  name: "jsdom-file-reads",
  setup(build) {
    build.onLoad(
      { filter: /jsdom[\\/]lib[\\/]jsdom[\\/]living[\\/]css[\\/]helpers[\\/]computed-style\.js$/ },
      (args) => {
        const stylesheet = readFileSync(
          path.resolve(path.dirname(args.path), "../../../browser/default-stylesheet.css"),
          "utf8",
        )
        const source = readFileSync(args.path, "utf8")
        const patched = source.replace(
          /fs\.readFileSync\(\s*path\.resolve\(__dirname, "\.\.\/\.\.\/\.\.\/browser\/default-stylesheet\.css"\),\s*\{ encoding: "utf-8" \}\s*\)/,
          JSON.stringify(stylesheet),
        )
        if (patched === source) {
          throw new Error(
            "jsdom's default stylesheet read changed; update buildBlockValidatorWorker.mjs",
          )
        }
        return { contents: patched, loader: "js" }
      },
    )
    build.onLoad(
      { filter: /jsdom[\\/]lib[\\/]jsdom[\\/]living[\\/]xhr[\\/]XMLHttpRequest-impl\.js$/ },
      (args) => {
        const source = readFileSync(args.path, "utf8")
        // Synchronous XHR is the only user of this worker file, and nothing here makes requests.
        const patched = source.replace('require.resolve("./xhr-sync-worker.js")', "null")
        if (patched === source) {
          throw new Error(
            "jsdom's sync XHR worker lookup changed; update buildBlockValidatorWorker.mjs",
          )
        }
        return { contents: patched, loader: "js" }
      },
    )
  },
}

const editorOnlyStubs = {
  name: "editor-only-stubs",
  setup(build) {
    build.onResolve({ filter: EDITOR_ONLY_PACKAGES }, (args) => ({
      path: args.path,
      namespace: "editor-only",
    }))
    build.onLoad({ filter: /.*/, namespace: "editor-only" }, () => ({
      contents: EDITOR_ONLY_STUB,
      loader: "js",
    }))
    // css-tree's ES build loads its data with createRequire(import.meta.url), which a bundle can't
    // follow; its CommonJS build uses plain requires.
    build.onResolve({ filter: /^css-tree(\/.*)?$/ }, async (args) => {
      if (args.kind === "require-call" || args.pluginData === "commonjs") {
        return undefined
      }
      const resolved = await build.resolve(args.path, {
        kind: "require-call",
        resolveDir: args.resolveDir,
        pluginData: "commonjs",
      })
      return { path: resolved.path }
    })
  },
}

const reportBuilds = {
  name: "report-builds",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0) {
        console.log("block-validator-worker: built")
      }
    })
  },
}

const outfileFlag = process.argv.indexOf("--outfile")
const outfile = outfileFlag === -1 ? DEFAULT_OUTFILE : path.resolve(process.argv[outfileFlag + 1])

const buildOptions = {
  absWorkingDir: CMS_ROOT,
  entryPoints: ["src/blockValidator/worker.ts"],
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  alias: { "@": path.join(CMS_ROOT, "src") },
  loader: { ".css": "empty", ".scss": "empty", ".svg": "empty" },
  define: { "process.env.NODE_ENV": '"production"' },
  jsx: "automatic",
  minify: true,
  legalComments: "none",
  logLevel: "error",
  external: ["canvas"],
  plugins: [editorOnlyStubs, jsdomFileReads, reportBuilds],
}

if (process.argv.includes("--watch")) {
  const context = await esbuild.context(buildOptions)
  await context.watch()
} else {
  await esbuild.build(buildOptions)
}
