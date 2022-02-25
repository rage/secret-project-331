import { CourseExam, Exam, ExamCourseInfo, NewExam } from "../../shared-module/bindings"
import { mainFrontendClient } from "../mainFrontendClient"

export const createExam = async (organizationId: string, data: NewExam) => {
  await mainFrontendClient.post(`/organizations/${organizationId}/exams`, data, {
    responseType: "json",
  })
}

export const createExamDuplicate = async (examId: string) => {
  return (await mainFrontendClient.post(`/exams/${examId}/duplicate`)).data
}

export const fetchExam = async (id: string): Promise<Exam> => {
  const response = await mainFrontendClient.get(`/exams/${id}`, { responseType: "json" })
  return response.data
}

export const fetchOrganizationExams = async (
  organizationId: string,
): Promise<Array<CourseExam>> => {
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
