import { createFileRoute } from "@tanstack/react-router"

import { handleTestrun } from "@/server/testrun"

export const Route = createFileRoute("/api/testrun")({
  server: {
    handlers: {
      GET: ({ request }) => handleTestrun(request),
    },
  },
})
