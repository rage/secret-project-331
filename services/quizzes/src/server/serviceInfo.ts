import basePath from "@/lib/basePath"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { ExerciseServiceInfoApi } from "@/utils/exerciseServiceApi"

const SERVICE = "quizzes"

/**
 * Metadata the host backend reads to discover this plugin's endpoints. All paths are prefixed with
 * the service's base path so they resolve behind the ingress.
 */
export const handleServiceInfo = wrapRouteHandler(
  (): Response => {
    const prefix = basePath()
    const data: ExerciseServiceInfoApi = {
      service_name: "Quizzes",
      user_interface_iframe_path: `${prefix}/iframe`,
      grade_endpoint_path: `${prefix}/api/grade`,
      public_spec_endpoint_path: `${prefix}/api/public-spec`,
      model_solution_spec_endpoint_path: `${prefix}/api/model-solution`,
      csv_export_definitions_endpoint_path: `${prefix}/api/export-definitions`,
      csv_export_answers_endpoint_path: `${prefix}/api/export-answers`,
    }
    return Response.json(data)
  },
  { service: SERVICE, operation: "GET /service-info" },
)
