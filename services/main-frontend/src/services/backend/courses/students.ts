import { mainFrontendClient } from "../../mainFrontendClient"

import {
  CertificateGridRow,
  CertificateUpdateRequest,
  CompletionGridRow,
  CourseUserInfo,
  ProgressOverview,
} from "@/shared-module/common/bindings"
import {
  isCertificateGridRow,
  isCompletionGridRow,
  isCourseUserInfo,
  isGeneratedCertificate,
  isProgressOverview,
} from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

const isCourseUserInfoArray = (x: unknown): x is CourseUserInfo[] =>
  Array.isArray(x) && x.every(isCourseUserInfo)

const isCompletionGridRowArray = (x: unknown): x is CompletionGridRow[] =>
  Array.isArray(x) && x.every(isCompletionGridRow)

const isCertificateGridRowArray = (x: unknown): x is CertificateGridRow[] =>
  Array.isArray(x) && x.every(isCertificateGridRow)

export const getCourseUsers = async (courseId: string): Promise<CourseUserInfo[]> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/students/users`)
  return validateResponse(response, isCourseUserInfoArray)
}

export const getProgress = async (courseId: string): Promise<ProgressOverview> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/students/progress`)
  return validateResponse(response, isProgressOverview)
}

export const getCompletions = async (courseId: string): Promise<CompletionGridRow[]> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/students/completions`)
  return validateResponse(response, isCompletionGridRowArray)
}

export const getCertificates = async (courseId: string): Promise<CertificateGridRow[]> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/students/certificates`)
  return validateResponse(response, isCertificateGridRowArray)
}

export const getCertificate = async (certificateId: string) => {
  const response = await mainFrontendClient.get(`/certificates/generated/${certificateId}`)
  return validateResponse(response, isGeneratedCertificate)
}

export const updateCertificate = async (
  certificateId: string,
  payload: CertificateUpdateRequest,
) => {
  const response = await mainFrontendClient.put(`/certificates/generated/${certificateId}`, payload)
  return validateResponse(response, isGeneratedCertificate)
}
