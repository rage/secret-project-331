import { NextResponse } from "next/server"

import { ExerciseServiceInfoApi } from "@/shared-module/common/bindings"
import basePath from "@/shared-module/common/utils/base-path"

export async function GET(): Promise<NextResponse> {
  const prefix = basePath()
  const data: ExerciseServiceInfoApi = {
    service_name: "Quizzes",
    user_interface_iframe_path: `${prefix}/iframe`,
    grade_endpoint_path: `${prefix}/api/grade`,
    public_spec_endpoint_path: `${prefix}/api/public-spec`,
    model_solution_spec_endpoint_path: `${prefix}/api/model-solution`,
  }

  return NextResponse.json(data)
}

function notFound() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export async function POST() {
  return notFound()
}

export async function PUT() {
  return notFound()
}

export async function PATCH() {
  return notFound()
}

export async function DELETE() {
  return notFound()
}

export async function HEAD() {
  return notFound()
}

export async function OPTIONS() {
  return notFound()
}
