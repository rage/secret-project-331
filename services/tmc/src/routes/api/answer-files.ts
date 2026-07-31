import { createFileRoute } from "@tanstack/react-router"

import { handleAnswerFiles } from "@/server/answerFiles"

export const Route = createFileRoute("/api/answer-files")({
  server: {
    handlers: {
      POST: ({ request }) => handleAnswerFiles(request),
    },
  },
})
