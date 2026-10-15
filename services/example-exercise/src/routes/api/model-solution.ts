import { createFileRoute } from "@tanstack/react-router"

import { handleModelSolution } from "@/server/modelSolution"

export const Route = createFileRoute("/api/model-solution")({
  server: {
    handlers: {
      POST: ({ request }) => handleModelSolution(request),
    },
  },
})
