import basePath from "@/lib/basePath"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { jsonOk } from "@/util/apiResponse"
import { ExerciseServiceInfoApi } from "@/util/exerciseServiceApi"

/**
 * Metadata the host backend reads to discover this plugin's endpoints. All paths are prefixed with
 * the service's base path so they resolve behind the ingress.
 */
function getImpl() {
  const prefix = basePath()
  return jsonOk<ExerciseServiceInfoApi>({
    service_name: "TMC",
    user_interface_iframe_path: `${prefix}/iframe`,
    grade_endpoint_path: `${prefix}/api/grade`,
    public_spec_endpoint_path: `${prefix}/api/public-spec`,
    model_solution_spec_endpoint_path: `${prefix}/api/model-solution`,
  })
}

export const handleServiceInfo = wrapRouteHandler(getImpl, {
  service: "tmc",
  operation: "GET /service-info",
})
