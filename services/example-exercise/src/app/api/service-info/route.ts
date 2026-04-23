import { NextResponse } from "next/server"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import basePath from "@/shared-module/common/utils/base-path"
import { ExerciseServiceInfoApi } from "@/util/exerciseServiceApi"
import type { ClientErrorResponse } from "@/util/stateInterfaces"

const handleGet = () => {
  const prefix = basePath()
  const data: ExerciseServiceInfoApi = {
    service_name: "Example exercise",
    user_interface_iframe_path: `${prefix}/iframe`,
    grade_endpoint_path: `${prefix}/api/grade`,
    public_spec_endpoint_path: `${prefix}/api/public-spec`,
    model_solution_spec_endpoint_path: `${prefix}/api/model-solution`,
    csv_export_definitions_endpoint_path: `${prefix}/api/export-definitions`,
    csv_export_answers_endpoint_path: `${prefix}/api/export-answers`,
  }
  return NextResponse.json<ExerciseServiceInfoApi>(data)
}

const SERVICE = "example-exercise"

export const GET = wrapRouteHandler(handleGet, { service: SERVICE, operation: "GET /service-info" })

function notFound() {
  return NextResponse.json<ClientErrorResponse>({ message: "Not found" }, { status: 404 })
}

function notFoundHead() {
  return new Response(null, { status: 404 })
}

export const POST = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "POST /service-info",
})
export const PUT = wrapRouteHandler(notFound, { service: SERVICE, operation: "PUT /service-info" })
export const PATCH = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "PATCH /service-info",
})
export const DELETE = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "DELETE /service-info",
})
export const OPTIONS = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "OPTIONS /service-info",
})
export const HEAD = wrapRouteHandler(notFoundHead, {
  service: SERVICE,
  operation: "HEAD /service-info",
})
