import { CompletionRegistrationLink, UserCompletionInformation } from "../../shared-module/bindings"
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
