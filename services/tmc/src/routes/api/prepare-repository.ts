import { createFileRoute } from "@tanstack/react-router"

import { handlePrepareRepository } from "@/server/prepareRepository"

export const Route = createFileRoute("/api/prepare-repository")({
  server: {
    handlers: {
      POST: ({ request }) => handlePrepareRepository(request),
    },
  },
})
