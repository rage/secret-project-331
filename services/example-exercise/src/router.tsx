import { createRouter as createTanStackRouter } from "@tanstack/react-router"

import { routeTree } from "./routeTree.gen"

// Replaced at build time by rsbuild (PUBLIC_* vars are inlined). The browser loads the iframe at
// the prefixed URL (e.g. /example-exercise/iframe), so the client router must strip the base to
// match the "/iframe" route. Must match server.base + output.assetPrefix in rsbuild.config.ts.
const BASE_PATH = import.meta.env.PUBLIC_BASE_PATH ?? ""

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    basepath: BASE_PATH || undefined,
    // eslint-disable-next-line i18next/no-literal-string -- TanStack config value, not UI copy
    defaultPreload: "intent",
    scrollRestoration: true,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
