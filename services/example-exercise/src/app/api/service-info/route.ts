import { NextResponse } from "next/server"

import { ExerciseServiceInfoApi } from "@/shared-module/common/bindings"
import basePath from "@/shared-module/common/utils/base-path"
import type { ClientErrorResponse } from "@/util/stateInterfaces"

const handleGet = () => {
  const prefix = basePath()
  const data: ExerciseServiceInfoApi = {
    service_name: "Example exercise",
    user_interface_iframe_path: `${prefix}/iframe`,
    grade_endpoint_path: `${prefix}/api/grade`,
    public_spec_endpoint_path: `${prefix}/api/public-spec`,
    model_solution_spec_endpoint_path: `${prefix}/api/model-solution`,
  }
  return NextResponse.json<ExerciseServiceInfoApi>(data)
}

export function GET() {
  return handleGet()
}

function notFound() {
  return NextResponse.json<ClientErrorResponse>({ message: "Not found" }, { status: 404 })
}

export const POST = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound
export const OPTIONS = notFound
export const HEAD = notFound
