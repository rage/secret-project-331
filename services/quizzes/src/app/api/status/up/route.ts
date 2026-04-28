import { NextResponse } from "next/server"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"

export const GET = wrapRouteHandler(() => NextResponse.json<boolean>(true, { status: 200 }), {
  service: "quizzes",
  operation: "GET /status/up",
})
