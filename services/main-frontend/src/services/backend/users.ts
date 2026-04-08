import { queryOptions } from "@tanstack/react-query"

import { validateGeneratedData } from "./generated"

import {
  approveOauthConsentMutation,
  changeUserPasswordMutation,
  createUserResearchConsentMutation,
  deleteOauthAuthorizedClientMutation,
  denyOauthConsentMutation,
  getMyCoursesOptions as getMyCoursesGeneratedOptions,
  getOauthAuthorizedClientsOptions as getOauthAuthorizedClientsGeneratedOptions,
  getResetPasswordTokenStatusMutation,
  getUserCourseEnrollmentsOptions as getUserCourseEnrollmentsGeneratedOptions,
  getUserOptions as getUserGeneratedOptions,
  getUserResearchConsentOptions as getUserResearchConsentGeneratedOptions,
  getUserResearchFormQuestionAnswersOptions as getUserResearchFormQuestionAnswersGeneratedOptions,
  getUserResetExerciseLogsOptions as getUserResetExerciseLogsGeneratedOptions,
  resetUserPasswordMutation,
  sendResetPasswordEmailMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  approveOauthConsent,
  changeUserPassword,
  createUserResearchConsent,
  deleteOauthAuthorizedClient,
  denyOauthConsent,
  getMyCourses as getMyCoursesFromApi,
  getOauthAuthorizedClients as getOauthAuthorizedClientsFromApi,
  getResetPasswordTokenStatus,
  getUserCourseEnrollments as getUserCourseEnrollmentsFromApi,
  getUser as getUserFromApi,
  getUserResearchConsent as getUserResearchConsentFromApi,
  getUserResearchFormQuestionAnswers as getUserResearchFormQuestionAnswersFromApi,
  getUserResetExerciseLogs as getUserResetExerciseLogsFromApi,
  resetUserPassword,
  sendResetPasswordEmail,
} from "@/generated/api/sdk.generated"
import {
  AuthorizedClientInfo,
  ConsentDenyQuery,
  ConsentQuery,
  ConsentResponse,
  Course,
  CourseEnrollmentsInfo,
  ExerciseResetLog,
  ResearchFormQuestionAnswer,
  User,
  UserResearchConsent,
} from "@/shared-module/common/bindings"
import {
  isAuthorizedClientInfo,
  isConsentResponse,
  isCourse,
  isCourseEnrollmentsInfo,
  isExerciseResetLog,
  isResearchFormQuestionAnswer,
  isUser,
  isUserResearchConsent,
} from "@/shared-module/common/bindings.guard"
import { isArray, isBoolean } from "@/shared-module/common/utils/fetching"

export async function getUser(userId: string): Promise<User> {
  const data = await getUserFromApi({
    path: {
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isUser)
}

export const getUserOptions = (userId: string) =>
  queryOptions({
    ...getUserGeneratedOptions({
      path: {
        user_id: userId,
      },
    }),
    select: (data): User => validateGeneratedData(data, isUser),
  })

export async function getCourseEnrollmentsInfo(userId: string): Promise<CourseEnrollmentsInfo> {
  const data = await getUserCourseEnrollmentsFromApi({
    path: {
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isCourseEnrollmentsInfo)
}

export const getCourseEnrollmentsInfoOptions = (userId: string) =>
  queryOptions({
    ...getUserCourseEnrollmentsGeneratedOptions({
      path: {
        user_id: userId,
      },
    }),
    select: (data): CourseEnrollmentsInfo => validateGeneratedData(data, isCourseEnrollmentsInfo),
  })

export const postUserResearchConsent = async (consent: boolean): Promise<UserResearchConsent> => {
  const data = await createUserResearchConsent({
    body: { consent },
    throwOnError: true,
  })

  return validateGeneratedData(data, isUserResearchConsent)
}

export const createUserResearchConsentMutationOptions = () => createUserResearchConsentMutation()

export const getResearchConsentByUserId = async (): Promise<UserResearchConsent> => {
  const data = await getUserResearchConsentFromApi({
    throwOnError: true,
  })

  return validateGeneratedData(data, isUserResearchConsent)
}

export const getUserResearchConsentOptions = () =>
  queryOptions({
    ...getUserResearchConsentGeneratedOptions(),
    select: (data): UserResearchConsent => validateGeneratedData(data, isUserResearchConsent),
  })

export const getAllResearchConsentAnswersByUserId = async (): Promise<
  Array<ResearchFormQuestionAnswer>
> => {
  const data = await getUserResearchFormQuestionAnswersFromApi({
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isResearchFormQuestionAnswer))
}

export const getUserResearchFormQuestionAnswersOptions = () =>
  queryOptions({
    ...getUserResearchFormQuestionAnswersGeneratedOptions(),
    select: (data): ResearchFormQuestionAnswer[] =>
      validateGeneratedData(data, isArray(isResearchFormQuestionAnswer)),
  })

export const getMyCourses = async (): Promise<Course[]> => {
  const data = await getMyCoursesFromApi({
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourse))
}

export const getMyCoursesOptions = () =>
  queryOptions({
    ...getMyCoursesGeneratedOptions(),
    select: (data): Course[] => validateGeneratedData(data, isArray(isCourse)),
  })

export const getUserResetExerciseLogs = async (
  userId: string,
): Promise<Array<ExerciseResetLog>> => {
  const data = await getUserResetExerciseLogsFromApi({
    path: {
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExerciseResetLog))
}

export const getUserResetExerciseLogsOptions = (userId: string) =>
  queryOptions({
    ...getUserResetExerciseLogsGeneratedOptions({
      path: {
        user_id: userId,
      },
    }),
    select: (data): ExerciseResetLog[] => validateGeneratedData(data, isArray(isExerciseResetLog)),
  })

export const sendResetPasswordLink = async (email: string, language: string): Promise<boolean> => {
  const data = await sendResetPasswordEmail({
    body: {
      email,
      language,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isBoolean)
}

export const sendResetPasswordEmailMutationOptions = () => sendResetPasswordEmailMutation()

export const fetchResetPasswordTokenStatus = async (token: string): Promise<boolean> => {
  const data = await getResetPasswordTokenStatus({
    body: { token },
    throwOnError: true,
  })

  return validateGeneratedData(data, isBoolean)
}

export const getResetPasswordTokenStatusMutationOptions = () =>
  getResetPasswordTokenStatusMutation()

export const postPasswordReset = async (token: string, new_password: string): Promise<boolean> => {
  const data = await resetUserPassword({
    body: {
      token,
      new_password,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isBoolean)
}

export const resetUserPasswordMutationOptions = () => resetUserPasswordMutation()

export const postPasswordChange = async (
  old_password: string,
  new_password: string,
): Promise<boolean> => {
  const data = await changeUserPassword({
    body: {
      old_password,
      new_password,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isBoolean)
}

export const changeUserPasswordMutationOptions = () => changeUserPasswordMutation()

export const getAuthorizedClientInfos = async (): Promise<AuthorizedClientInfo[]> => {
  const data = await getOauthAuthorizedClientsFromApi({
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isAuthorizedClientInfo))
}

export const getOauthAuthorizedClientsOptions = () =>
  queryOptions({
    ...getOauthAuthorizedClientsGeneratedOptions(),
    select: (data): AuthorizedClientInfo[] =>
      validateGeneratedData(data, isArray(isAuthorizedClientInfo)),
  })

export const revokeAuthorizedClient = async (clientId: string): Promise<void> => {
  await deleteOauthAuthorizedClient({
    path: {
      client_id: clientId,
    },
    throwOnError: true,
  })
}

export const deleteOauthAuthorizedClientMutationOptions = () =>
  deleteOauthAuthorizedClientMutation()

export const postOAuthConsent = async (consentQuery: ConsentQuery): Promise<ConsentResponse> => {
  const data = await approveOauthConsent({
    body: consentQuery,
    throwOnError: true,
  })

  return validateGeneratedData(data, isConsentResponse)
}

export const approveOauthConsentMutationOptions = () => approveOauthConsentMutation()

export const postOAuthDeny = async (denyQuery: ConsentDenyQuery): Promise<ConsentResponse> => {
  const data = await denyOauthConsent({
    body: denyQuery,
    throwOnError: true,
  })

  return validateGeneratedData(data, isConsentResponse)
}

export const denyOauthConsentMutationOptions = () => denyOauthConsentMutation()
