import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"

export const handleStatusUp = wrapRouteHandler(() => Response.json(true, { status: 200 }), {
  service: "tmc",
  operation: "GET /status/up",
})
