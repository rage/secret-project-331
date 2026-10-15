import { createFileRoute } from "@tanstack/react-router"

import { handleTest } from "@/server/testEndpoint"

export const Route = createFileRoute("/api/test")({
  server: {
    handlers: {
      POST: ({ request }) => handleTest(request),
    },
  },
})
