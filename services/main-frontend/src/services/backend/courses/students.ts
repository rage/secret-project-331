import { mainFrontendClient } from "../../mainFrontendClient"

import { ProgressOverview } from "@/shared-module/common/bindings"
import { isProgressOverview } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const getProgress = async (courseId: string): Promise<ProgressOverview> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/students/progress`)
  return validateResponse(response, isProgressOverview)
}
