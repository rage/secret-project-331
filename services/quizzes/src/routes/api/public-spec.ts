import { createFileRoute } from "@tanstack/react-router"

import { handlePublicSpec } from "@/server/publicSpec"

export const Route = createFileRoute("/api/public-spec")({
  server: {
    handlers: {
      POST: ({ request }) => handlePublicSpec(request),
    },
  },
})
