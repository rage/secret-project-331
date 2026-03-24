import { ExerciseServiceInfoApi } from "@/shared-module/common/bindings"
import basePath from "@/shared-module/common/utils/base-path"
import { jsonOk } from "@/util/apiResponse"

export function GET() {
  const prefix = basePath()
  return jsonOk<ExerciseServiceInfoApi>({
    service_name: "TMC",
    user_interface_iframe_path: `${prefix}/iframe`,
    grade_endpoint_path: `${prefix}/api/grade`,
    public_spec_endpoint_path: `${prefix}/api/public-spec`,
    model_solution_spec_endpoint_path: `${prefix}/api/model-solution`,
  })
}
