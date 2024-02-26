import {
  CourseExam,
  Exam,
  ExamCourseInfo,
  ExerciseSubmissions,
  NewExam,
  OrgExam,
} from "../../shared-module/bindings"
import { isExerciseSubmissions } from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const createExam = async (organizationId: string, data: NewExam) => {
  await mainFrontendClient.post(`/organizations/${organizationId}/exams`, data)
}

export const createExamDuplicate = async (examId: string, newExam: NewExam) => {
  return (await mainFrontendClient.post(`/exams/${examId}/duplicate`, newExam)).data
}

export const fetchExam = async (id: string): Promise<Exam> => {
  const response = await mainFrontendClient.get(`/exams/${id}`)
  return response.data
}

export const fetchCourseExams = async (organizationId: string): Promise<Array<CourseExam>> => {
  const response = await mainFrontendClient.get(`/organizations/${organizationId}/course_exams`)
  return response.data
}

export const fetchOrganizationExams = async (organizationId: string): Promise<Array<OrgExam>> => {
  return (await mainFrontendClient.get(`/organizations/${organizationId}/org_exams`, {})).data
}

export const setCourse = async (examId: string, courseId: string): Promise<void> => {
  const data: ExamCourseInfo = { course_id: courseId }
  await mainFrontendClient.post(`/exams/${examId}/set`, data)
}

export const unsetCourse = async (examId: string, courseId: string): Promise<void> => {
  const data: ExamCourseInfo = { course_id: courseId }
  await mainFrontendClient.post(`/exams/${examId}/unset`, data)
}

export const fetchExerciseSubmissionsWithExamId = async (
  examId: string,
  page: number,
  limit: number,
): Promise<ExerciseSubmissions> => {
  const response = await mainFrontendClient.get(
    `/exams/${examId}/submissions?page=${page}&limit=${limit}`,
  )
  return validateResponse(response, isExerciseSubmissions)
}
