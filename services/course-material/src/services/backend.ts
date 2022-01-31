import {
  Acronym,
  AcronymUpdate,
  ChapterWithStatus,
  Course,
  CourseInstance,
  CourseMaterialExercise,
  CoursePageWithUserData,
  ExamData,
  ExamEnrollment,
  NewFeedback,
  NewProposedPageEdits,
  NewSubmission,
  Page,
  PageRoutingDataWithChapterStatus,
  PageSearchRequest,
  PageSearchResult,
  PageWithExercises,
  PreviousSubmission,
  SubmissionResult,
  UserCourseInstanceChapterExerciseProgress,
  UserCourseInstanceChapterProgress,
  UserCourseInstanceProgress,
  UserCourseSettings,
} from "../shared-module/bindings"
import {
  isAcronym,
  isChapterWithStatus,
  isCourse,
  isCourseInstance,
  isCourseMaterialExercise,
  isCoursePageWithUserData,
  isExamData,
  isPage,
  isPageRoutingDataWithChapterStatus,
  isPageSearchResult,
  isPageWithExercises,
  isPreviousSubmission,
  isSubmissionResult,
  isUserCourseInstanceChapterExerciseProgress,
  isUserCourseInstanceChapterProgress,
  isUserCourseInstanceProgress,
  isUserCourseSettings,
} from "../shared-module/bindings.guard"
import {
  isArray,
  isNull,
  isString,
  isUnion,
  validateResponse,
} from "../shared-module/utils/fetching"

import { courseMaterialClient } from "./courseMaterialClient"

export const fetchCourseById = async (courseId: string): Promise<Course> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}`, { responseType: "json" })
  return validateResponse(response, isCourse)
}

export const fetchCourses = async (): Promise<Array<Course>> => {
  const response = await courseMaterialClient.get("/courses", { responseType: "json" })
  return validateResponse(response, isArray(isCourse))
}

export const fetchOrganizationCourses = async (organizationId: string): Promise<Array<Course>> => {
  const response = await courseMaterialClient.get(`/organizations/${organizationId}/courses`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isCourse))
}

export interface Block<T> {
  name: string
  isValid: boolean
  clientId: string
  attributes: T
  innerBlocks: Block<unknown>[]
}

export const fetchPageByExamId = async (id: string): Promise<Page> => {
  const data = (
    await courseMaterialClient.get(`/pages/exam/${id}`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchCoursePageByPath = async (
  courseSlug: string,
  path: string,
): Promise<CoursePageWithUserData> => {
  const response = await courseMaterialClient.get(`/courses/${courseSlug}/page-by-path${path}`, {
    responseType: "json",
  })
  return validateResponse(response, isCoursePageWithUserData)
}

export const fetchCourseInstance = async (courseId: string): Promise<CourseInstance | null> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/current-instance`, {
    responseType: "json",
  })
  return validateResponse(response, isUnion(isCourseInstance, isNull))
}

export const fetchCourseInstances = async (courseId: string): Promise<Array<CourseInstance>> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/course-instances`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isCourseInstance))
}

export const postCourseInstanceEnrollment = async (courseInstanceId: string): Promise<void> => {
  await courseMaterialClient.post(`/course-instances/${courseInstanceId}/enroll`, null, {
    headers: { "Content-Type": "application/json" },
  })
}

export const fetchAllCoursePages = async (courseId: string): Promise<Array<Page>> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/pages`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isPage))
}

export const fetchUserCourseProgress = async (
  courseInstanceId: string,
): Promise<UserCourseInstanceProgress> => {
  const response = await courseMaterialClient.get(`/course-instances/${courseInstanceId}/progress`)
  return validateResponse(response, isUserCourseInstanceProgress)
}

export const fetchUserChapterInstanceChapterProgress = async (
  courseInstanceId: string,
  chapterId: string,
): Promise<UserCourseInstanceChapterProgress> => {
  const response = await courseMaterialClient.get(
    `/course-instances/${courseInstanceId}/chapters/${chapterId}/progress`,
  )
  return validateResponse(response, isUserCourseInstanceChapterProgress)
}

export const fetchUserCourseInstanceChapterExercisesProgress = async (
  courseInstanceId: string,
  chapterId: string,
): Promise<Array<UserCourseInstanceChapterExerciseProgress>> => {
  const response = await courseMaterialClient.get(
    `/course-instances/${courseInstanceId}/chapters/${chapterId}/exercises/progress`,
  )
  return validateResponse(response, isArray(isUserCourseInstanceChapterExerciseProgress))
}

export const fetchExerciseById = async (id: string): Promise<CourseMaterialExercise> => {
  const response = await courseMaterialClient.get(`/exercises/${id}`, { responseType: "json" })
  return validateResponse(response, isCourseMaterialExercise)
}

export const fetchChaptersPagesWithExercises = async (
  chapterId: string,
): Promise<Array<PageWithExercises>> => {
  const response = await courseMaterialClient.get(`/chapters/${chapterId}/exercises`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isPageWithExercises))
}

export const fetchNextPageRoutingData = async (
  currentPageId: string,
): Promise<PageRoutingDataWithChapterStatus | null> => {
  const response = await courseMaterialClient.get(`/pages/${currentPageId}/next-page`)
  return validateResponse(response, isUnion(isPageRoutingDataWithChapterStatus, isNull))
}

export const fetchChaptersPagesExcludeFrontpage = async (
  chapterId: string,
): Promise<Array<Page>> => {
  const response = await courseMaterialClient.get(
    `/chapters/${chapterId}/pages-exclude-mainfrontpage`,
  )
  return validateResponse(response, isArray(isPage))
}

export const fetchChaptersInTheCourse = async (
  courseId: string,
): Promise<Array<ChapterWithStatus>> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/chapters`)
  return validateResponse(response, isArray(isChapterWithStatus))
}

export const fetchUserCourseSettings = async (
  courseId: string,
): Promise<UserCourseSettings | null> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/user-settings`)
  return validateResponse(response, isUnion(isUserCourseSettings, isNull))
}

export const fetchPageUrl = async (pageId: string): Promise<string> => {
  const response = await courseMaterialClient.get(`/pages/${pageId}/url-path`)
  return validateResponse(response, isString)
}

export const postSubmission = async (newSubmission: NewSubmission): Promise<SubmissionResult> => {
  const response = await courseMaterialClient.post(`/submissions`, newSubmission)
  return validateResponse(response, isSubmissionResult)
}

export const searchPagesWithPhrase = async (
  searchRequest: PageSearchRequest,
  courseId: string,
): Promise<Array<PageSearchResult>> => {
  const response = await courseMaterialClient.post(
    `/courses/${courseId}/search-pages-with-phrase`,
    searchRequest,
  )
  return validateResponse(response, isArray(isPageSearchResult))
}

export const searchPagesWithWords = async (
  searchRequest: PageSearchRequest,
  courseId: string,
): Promise<Array<PageSearchResult>> => {
  const response = await courseMaterialClient.post(
    `/courses/${courseId}/search-pages-with-words`,
    searchRequest,
  )
  return validateResponse(response, isArray(isPageSearchResult))
}

export const postFeedback = async (
  courseId: string,
  newFeedback: NewFeedback[],
): Promise<Array<string>> => {
  const response = await courseMaterialClient.post(`/courses/${courseId}/feedback`, newFeedback)
  return validateResponse(response, isArray(isString))
}

export const postProposedEdits = async (
  courseId: string,
  newProposedEdits: NewProposedPageEdits,
): Promise<void> => {
  await courseMaterialClient.post(`/proposed-edits/${courseId}`, newProposedEdits)
}

export const fetchExamEnrollment = async (examId: string): Promise<ExamEnrollment | null> => {
  const response = await courseMaterialClient.get(`/exams/${examId}/enrollment`)
  return response.data
}

export const enrollInExam = async (examId: string): Promise<void> => {
  await courseMaterialClient.post(`/exams/${examId}/enroll`, { responseType: "json" })
}

export const fetchExam = async (examId: string): Promise<ExamData> => {
  const response = await courseMaterialClient.get(`/exams/${examId}`, { responseType: "json" })
  return validateResponse(response, isExamData)
}

export const saveExamAnswer = async (
  examId: string,
  exerciseId: string,
  dataJson: unknown,
): Promise<void> => {
  await courseMaterialClient.post(`/exams/${examId}/save-answer/${exerciseId}`, dataJson)
}

export const fetchPreviousSubmission = async (
  exerciseId: string,
): Promise<PreviousSubmission | null> => {
  const response = await courseMaterialClient.get(
    `/submissions/previous-for-exercise/${exerciseId}`,
    { responseType: "json" },
  )
  return validateResponse(response, isUnion(isNull, isPreviousSubmission))
}

export const fetchAcronyms = async (
  courseId: string,
  languageCode: string,
): Promise<Array<Acronym>> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/acronyms/${languageCode}`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isAcronym))
}

export const newAcronym = async (
  courseSlug: string,
  languageCode: string,
  newAcronym: AcronymUpdate,
): Promise<void> => {
  await courseMaterialClient.post(`/courses/${courseSlug}/acronyms/${languageCode}`, newAcronym)
}
