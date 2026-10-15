import { createFileRoute } from "@tanstack/react-router"

import { sandboxResultsHandlers } from "@/server/sandboxResults"

export const Route = createFileRoute("/api/sandbox-results")({
  server: {
    handlers: {
      GET: () => sandboxResultsHandlers.GET(),
      POST: () => sandboxResultsHandlers.POST(),
      PUT: () => sandboxResultsHandlers.PUT(),
      PATCH: () => sandboxResultsHandlers.PATCH(),
      DELETE: () => sandboxResultsHandlers.DELETE(),
      OPTIONS: () => sandboxResultsHandlers.OPTIONS(),
      HEAD: () => sandboxResultsHandlers.HEAD(),
    },
  },
})
