import { isString } from "lodash"

import { mainFrontendClient } from "../mainFrontendClient"

import { UserDetail } from "@/shared-module/common/bindings"
import { isUserDetail } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const searchForUserDetailsByEmail = async (searchTerm: string): Promise<UserDetail[]> => {
  const response = await mainFrontendClient.post(`/user-details/search-by-email`, {
    query: searchTerm,
  })
  return validateResponse(response, isArray(isUserDetail))
}

export const searchForUserDetailsByOtherDetails = async (
  searchTerm: string,
): Promise<UserDetail[]> => {
  const response = await mainFrontendClient.post(`/user-details/search-by-other-details`, {
    query: searchTerm,
  })
  return validateResponse(response, isArray(isUserDetail))
}

export const searchForUserDetailsFuzzyMatch = async (searchTerm: string): Promise<UserDetail[]> => {
  const response = await mainFrontendClient.post(`/user-details/search-fuzzy-match`, {
    query: searchTerm,
  })
  return validateResponse(response, isArray(isUserDetail))
}

export const getUserDetails = async (userId: string): Promise<UserDetail> => {
  const response = await mainFrontendClient.get(`/user-details/${userId}`)
  return validateResponse(response, isUserDetail)
}

export const getUsersByCourseId = async (courseId: string): Promise<UserDetail[]> => {
  const response = await mainFrontendClient.get(`/user-details/${courseId}/get-users-by-course-id`)
  return validateResponse(response, isArray(isUserDetail))
}

export const fetchCountryFromIP = async (): Promise<string> => {
  const response = await mainFrontendClient.get(`/user-details/users-ip-country`)
  return validateResponse(response, isString)
}
