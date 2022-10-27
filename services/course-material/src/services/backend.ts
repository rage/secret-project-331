import { RawAxiosRequestHeaders } from "axios"
import { Dictionary } from "lodash"

import {
  ChaptersWithStatus,
  Course,
  CourseInstance,
  CourseMaterialExercise,
  CourseMaterialPeerReviewData,
  CourseMaterialPeerReviewSubmission,
  CoursePageWithUserData,
  ExamData,
  ExamEnrollment,
  IsChapterFrontPage,
  MaterialReference,
  NewFeedback,
  NewMaterialReference,
  NewProposedPageEdits,
  OEmbedResponse,
  Page,
  PageChapterAndCourseInformation,
  PageNavigationInformation,
  PageSearchRequest,
  PageSearchResult,
  PageWithExercises,
  PeerReviewsRecieved,
  StudentExerciseSlideSubmission,
  StudentExerciseSlideSubmissionResult,
  Term,
  TermUpdate,
  UserCourseInstanceChapterExerciseProgress,
  UserCourseInstanceChapterProgress,
  UserCourseInstanceProgress,
  UserCourseSettings,
  UserModuleCompletionStatus,
} from "../shared-module/bindings"
import {
  isChaptersWithStatus,
  isCourse,
  isCourseInstance,
  isCourseMaterialExercise,
  isCourseMaterialPeerReviewData,
  isCoursePageWithUserData,
  isExamData,
  isIsChapterFrontPage,
  isMaterialReference,
  isOEmbedResponse,
  isPage,
  isPageChapterAndCourseInformation,
  isPageNavigationInformation,
  isPageSearchResult,
  isPageWithExercises,
  isPeerReviewsRecieved,
  isStudentExerciseSlideSubmissionResult,
  isTerm,
  isUserCourseInstanceChapterExerciseProgress,
  isUserCourseInstanceChapterProgress,
  isUserCourseInstanceProgress,
  isUserCourseSettings,
  isUserModuleCompletionStatus,
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

export const fetchTopLevelPages = async (courseId: string): Promise<Array<Page>> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/top-level-pages`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isPage))
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
  const headers: RawAxiosRequestHeaders = {}
  if (
    document.referrer &&
    document.referrer !== "" &&
    !referrerIsTheCurrentSite(document.referrer)
  ) {
    headers["Orignal-Referrer"] = document.referrer
  }

  const currentUrl = new URL(document.location.href)
  const utmTags: Dictionary<string> = {}
  Array.from(currentUrl.searchParams.entries()).forEach(([key, value]) => {
    if (key.startsWith("utm_")) {
      utmTags[key] = value
    }
  })
  if (Object.keys(utmTags).length > 0) {
    headers["utm-tags"] = JSON.stringify(utmTags)
  }

  // Detect a browser controlled by automation (like headless chrome).
  // The detection is done just to exclude the browser from the page visitor counts.
  // There is no benefit from bypassing this.
  const browserControlledByAutomation = !!navigator.webdriver
  if (!browserControlledByAutomation) {
    // eslint-disable-next-line i18next/no-literal-string
    headers["totally-not-a-bot"] = "true"
  }

  const response = await courseMaterialClient.get(`/courses/${courseSlug}/page-by-path${path}`, {
    responseType: "json",
    headers: headers,
  })
  return validateResponse(response, isCoursePageWithUserData)
}

const referrerIsTheCurrentSite = (referrer: string): boolean => {
  try {
    const referrerUrl = new URL(referrer)
    return referrerUrl.hostname === window.location.hostname
  } catch {
    // If not a valid url
    return false
  }
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
): Promise<UserCourseInstanceProgress[]> => {
  const response = await courseMaterialClient.get(`/course-instances/${courseInstanceId}/progress`)
  return validateResponse(response, isArray(isUserCourseInstanceProgress))
}

export const fetchUserModuleCompletionStatuses = async (
  courseInstanceId: string,
): Promise<Array<UserModuleCompletionStatus>> => {
  const response = await courseMaterialClient.get(
    `/course-instances/${courseInstanceId}/module-completions`,
    { responseType: "json" },
  )
  return validateResponse(response, isArray(isUserModuleCompletionStatus))
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

export const fetchPeerReviewDataByExerciseId = async (
  id: string,
): Promise<CourseMaterialPeerReviewData> => {
  const response = await courseMaterialClient.get(`/exercises/${id}/peer-review`, {
    responseType: "json",
  })
  return validateResponse(response, isCourseMaterialPeerReviewData)
}

export const fetchPeerReviewDataReceivedByExerciseId = async (
  id: string,
  submissionId: string,
): Promise<PeerReviewsRecieved> => {
  const response = await courseMaterialClient.get(
    `/exercises/${id}/slide-submission/${submissionId}/peer-reviews-received`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isPeerReviewsRecieved)
}

export const fetchChaptersPagesWithExercises = async (
  chapterId: string,
): Promise<Array<PageWithExercises>> => {
  const response = await courseMaterialClient.get(`/chapters/${chapterId}/exercises`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isPageWithExercises))
}

export const fetchPageNavigationData = async (
  currentPageId: string,
): Promise<PageNavigationInformation> => {
  const response = await courseMaterialClient.get(`/pages/${currentPageId}/page-navigation`)
  return validateResponse(response, isPageNavigationInformation)
}

export const fetchPageChapterAndCourse = async (
  currentPageId: string,
): Promise<PageChapterAndCourseInformation | null> => {
  const response = await courseMaterialClient.get(
    `/pages/${currentPageId}/chapter-and-course-information`,
  )
  return validateResponse(response, isUnion(isPageChapterAndCourseInformation, isNull))
}

export const fetchChaptersPagesExcludeFrontpage = async (
  chapterId: string,
): Promise<Array<Page>> => {
  const response = await courseMaterialClient.get(
    `/chapters/${chapterId}/pages-exclude-mainfrontpage`,
  )
  return validateResponse(response, isArray(isPage))
}

export const fetchChaptersInTheCourse = async (courseId: string): Promise<ChaptersWithStatus> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/chapters`)
  return validateResponse(response, isChaptersWithStatus)
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

export const postSubmission = async (
  exerciseId: string,
  newSubmission: StudentExerciseSlideSubmission,
): Promise<StudentExerciseSlideSubmissionResult> => {
  const response = await courseMaterialClient.post(
    `/exercises/${exerciseId}/submissions`,
    newSubmission,
  )
  return validateResponse(response, isStudentExerciseSlideSubmissionResult)
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

export const postPeerReviewSubmission = async (
  exerciseId: string,
  peerReviewSubmission: CourseMaterialPeerReviewSubmission,
): Promise<void> => {
  await courseMaterialClient.post(`/exercises/${exerciseId}/peer-reviews`, peerReviewSubmission, {
    responseType: "json",
  })
}

export const postStartPeerReview = async (exerciseId: string): Promise<void> => {
  await courseMaterialClient.post(`/exercises/${exerciseId}/peer-reviews/start`)
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

export const fetchGlossary = async (courseId: string): Promise<Array<Term>> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/glossary`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isTerm))
}

export const newGlossaryTerm = async (
  courseSlug: string,
  newAcronym: TermUpdate,
): Promise<void> => {
  await courseMaterialClient.post(`/courses/${courseSlug}/acronyms`, newAcronym)
}

export const fetchMentimeterEmbed = async (url: string): Promise<OEmbedResponse> => {
  const response = await courseMaterialClient.get(
    `/oembed/mentimeter?url=${encodeURIComponent(url)}`,
    { responseType: "json" },
  )
  return validateResponse(response, isOEmbedResponse)
}

export const fetchCourseReferences = async (courseId: string): Promise<MaterialReference[]> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/references`)
  return validateResponse(response, isArray(isMaterialReference))
}

export const postNewReference = async (
  courseId: string,
  data: NewMaterialReference,
): Promise<void> => {
  await courseMaterialClient.post(`/courses/${courseId}/references`, data)
}

export const isPageChapterFrontPage = async (pageId: string): Promise<IsChapterFrontPage> => {
  const response = await courseMaterialClient.get(`/pages/${pageId}/is-chapter-front-page`)
  return validateResponse(response, isIsChapterFrontPage)
}
