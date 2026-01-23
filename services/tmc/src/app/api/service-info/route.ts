import { NextResponse } from "next/server"

import { ClientErrorResponse } from "@/lib"
import { ExerciseServiceInfoApi } from "@/shared-module/common/bindings"
import basePath from "@/shared-module/common/utils/base-path"

export function GET() {
  const prefix = basePath()
  return NextResponse.json<ExerciseServiceInfoApi>({
    service_name: "TMC",
    user_interface_iframe_path: `${prefix}/iframe`,
    grade_endpoint_path: `${prefix}/api/grade`,
    public_spec_endpoint_path: `${prefix}/api/public-spec`,
    model_solution_spec_endpoint_path: `${prefix}/api/model-solution`,
  })
}

function methodNotFound() {
  return NextResponse.json<ClientErrorResponse>({ message: "Not found" }, { status: 404 })
}

export const HEAD = methodNotFound
export const POST = methodNotFound
export const PUT = methodNotFound
export const PATCH = methodNotFound
export const DELETE = methodNotFound
export const OPTIONS = methodNotFound
