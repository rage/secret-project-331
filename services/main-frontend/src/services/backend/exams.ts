import { mainFrontendClient } from "../mainFrontendClient"

import {
  CourseExam,
  Exam,
  ExamCourseInfo,
  NewExam,
  Organization,
  OrgExam,
} from "@/shared-module/common/bindings"
import { isOrganization } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const createExam = async (organizationId: string, data: NewExam) => {
  await mainFrontendClient.post(`/organizations/${organizationId}/exams`, data)
}

export const EditExam = async (examId: string, data: NewExam) => {
  await mainFrontendClient.post(`/exams/${examId}/edit-exam`, data, {
    responseType: "json",
  })
}

export const createExamDuplicate = async (examId: string, newExam: NewExam) => {
  return (await mainFrontendClient.post(`/exams/${examId}/duplicate`, newExam)).data
}

export const fetchExam = async (id: string): Promise<Exam> => {
  const response = await mainFrontendClient.get(`/exams/${id}`)
  return response.data
}

export const fetchOrgExam = async (examId: string): Promise<OrgExam> => {
  const response = await mainFrontendClient.get(`/organizations/${examId}/fetch_org_exam`, {})
  return response.data
}
export const fetchCourseExams = async (organizationId: string): Promise<Array<CourseExam>> => {
  const response = await mainFrontendClient.get(`/organizations/${organizationId}/course_exams`)
  return response.data
}

export const fetchOrganizationExams = async (organizationId: string): Promise<Array<OrgExam>> => {
  return (await mainFrontendClient.get(`/organizations/${organizationId}/org_exams`, {})).data
}

export const fetchOrganization = async (organizationId: string): Promise<Organization> => {
  const response = await mainFrontendClient.get(`/organizations/${organizationId}`)
  return validateResponse(response, isOrganization)
}
export const setCourse = async (examId: string, courseId: string): Promise<void> => {
  const data: ExamCourseInfo = { course_id: courseId }
  await mainFrontendClient.post(`/exams/${examId}/set`, data)
}

export const unsetCourse = async (examId: string, courseId: string): Promise<void> => {
  const data: ExamCourseInfo = { course_id: courseId }
  await mainFrontendClient.post(`/exams/${examId}/unset`, data)
}
