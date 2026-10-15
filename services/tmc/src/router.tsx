import { createRouter as createTanStackRouter } from "@tanstack/react-router"

import { routeTree } from "./routeTree.gen"

// Inlined by rsbuild at build time. The iframe loads at the prefixed URL (e.g. /tmc/iframe), so the
// client router strips the base to match "/iframe". Must match server.base +
// output.assetPrefix.
const BASE_PATH = import.meta.env.PUBLIC_BASE_PATH ?? ""

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    ...(BASE_PATH ? { basepath: BASE_PATH } : {}),
    // oxlint-disable-next-line i18next/no-literal-string -- TanStack config value, not UI copy
    defaultPreload: "intent",
    scrollRestoration: true,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
