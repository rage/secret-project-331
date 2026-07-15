import { createFileRoute } from "@tanstack/react-router"

import { handleExtractStub } from "@/server/extractStub"

export const Route = createFileRoute("/api/extract-stub")({
  server: {
    handlers: {
      POST: ({ request }) => handleExtractStub(request),
    },
  },
})
