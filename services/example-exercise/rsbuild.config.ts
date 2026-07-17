import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginSvgr } from "@rsbuild/plugin-svgr"
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild"

import { IFRAME_HEADERS } from "./iframe-headers.mjs"

// Base path this service is mounted under behind the ingress, e.g. "/example-exercise". Fixed at
// build time (the Dockerfile exports PUBLIC_BASE_PATH before `rsbuild build`) and auto-inlined into
// both bundles, so the client router and server routes agree.
const BASE_PATH = process.env.PUBLIC_BASE_PATH ?? ""

// rsbuild only auto-inlines PUBLIC_* vars, and a bare `process.env.X` throws in the browser. The
// vendored error reporter reads process.env.NEXT_PUBLIC_SERVICE_SLUG, so inline it below.
const SERVICE_SLUG = process.env.NEXT_PUBLIC_SERVICE_SLUG

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
    port: Number(process.env.PORT ?? 3002),
    // Serve the shell + assets under the ingress base path.
    ...(BASE_PATH ? { base: BASE_PATH } : {}),
    // The dev server doesn't run server.mjs, so stamp the iframe headers here too.
    headers: IFRAME_HEADERS,
  },
  output: {
    // Absolute-prefix every asset URL: the opaque-origin sandboxed iframe can't resolve relative
    // URLs.
    ...(BASE_PATH ? { assetPrefix: `${BASE_PATH}/` } : {}),
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
