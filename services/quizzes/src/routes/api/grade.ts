import { createFileRoute } from "@tanstack/react-router"

import { handleGrade } from "@/server/grade"

export const Route = createFileRoute("/api/grade")({
  server: {
    handlers: {
      POST: ({ request }) => handleGrade(request),
    },
  },
})
