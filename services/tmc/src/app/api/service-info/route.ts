import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import basePath from "@/shared-module/common/utils/base-path"
import { jsonOk } from "@/util/apiResponse"
import { ExerciseServiceInfoApi } from "@/util/exerciseServiceApi"

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

export const GET = wrapRouteHandler(getImpl, { service: "tmc", operation: "GET /service-info" })
