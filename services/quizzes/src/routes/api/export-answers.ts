import { createFileRoute } from "@tanstack/react-router"

import { handleExportAnswers } from "@/server/exportAnswers"

export const Route = createFileRoute("/api/export-answers")({
  server: {
    handlers: {
      POST: ({ request }) => handleExportAnswers(request),
    },
  },
})
