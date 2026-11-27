import { createFileRoute } from "@tanstack/react-router"

import { handlePrivateSpecSchema } from "@/server/privateSpecSchema"

export const Route = createFileRoute("/api/private-spec-schema")({
  server: {
    handlers: {
      GET: () => handlePrivateSpecSchema(),
    },
  },
})
