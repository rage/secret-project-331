import { queryOptions } from "@tanstack/react-query"
import { isString } from "lodash"

import { validateGeneratedData } from "./generated"

import {
  getBulkUserDetailsMutation,
  getUserDetailsByCourseAndUserIdOptions as getUserDetailsByCourseAndUserIdGeneratedOptions,
  getUserDetailsByCoursesMutation,
  getUserDetailsForAuthenticatedUserOptions as getUserDetailsForAuthenticatedUserGeneratedOptions,
  getUsersByCourseIdForUserDetailsOptions as getUsersByCourseIdForUserDetailsGeneratedOptions,
  getUsersIpCountryOptions as getUsersIpCountryGeneratedOptions,
  searchUserDetailsByEmailMutation,
  searchUserDetailsByOtherDetailsMutation,
  searchUserDetailsFuzzyMatchMutation,
  updateUserInfoMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  getBulkUserDetails as getBulkUserDetailsFromApi,
  getUserDetailsByCourseAndUserId as getUserDetailsByCourseAndUserIdFromApi,
  getUserDetailsByCourses as getUserDetailsByCoursesFromApi,
  getUserDetailsForAuthenticatedUser as getUserDetailsForAuthenticatedUserFromApi,
  getUsersByCourseIdForUserDetails as getUsersByCourseIdForUserDetailsFromApi,
  getUsersIpCountry as getUsersIpCountryFromApi,
  searchUserDetailsByEmail as searchUserDetailsByEmailFromApi,
  searchUserDetailsByOtherDetails as searchUserDetailsByOtherDetailsFromApi,
  searchUserDetailsFuzzyMatch as searchUserDetailsFuzzyMatchFromApi,
  updateUserInfo as updateUserInfoFromApi,
} from "@/generated/api/sdk.generated"
import { UserDetail } from "@/shared-module/common/bindings"
import { isUserDetail } from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

export const searchForUserDetailsByEmail = async (searchTerm: string): Promise<UserDetail[]> => {
  const data = await searchUserDetailsByEmailFromApi({
    body: {
      query: searchTerm,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isUserDetail))
}

export const searchForUserDetailsByEmailMutationOptions = () => searchUserDetailsByEmailMutation()

export const searchForUserDetailsByOtherDetails = async (
  searchTerm: string,
): Promise<UserDetail[]> => {
  const data = await searchUserDetailsByOtherDetailsFromApi({
    body: {
      query: searchTerm,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isUserDetail))
}

export const searchForUserDetailsByOtherDetailsMutationOptions = () =>
  searchUserDetailsByOtherDetailsMutation()

export const searchForUserDetailsFuzzyMatch = async (searchTerm: string): Promise<UserDetail[]> => {
  const data = await searchUserDetailsFuzzyMatchFromApi({
    body: {
      query: searchTerm,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isUserDetail))
}

export const searchForUserDetailsFuzzyMatchMutationOptions = () =>
  searchUserDetailsFuzzyMatchMutation()

export const getUserDetails = async (courseIds: string[], userId: string): Promise<UserDetail> => {
  const data = await getUserDetailsByCoursesFromApi({
    body: {
      user_id: userId,
      course_ids: courseIds,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isUserDetail)
}

export const getUserDetailsByCoursesMutationOptions = () => getUserDetailsByCoursesMutation()

export const getUserDetailsByCourseAndUserId = async (
  courseId: string,
  userId: string,
): Promise<UserDetail> => {
  const data = await getUserDetailsByCourseAndUserIdFromApi({
    path: {
      course_id: courseId,
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isUserDetail)
}

export const getUserDetailsByCourseAndUserIdOptions = (courseId: string, userId: string) =>
  queryOptions({
    ...getUserDetailsByCourseAndUserIdGeneratedOptions({
      path: {
        course_id: courseId,
        user_id: userId,
      },
    }),
    select: (data): UserDetail => validateGeneratedData(data, isUserDetail),
  })

export const getUsersByCourseId = async (courseId: string): Promise<UserDetail[]> => {
  const data = await getUsersByCourseIdForUserDetailsFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isUserDetail))
}

export const getUsersByCourseIdOptions = (courseId: string) =>
  queryOptions({
    ...getUsersByCourseIdForUserDetailsGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): UserDetail[] => validateGeneratedData(data, isArray(isUserDetail)),
  })

export const getBulkUserDetails = async (
  courseId: string,
  userIds: string[],
): Promise<UserDetail[]> => {
  const data = await getBulkUserDetailsFromApi({
    body: {
      user_ids: userIds,
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isUserDetail))
}

export const getBulkUserDetailsMutationOptions = () => getBulkUserDetailsMutation()

export const fetchCountryFromIP = async (): Promise<string> => {
  const data = await getUsersIpCountryFromApi({
    throwOnError: true,
  })

  return validateGeneratedData(data, isString)
}

export const getUsersIpCountryOptions = () =>
  queryOptions({
    ...getUsersIpCountryGeneratedOptions(),
    select: (data): string => validateGeneratedData(data, isString),
  })

export const getUserDetailsForUser = async (): Promise<UserDetail> => {
  const data = await getUserDetailsForAuthenticatedUserFromApi({
    throwOnError: true,
  })

  return validateGeneratedData(data, isUserDetail)
}

export const getUserDetailsForUserOptions = () =>
  queryOptions({
    ...getUserDetailsForAuthenticatedUserGeneratedOptions(),
    select: (data): UserDetail => validateGeneratedData(data, isUserDetail),
  })

export const updateUserInfo = async (
  email: string,
  firstName: string,
  lastName: string,
  country: string,
  emailCommunicationConsent: boolean,
): Promise<UserDetail> => {
  const data = await updateUserInfoFromApi({
    body: {
      email,
      first_name: firstName,
      last_name: lastName,
      country,
      email_communication_consent: emailCommunicationConsent,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isUserDetail)
}

export const updateUserInfoMutationOptions = () => updateUserInfoMutation()
