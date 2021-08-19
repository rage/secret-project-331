import {
  ChapterWithStatus,
  Course,
  CourseInstance,
  CourseMaterialExercise,
  NewSubmission,
  Organization,
  Page,
  PageRoutingData,
  PageSearchRequest,
  PageSearchResult,
  PageWithExercises,
  SubmissionResult,
  UserProgress,
} from "../shared-module/bindings"

import { courseMaterialClient } from "./courseMaterialClient"

export const fetchCourses = async (): Promise<Array<Course>> => {
  const data = (await courseMaterialClient.get("/courses", { responseType: "json" })).data
  return data
}

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const data = (await courseMaterialClient.get("/organizations", { responseType: "json" })).data
  return data
}

export const fetchOrganizationCourses = async (organizationId: string): Promise<Array<Course>> => {
  const data = (
    await courseMaterialClient.get(`/organizations/${organizationId}/courses`, {
      responseType: "json",
    })
  ).data
  return data
}

export interface Block<T> {
  name: string
  isValid: boolean
  clientId: string
  attributes: T
  innerBlocks: any[]
}

export const fetchCoursePageByPath = async (courseSlug: string, path: string): Promise<Page> => {
  const data = (
    await courseMaterialClient.get(`/courses/${courseSlug}/page-by-path${path}`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchCourseInstance = async (courseId: string): Promise<CourseInstance | null> => {
  const data = (
    await courseMaterialClient.get(`/courses/${courseId}/current-instance`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchCourseInstances = async (courseId: string): Promise<Array<CourseInstance>> => {
  const data = (
    await courseMaterialClient.get(`/courses/${courseId}/course-instances`, {
      responseType: "json",
    })
  ).data
  return data
}

export const postCourseInstanceEnrollment = async (courseInstanceId: string): Promise<unknown> => {
  const response = await courseMaterialClient.post(
    `/course-instances/${courseInstanceId}/enroll`,
    null,
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return response.data
}

export const fetchAllCoursePages = async (courseId: string): Promise<Page[]> => {
  const data = (
    await courseMaterialClient.get(`/courses/${courseId}/pages`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchUserCourseProgress = async (courseInstanceId: string): Promise<UserProgress> => {
  const data = (await courseMaterialClient.get(`/course-instances/${courseInstanceId}/progress`))
    .data
  return data
}

export const fetchExerciseById = async (id: string): Promise<CourseMaterialExercise> => {
  const data = (await courseMaterialClient.get(`/exercises/${id}`, { responseType: "json" })).data
  return data
}

export const fetchChaptersPagesWithExercises = async (
  chapterId: string,
): Promise<PageWithExercises[]> => {
  const data = (
    await courseMaterialClient.get(`/chapters/${chapterId}/exercises`, {
      responseType: "json",
    })
  ).data
  return data
}

export const getNextPageRoutingData = async (currentPageId: string): Promise<PageRoutingData> => {
  return (await courseMaterialClient.get(`/pages/${currentPageId}/next-page`)).data
}

export const fetchChaptersPagesExcludeFrontpage = async (chapterId: string): Promise<Page[]> => {
  return (await courseMaterialClient.get(`/chapters/${chapterId}/pages-exclude-mainfrontpage`)).data
}

export const fetchChaptersInTheCourse = async (courseId: string): Promise<ChapterWithStatus[]> => {
  return (await courseMaterialClient.get(`/courses/${courseId}/chapters`)).data
}

export const fetchPageUrl = async (pageId: string): Promise<string> => {
  return (await courseMaterialClient.get(`/pages/${pageId}/url-path`)).data
}

export const postSubmission = async (newSubmission: NewSubmission): Promise<SubmissionResult> => {
  return (await courseMaterialClient.post(`/submissions`, newSubmission)).data
}

export const searchPagesWithPhrase = async (
  searchRequest: PageSearchRequest,
  courseId: string,
): Promise<PageSearchResult[]> => {
  return (
    await courseMaterialClient.post(`/courses/${courseId}/search-pages-with-phrase`, searchRequest)
  ).data
}

export const searchPagesWithWords = async (
  searchRequest: PageSearchRequest,
  courseId: string,
): Promise<PageSearchResult[]> => {
  return (
    await courseMaterialClient.post(`/courses/${courseId}/search-pages-with-words`, searchRequest)
  ).data
}
