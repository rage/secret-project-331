import { createFileRoute } from "@tanstack/react-router"

import { handleServiceInfo } from "@/server/serviceInfo"

export const Route = createFileRoute("/api/service-info")({
  server: {
    handlers: {
      GET: () => handleServiceInfo(),
    },
  },
})
