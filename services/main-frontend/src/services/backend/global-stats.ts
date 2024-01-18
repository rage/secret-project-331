import { GlobalStatEntry } from "../../shared-module/bindings"
import { isGlobalStatEntry } from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const getNumberOfPeopleCompletedACourse = async (): Promise<GlobalStatEntry[]> => {
  const response = await mainFrontendClient.get(`/global-stats/number-of-people-completed-a-course`)
  return validateResponse(response, isArray(isGlobalStatEntry))
}

export const getNumberOfPeopleRegisteredCompletionToStudyRegistry = async (): Promise<
  GlobalStatEntry[]
> => {
  const response = await mainFrontendClient.get(
    `/global-stats/number-of-people-registered-completion-to-study-registry`,
  )
  return validateResponse(response, isArray(isGlobalStatEntry))
}

export const getNumberOfPeopleDoneAtLeastOneExercise = async (): Promise<GlobalStatEntry[]> => {
  const response = await mainFrontendClient.get(
    `/global-stats/number-of-people-done-at-least-one-exercise`,
  )
  return validateResponse(response, isArray(isGlobalStatEntry))
}

export const getnumberOfPeopleStartedCourse = async (): Promise<GlobalStatEntry[]> => {
  const response = await mainFrontendClient.get(`/global-stats/number-of-people-started-course`)
  return validateResponse(response, isArray(isGlobalStatEntry))
}
