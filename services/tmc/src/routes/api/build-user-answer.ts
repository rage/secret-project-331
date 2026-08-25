import { createFileRoute } from "@tanstack/react-router"

import { handleBuildUserAnswer } from "@/server/buildUserAnswer"

export const Route = createFileRoute("/api/build-user-answer")({
  server: {
    handlers: {
      POST: ({ request }) => handleBuildUserAnswer(request),
    },
  },
})
