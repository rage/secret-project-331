import { ModuleUpdates } from "../../shared-module/bindings"
import { mainFrontendClient } from "../mainFrontendClient"

export const updateCourseModules = async (
  courseId: string,
  moduleUpdates: ModuleUpdates,
): Promise<void> => {
  await mainFrontendClient.post(`/courses/${courseId}/update-modules`, moduleUpdates, {
    responseType: "json",
  })
}
