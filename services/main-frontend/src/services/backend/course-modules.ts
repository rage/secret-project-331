import {
  CompletionRegistrationLink,
  CourseCompletionRequirement,
  ModuleUpdates,
  UserCompletionInformation,
} from "../../shared-module/bindings"
import {
  isCompletionRegistrationLink,
  isUserCompletionInformation,
} from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchUserCompletionInformation = async (
  courseModuleId: string,
): Promise<UserCompletionInformation> => {
  {
    const response = await mainFrontendClient.get(
      `/course-modules/${courseModuleId}/user-completion`,
      {
        responseType: "json",
      },
    )
    return validateResponse(response, isUserCompletionInformation)
  }
}

export const postCourseCompletionRequirement = async (
  data: CourseCompletionRequirement,
): Promise<void> => {
  await mainFrontendClient.post(
    `/courses/${data.course_code}/course-completion-requirements`,
    data,
    {
      headers: { "Content-Type": "application/json" },
    },
  )
}

export const fetchCompletionRegistrationLink = async (
  courseModuleId: string,
): Promise<CompletionRegistrationLink> => {
  const res = await mainFrontendClient.get(
    `/course-modules/${courseModuleId}/completion-registration-link`,
    {
      responseType: "json",
    },
  )
  return validateResponse(res, isCompletionRegistrationLink)
}

export const submitChanges = async (
  courseId: string,
  newModules: Array<{ name: string; order_number: number; chapters: Array<string> }>,
  deletedModules: Array<string>,
  modifiedModules: Array<{ id: string; name: string | null; order_number: number }>,
  movedChapters: Array<[string, string]>,
): Promise<void> => {
  const data: ModuleUpdates = {
    new_modules: newModules,
    deleted_modules: deletedModules,
    modified_modules: modifiedModules,
    moved_chapters: movedChapters,
  }
  await mainFrontendClient.post(`/courses/${courseId}/course-modules`, data, {
    responseType: "json",
  })
}
