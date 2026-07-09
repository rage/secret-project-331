import basePath from "@/lib/basePath"
import { ExerciseServiceInfoApi } from "@/util/exerciseServiceApi"

/** Endpoint metadata the host backend reads to discover this plugin (base-path-prefixed). */
export function handleServiceInfo(): Response {
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
  return Response.json(data)
}
