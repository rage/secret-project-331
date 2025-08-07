import { mainFrontendClient } from "../mainFrontendClient"

import {
  CompletionRegistrationLink,
  CourseModule,
  CourseModuleCompletion,
  ModifiedModule,
  ModuleUpdates,
  NewModule,
  UserCompletionInformation,
} from "@/shared-module/common/bindings"
import {
  isCompletionRegistrationLink,
  isCourseModule,
  isCourseModuleCompletion,
  isUserCompletionInformation,
} from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchCourseModule = async (id: string): Promise<CourseModule> => {
  const response = await mainFrontendClient.get(`/course-modules/${id}`)
  return validateResponse(response, isCourseModule)
}

export const fetchUserCompletionInformation = async (
  courseModuleId: string,
): Promise<UserCompletionInformation> => {
  {
    const response = await mainFrontendClient.get(
      `/course-modules/${courseModuleId}/user-completion`,
    )
    return validateResponse(response, isUserCompletionInformation)
  }
}

export const fetchCompletionRegistrationLink = async (
  courseModuleId: string,
): Promise<CompletionRegistrationLink> => {
  const res = await mainFrontendClient.get(
    `/course-modules/${courseModuleId}/completion-registration-link`,
  )
  return validateResponse(res, isCompletionRegistrationLink)
}

export const submitChanges = async (
  courseId: string,
  newModules: NewModule[],
  deletedModules: string[],
  modifiedModules: ModifiedModule[],
  movedChapters: Array<[string, string]>,
): Promise<void> => {
  const data: ModuleUpdates = {
    new_modules: newModules,
    deleted_modules: deletedModules,
    modified_modules: modifiedModules,
    moved_chapters: movedChapters,
  }
  await mainFrontendClient.post(`/courses/${courseId}/course-modules`, data)
}

export const setCertificationGeneration = async (id: string, enable: boolean): Promise<void> => {
  if (enable) {
    await mainFrontendClient.post(`/course-modules/${id}/set-certificate-generation/true`)
  } else {
    await mainFrontendClient.post(`/course-modules/${id}/set-certificate-generation/false`)
  }
}

export const fetchUserCourseModuleCompletion = async (
  courseModuleId: string,
): Promise<CourseModuleCompletion> => {
  const response = await mainFrontendClient.get(
    `/course-modules/${courseModuleId}/course-module-completion`,
  )
  return validateResponse(response, isCourseModuleCompletion)
}
