import { NextResponse } from "next/server"

import basePath from "@/lib/basePath"
import { ExerciseServiceInfoApi } from "@/util/exerciseServiceApi"

export function GET() {
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
