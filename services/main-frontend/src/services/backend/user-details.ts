import { UserDetail } from "../../shared-module/bindings"
import { isUserDetail } from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

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
