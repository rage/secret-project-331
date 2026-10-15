import { createFileRoute } from "@tanstack/react-router"

import { handleStatusUp } from "@/server/status"

export const Route = createFileRoute("/api/status/up")({
  server: {
    handlers: {
      GET: () => handleStatusUp(),
    },
  },
})
