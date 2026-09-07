import { createFileRoute } from "@tanstack/react-router"

import { handlePackBrowserAnswer } from "@/server/packBrowserAnswer"

export const Route = createFileRoute("/api/pack-browser-answer")({
  server: {
    handlers: {
      POST: ({ request }) => handlePackBrowserAnswer(request),
    },
  },
})
