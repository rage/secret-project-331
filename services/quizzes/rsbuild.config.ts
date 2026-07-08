import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginSvgr } from "@rsbuild/plugin-svgr"
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild"
import { fileURLToPath } from "node:url"

import { IFRAME_HEADERS } from "./iframe-headers.mjs"

// Base path this service is mounted under behind the ingress, e.g. "/quizzes". Fixed at build time
// (the Dockerfile exports PUBLIC_BASE_PATH before `rsbuild build`) and auto-inlined into both
// bundles, so the client router and server routes agree.
const BASE_PATH = process.env.PUBLIC_BASE_PATH ?? ""

// rsbuild only auto-inlines PUBLIC_* vars, and a bare `process.env.X` throws in the browser. Inline
// the NEXT_PUBLIC_* / URL vars the vendored shared-module reads ("undefined" when unset).
const defineEnv = (value: string | undefined): string =>
  value === undefined ? "undefined" : JSON.stringify(value)

// SPA replacement for next/dynamic, aliased in for the vendored shared code that imports it.
const NEXT_DYNAMIC_SHIM = fileURLToPath(
  new URL("./src/lib/next-shims/dynamic.tsx", import.meta.url),
)

export default defineConfig({
  plugins: [
    // SPA mode: route components aren't SSR'd, but server routes + the server-entry fetch handler
    // still run at runtime. The build prerenders only the app shell (dist/client/_shell.html).
    // maskPath needs a trailing slash: the router redirects "/{base}" -> "/{base}/" (307) and the
    // shell prerender treats a redirect as failure.
    tanstackStart({ spa: { enabled: true, maskPath: BASE_PATH ? `${BASE_PATH}/` : "/" } }),
    pluginReact(),
    pluginSvgr({
      svgrOptions: {
        // `import Logo from "./x.svg"` yields the React component directly.
        exportType: "default",
        svgProps: { role: "presentation" },
        // Inlined, not a typed const, so the plugin's parameter type narrows the `name` literals.
        svgoConfig: {
          plugins: [
            { name: "preset-default", params: { overrides: { cleanupIds: { minify: false } } } },
            { name: "prefixIds", params: { prefixIds: true, prefixClassNames: false } },
          ],
        },
      },
    }),
  ],
  server: {
    // Bind all interfaces so k8s probes and the ingress reach the dev server; rsbuild dev otherwise
    // listens on 127.0.0.1 only.
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 3004),
    // Serve the shell + assets under the ingress base path.
    base: BASE_PATH || undefined,
    // The dev server doesn't run server.mjs, so stamp the iframe headers here too.
    headers: IFRAME_HEADERS,
  },
  output: {
    // Absolute-prefix every asset URL: the opaque-origin sandboxed iframe can't resolve relative
    // URLs.
    assetPrefix: BASE_PATH ? `${BASE_PATH}/` : undefined,
    // Public source maps (this is open source).
    sourceMap: { js: "source-map" },
  },
  resolve: {
    alias: {
      "next/dynamic": NEXT_DYNAMIC_SHIM,
    },
  },
  source: {
    // Rewrite `import { x } from "lodash"` to `lodash/x` so only the used functions are bundled.
    transformImport: [{ libraryName: "lodash", customName: "lodash/{{ member }}" }],
    // Ships untranspiled in node_modules, which rsbuild skips by default.
    include: [/[\\/]node_modules[\\/]@vectopus[\\/]atlas-icons-react[\\/]/],
    define: {
      "process.env.NEXT_PUBLIC_SERVICE_SLUG": defineEnv(process.env.NEXT_PUBLIC_SERVICE_SLUG),
      "process.env.NEXT_PUBLIC_BASE_PATH": defineEnv(BASE_PATH),
      "process.env.NEXT_PUBLIC_SITE_TITLE": defineEnv(process.env.NEXT_PUBLIC_SITE_TITLE),
      // ERRORS_BASE_URL / BASE_URL are read only server-side. Don't define them here: that would
      // freeze them to build-time values in the server bundle; the server reads process.env at
      // runtime.
    },
  },
})
