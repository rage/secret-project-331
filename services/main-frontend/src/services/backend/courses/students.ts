import { queryOptions } from "@tanstack/react-query"

import {
  getCourseStudentsCertificatesOptions as getCourseStudentsCertificatesGeneratedOptions,
  getCourseStudentsCompletionsOptions as getCourseStudentsCompletionsGeneratedOptions,
  getCourseStudentsProgressOptions as getCourseStudentsProgressGeneratedOptions,
  getCourseStudentsUsersOptions as getCourseStudentsUsersGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  getCourseStudentsCertificates as getCourseStudentsCertificatesFromApi,
  getCourseStudentsCompletions as getCourseStudentsCompletionsFromApi,
  getCourseStudentsProgress as getCourseStudentsProgressFromApi,
  getCourseStudentsUsers as getCourseStudentsUsersFromApi,
  updateGeneratedCertificate as updateGeneratedCertificateFromApi,
} from "@/generated/api/sdk.generated"
import {
  CertificateGridRow,
  CertificateUpdateRequest,
  CompletionGridRow,
  CourseUserInfo,
  GeneratedCertificate,
  ProgressOverview,
} from "@/shared-module/common/bindings"
import {
  isCertificateGridRow,
  isCompletionGridRow,
  isCourseUserInfo,
  isGeneratedCertificate,
  isProgressOverview,
} from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const getCourseUsers = async (courseId: string): Promise<CourseUserInfo[]> => {
  const data = await getCourseStudentsUsersFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourseUserInfo))
}

export const getCourseUsersOptions = (courseId: string) =>
  queryOptions({
    ...getCourseStudentsUsersGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): CourseUserInfo[] => validateGeneratedData(data, isArray(isCourseUserInfo)),
  })

export const getProgress = async (courseId: string): Promise<ProgressOverview> => {
  const data = await getCourseStudentsProgressFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isProgressOverview)
}

export const getProgressOptions = (courseId: string) =>
  queryOptions({
    ...getCourseStudentsProgressGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): ProgressOverview => validateGeneratedData(data, isProgressOverview),
  })

export const getCompletions = async (courseId: string): Promise<CompletionGridRow[]> => {
  const data = await getCourseStudentsCompletionsFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCompletionGridRow))
}

export const getCompletionsOptions = (courseId: string) =>
  queryOptions({
    ...getCourseStudentsCompletionsGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): CompletionGridRow[] =>
      validateGeneratedData(data, isArray(isCompletionGridRow)),
  })

export const getCertificates = async (courseId: string): Promise<CertificateGridRow[]> => {
  const data = await getCourseStudentsCertificatesFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCertificateGridRow))
}

export const getCertificatesOptions = (courseId: string) =>
  queryOptions({
    ...getCourseStudentsCertificatesGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): CertificateGridRow[] =>
      validateGeneratedData(data, isArray(isCertificateGridRow)),
  })

export const updateCertificate = async (
  certificateId: string,
  payload: CertificateUpdateRequest,
): Promise<GeneratedCertificate> => {
  const data = await updateGeneratedCertificateFromApi({
    body: payload,
    path: {
      certificate_id: certificateId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isGeneratedCertificate)
}
