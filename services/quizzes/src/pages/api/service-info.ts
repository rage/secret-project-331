import type { NextApiRequest, NextApiResponse } from "next"

import { ExerciseServiceInfoApi } from "../../shared-module/bindings"
import basePath from "../../shared-module/utils/base-path"

export default (req: NextApiRequest, res: NextApiResponse): void => {
  if (req.method !== "GET") {
    return res.status(404).json({ message: "Not found" })
  }

  return handleGet(req, res)
}

const handleGet = (_req: NextApiRequest, res: NextApiResponse<ExerciseServiceInfoApi>) => {
  const prefix = basePath()
  res.json({
    service_name: "Quizzes",
    exercise_type_specific_user_interface_iframe: `${prefix}/iframe`,
    grade_endpoint_path: `${prefix}/api/grade`,
    public_spec_endpoint_path: `${prefix}/api/public-spec`,
    model_solution_path: `${prefix}/api/model-solution`,
  })
}
