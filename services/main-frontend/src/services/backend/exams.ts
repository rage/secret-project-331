import { CourseExam, Exam, ExamCourseInfo } from "../../shared-module/bindings"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchExam = async (id: string): Promise<Exam> => {
  const response = await mainFrontendClient.get(`/exams/${id}`, { responseType: "json" })
  return response.data
}

export const fetchOrganizationExams = async (
  organizationId: string | undefined,
): Promise<Array<CourseExam>> => {
  if (typeof organizationId === "undefined") {
    // eslint-disable-next-line i18next/no-literal-string
    return Promise.reject(new Error("Organization ID undefined"))
  }
  const response = await mainFrontendClient.get(`/organizations/${organizationId}/exams`, {
    responseType: "json",
  })
  return response.data
}

export const setCourse = async (examId: string, courseId: string): Promise<void> => {
  const data: ExamCourseInfo = { course_id: courseId }
  await mainFrontendClient.post(`/exams/${examId}/set`, data, {
    responseType: "json",
  })
}

export const unsetCourse = async (examId: string, courseId: string): Promise<void> => {
  const data: ExamCourseInfo = { course_id: courseId }
  await mainFrontendClient.post(`/exams/${examId}/unset`, data, { responseType: "json" })
}
