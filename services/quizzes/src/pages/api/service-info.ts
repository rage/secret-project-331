import type { NextApiRequest, NextApiResponse } from "next"

import { ExerciseServiceInfoApi } from "@/shared-module/common/bindings"
import basePath from "@/shared-module/common/utils/base-path"

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
    user_interface_iframe_path: `${prefix}/iframe`,
    grade_endpoint_path: `${prefix}/api/grade`,
    public_spec_endpoint_path: `${prefix}/api/public-spec`,
    model_solution_spec_endpoint_path: `${prefix}/api/model-solution`,
  })
}
