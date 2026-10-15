import { createFileRoute } from "@tanstack/react-router"

import { handleExportDefinitions } from "@/server/exportDefinitions"

export const Route = createFileRoute("/api/export-definitions")({
  server: {
    handlers: {
      POST: ({ request }) => handleExportDefinitions(request),
    },
  },
})
