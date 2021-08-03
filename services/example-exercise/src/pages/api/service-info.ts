import type { NextApiRequest, NextApiResponse } from "next"

import { ExerciseServiceInfoApi } from "../../shared-module/bindings"
import basePath from "../../shared-module/utils/base-path"
import { ClientErrorResponse, ModalSolutionApi } from "../../util/stateInterfaces"

export default (
  req: NextApiRequest,
  res: NextApiResponse<ExerciseServiceInfoApi | ModalSolutionApi | ClientErrorResponse>,
): void => {
  if (req.method !== "GET") {
    return res.status(404).json({ message: "Not found" })
  }

  return handleGet(req, res)
}

const handleGet = (
  _req: NextApiRequest,
  res: NextApiResponse<ExerciseServiceInfoApi | ModalSolutionApi>,
) => {
  const prefix = basePath()
  res.json({
    service_name: "Example exercise",
    editor_iframe_path: `${prefix}/editor`,
    exercise_iframe_path: `${prefix}/exercise`,
    submission_iframe_path: `${prefix}/submission`,
    grade_endpoint_path: `${prefix}/api/grade`,
    public_spec_endpoint_path: `${prefix}/api/public-spec`,
    modal_solution_path: `${prefix}/api/modal-solution`,
  })
}
