import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginSvgr } from "@rsbuild/plugin-svgr"
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild"
import { fileURLToPath } from "node:url"

import { IFRAME_HEADERS } from "./iframe-headers.mjs"

// Base path this service is mounted under behind the nginx ingress, e.g. "/quizzes". Fixed at build
// time (the production Dockerfile exports PUBLIC_BASE_PATH before `rsbuild build`), mirroring the
// old NEXT_PUBLIC_BASE_PATH behaviour under a framework-neutral name. rsbuild auto-inlines PUBLIC_*
// into both bundles, so the client router and the server routes agree.
const BASE_PATH = process.env.PUBLIC_BASE_PATH ?? ""

// rsbuild only auto-inlines PUBLIC_* env vars, and a bare `process.env.X` throws "process is not
// defined" in the browser. The vendored shared-module still reads a handful of NEXT_PUBLIC_* / URL
// vars; inline them here (as their build-time values, "undefined" when unset) so no bare
// process.env reference reaches the browser. Behaviour is unchanged from the old Next build.
const defineEnv = (value: string | undefined): string =>
  value === undefined ? "undefined" : JSON.stringify(value)

// SPA replacement for next/dynamic, resolved for the vendored shared code that still imports it
// (the shared source is untouched so the Next apps that vendor it keep the real next/dynamic).
const NEXT_DYNAMIC_SHIM = fileURLToPath(
  new URL("./src/lib/next-shims/dynamic.tsx", import.meta.url),
)

export default defineConfig({
  plugins: [
    // SPA mode: no SSR of route components, but server routes + the server-entry fetch handler
    // still run at runtime. The build prerenders only the app shell (dist/client/_shell.html).
    // maskPath must be the base path *with* a trailing slash: the router redirects "/{base}" ->
    // "/{base}/" (307), and the shell prerender treats a redirect as a failure.
    tanstackStart({ spa: { enabled: true, maskPath: BASE_PATH ? `${BASE_PATH}/` : "/" } }),
    pluginReact(),
    pluginSvgr({
      svgrOptions: {
        // `import Logo from "./x.svg"` yields the React component directly (matches @svgr/webpack).
        exportType: "default",
        svgProps: { role: "presentation" },
        // Ported verbatim from the shared svgoConfig so SVG output is unchanged. Inlined (rather
        // than a typed const) so the plugin's parameter type narrows the plugin `name` literals.
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
    port: Number(process.env.PORT ?? 3004),
    // Serve the shell + assets under the ingress base path.
    base: BASE_PATH || undefined,
    // The dev server does not run server.mjs, so stamp the iframe headers here too — the dev
    // cluster embeds this app in a sandboxed cross-origin iframe just like production.
    headers: IFRAME_HEADERS,
  },
  output: {
    // Absolute-prefix every static asset URL. Defaults to server.base, but set explicitly: the
    // sandboxed cross-origin iframe has an opaque origin and cannot resolve relative asset URLs.
    assetPrefix: BASE_PATH ? `${BASE_PATH}/` : undefined,
    // Public source maps (this is open source; replaces Next's productionBrowserSourceMaps: true).
    sourceMap: { js: "source-map" },
  },
  resolve: {
    alias: {
      "next/dynamic": NEXT_DYNAMIC_SHIM,
    },
  },
  source: {
    // Replaces Next's modularizeImports: rewrite `import { x } from "lodash"` to `lodash/x` so only
    // the used functions are bundled.
    transformImport: [{ libraryName: "lodash", customName: "lodash/{{ member }}" }],
    // Replaces Next's transpilePackages: this icon package ships untranspiled and lives in
    // node_modules, which rsbuild does not transpile by default.
    include: [/[\\/]node_modules[\\/]@vectopus[\\/]atlas-icons-react[\\/]/],
    define: {
      "process.env.NEXT_PUBLIC_SERVICE_SLUG": defineEnv(process.env.NEXT_PUBLIC_SERVICE_SLUG),
      "process.env.NEXT_PUBLIC_BASE_PATH": defineEnv(BASE_PATH),
      "process.env.NEXT_PUBLIC_SITE_TITLE": defineEnv(process.env.NEXT_PUBLIC_SITE_TITLE),
      // ERRORS_BASE_URL / BASE_URL are read only server-side (guarded by typeof window/process), so
      // they must NOT be defined here: doing so would freeze them to their build-time value in the
      // server bundle and defeat runtime configuration. The server reads process.env at runtime.
    },
  },
})
