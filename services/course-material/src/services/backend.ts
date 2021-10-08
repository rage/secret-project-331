import {
  ChapterWithStatus,
  Course,
  CourseInstance,
  CourseMaterialExercise,
  CoursePageWithUserData,
  NewFeedback,
  NewSubmission,
  Page,
  PageRoutingDataWithChapterStatus,
  PageSearchRequest,
  PageSearchResult,
  PageWithExercises,
  SubmissionResult,
  UserChapterProgress,
  UserCourseInstanceProgress,
  UserCourseSettings,
} from "../shared-module/bindings"

import { courseMaterialClient } from "./courseMaterialClient"

export const fetchCourseById = async (courseId: string): Promise<Course> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}`, { responseType: "json" })
  return response.data
}

export const fetchCourses = async (): Promise<Array<Course>> => {
  const data = (await courseMaterialClient.get("/courses", { responseType: "json" })).data
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
  innerBlocks: Block<unknown>[]
}

export const fetchCoursePageByPath = async (
  courseSlug: string,
  path: string,
): Promise<CoursePageWithUserData> => {
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

export const fetchUserCourseProgress = async (
  courseInstanceId: string,
): Promise<UserCourseInstanceProgress> => {
  const data = (await courseMaterialClient.get(`/course-instances/${courseInstanceId}/progress`))
    .data
  return data
}

export const fetchUserChapterProgress = async (chapterId: string): Promise<UserChapterProgress> => {
  const data = (await courseMaterialClient.get(`/chapters/${chapterId}/progress`)).data
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

export const getNextPageRoutingData = async (
  currentPageId: string,
): Promise<PageRoutingDataWithChapterStatus> => {
  return (await courseMaterialClient.get(`/pages/${currentPageId}/next-page`)).data
}

export const fetchChaptersPagesExcludeFrontpage = async (chapterId: string): Promise<Page[]> => {
  return (await courseMaterialClient.get(`/chapters/${chapterId}/pages-exclude-mainfrontpage`)).data
}

export const fetchChaptersInTheCourse = async (courseId: string): Promise<ChapterWithStatus[]> => {
  return (await courseMaterialClient.get(`/courses/${courseId}/chapters`)).data
}

export const fetchUserCourseSettings = async (
  courseId: string,
): Promise<UserCourseSettings | null> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/user-settings`)
  return response.data
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

export const postFeedback = async (
  courseSlug: string,
  newFeedback: NewFeedback,
): Promise<string> => {
  return (await courseMaterialClient.post(`/courses/${courseSlug}/feedback`, newFeedback)).data
}
