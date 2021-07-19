import type { NextApiRequest, NextApiResponse } from "next"

import basePath from "../../shared-module/utils/base-path"

export default (req: NextApiRequest, res: NextApiResponse): unknown => {
  if (req.method !== "GET") {
    return res.status(404).json({ message: "Not found" })
  }

  return handleGet(req, res)
}

interface ServiceInfo {
  service_name: string
  editor_iframe_path: string
  exercise_iframe_path: string
  submission_iframe_path: string
  grade_endpoint_path: string
}

const handleGet = (_req: NextApiRequest, res: NextApiResponse<ServiceInfo>) => {
  const prefix = basePath()
  res.json({
    service_name: "Example exercise",
    editor_iframe_path: `${prefix}/editor`,
    exercise_iframe_path: `${prefix}/exercise`,
    submission_iframe_path: `${prefix}/submission`,
    grade_endpoint_path: `${prefix}/api/grade`,
  })
}
