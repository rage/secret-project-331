import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginSvgr } from "@rsbuild/plugin-svgr"
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild"

import { IFRAME_HEADERS } from "./iframe-headers.mjs"

// Base path this service is mounted under behind the nginx ingress, e.g. "/example-exercise".
// Fixed at build time (the Dockerfile exports PUBLIC_BASE_PATH before `rsbuild build`); rsbuild
// auto-inlines PUBLIC_* into both bundles, so the client router and server routes agree.
const BASE_PATH = process.env.PUBLIC_BASE_PATH ?? ""

// rsbuild only auto-inlines PUBLIC_* vars. The vendored error reporter reads
// process.env.NEXT_PUBLIC_SERVICE_SLUG, so inline it here — otherwise a bare `process.env`
// reference throws in the browser.
const SERVICE_SLUG = process.env.NEXT_PUBLIC_SERVICE_SLUG

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
        // `import Logo from "./x.svg"` yields the React component directly.
        exportType: "default",
        svgProps: { role: "presentation" },
        // Inlined (rather than a typed const) so the plugin's parameter type narrows the `name`
        // literals.
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
    port: Number(process.env.PORT ?? 3002),
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
    // Public source maps (this is open source).
    sourceMap: { js: "source-map" },
  },
  source: {
    define: {
      "process.env.NEXT_PUBLIC_SERVICE_SLUG":
        SERVICE_SLUG === undefined ? "undefined" : JSON.stringify(SERVICE_SLUG),
    },
  },
})
