import { isString, validateResponse } from "../../shared-module/utils/fetching"

import { cmsClient } from "./cmsClient"

export const fetchOrganizationIdForCourseInstance = async (
  courseInstanceId: string,
): Promise<string> => {
  const response = await cmsClient.get(`/course-instances/${courseInstanceId}/organization`, {
    headers: { "Content-Type": "application/json" },
  })
  return validateResponse(response, isString)
}
