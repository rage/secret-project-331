import { isBoolean } from "lodash"

import {
  Chapter,
  Course,
  CourseBreadcrumbInfo,
  CourseInstance,
  CourseInstanceForm,
  CourseStructure,
  CourseUpdate,
  Exercise,
  ExerciseAnswersInCourseRequiringAttentionCount,
  ExerciseSlideSubmissionCount,
  ExerciseSlideSubmissionCountByWeekAndHour,
  ExerciseUserCounts,
  MaterialReference,
  NewCourse,
  NewMaterialReference,
  Page,
  PageVisitDatumSummaryByCourse,
  PageVisitDatumSummaryByCourseDeviceTypes,
  PageVisitDatumSummaryByCoursesCountries,
  PageVisitDatumSummaryByPages,
  Term,
  TermUpdate,
} from "../../shared-module/common/bindings"
import {
  isCourse,
  isCourseBreadcrumbInfo,
  isCourseInstance,
  isCourseStructure,
  isExercise,
  isExerciseAnswersInCourseRequiringAttentionCount,
  isExerciseSlideSubmissionCountByWeekAndHour,
  isExerciseUserCounts,
  isPageVisitDatumSummaryByCourse,
  isPageVisitDatumSummaryByCourseDeviceTypes,
  isPageVisitDatumSummaryByCoursesCountries,
  isPageVisitDatumSummaryByPages,
  isTerm,
} from "../../shared-module/common/bindings.guard"
import { isArray, isString, validateResponse } from "../../shared-module/common/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const getCourse = async (courseId: string): Promise<Course> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}`)
  return validateResponse(response, isCourse)
}

export const getCourseBreadCrumbInfo = async (courseId: string): Promise<CourseBreadcrumbInfo> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/breadcrumb-info`)
  return validateResponse(response, isCourseBreadcrumbInfo)
}

export const postNewCourse = async (data: NewCourse): Promise<Course> => {
  const response = await mainFrontendClient.post("/courses", data)
  return validateResponse(response, isCourse)
}

export const deleteCourse = async (courseId: string): Promise<Course> => {
  const response = await mainFrontendClient.delete(`/courses/${courseId}`)
  return validateResponse(response, isCourse)
}

export const fetchCourseLanguageVersions = async (courseId: string): Promise<Array<Course>> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/language-versions`)
  return validateResponse(response, isArray(isCourse))
}

export const postNewCourseTranslation = async (
  courseId: string,
  data: NewCourse,
): Promise<Course> => {
  const response = await mainFrontendClient.post(`/courses/${courseId}/language-versions`, data)
  return validateResponse(response, isCourse)
}

export const postNewCourseDuplicate = async (
  courseId: string,
  data: NewCourse,
): Promise<Course> => {
  const response = await mainFrontendClient.post(`/courses/${courseId}/duplicate`, data)
  return validateResponse(response, isCourse)
}

export const updateCourse = async (courseId: string, data: CourseUpdate): Promise<Course> => {
  const response = await mainFrontendClient.put(`/courses/${courseId}`, data)
  return validateResponse(response, isCourse)
}

export const fetchCourseDailySubmissionCounts = async (
  courseId: string,
): Promise<Array<ExerciseSlideSubmissionCount>> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/daily-submission-counts`)
  // return validateResponse(response, isArray(isSubmissionCount))
  // TODO: validating does not work because the date does not contain a time
  return response.data
}

export const fetchCourseDailyUserCountsWithSubmissions = async (
  courseId: string,
): Promise<Array<ExerciseSlideSubmissionCount>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/daily-users-who-have-submitted-something`,
  )
  // return validateResponse(response, isArray(isSubmissionCount))
  // TODO: validating does not work because the date does not contain a time
  return response.data
}

export const fetchCourseUsersCountByExercise = async (
  courseId: string,
): Promise<Array<ExerciseUserCounts>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/course-users-counts-by-exercise`,
  )
  return validateResponse(response, isArray(isExerciseUserCounts))
}

export const fetchCoursePageVisitDatumSummaries = async (
  courseId: string,
): Promise<Array<PageVisitDatumSummaryByCourse>> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/page-visit-datum-summary`)
  return validateResponse(response, isArray(isPageVisitDatumSummaryByCourse))
}

export const fetchCoursePageVisitDatumSummariesByCountry = async (
  courseId: string,
): Promise<Array<PageVisitDatumSummaryByCoursesCountries>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/page-visit-datum-summary-by-countries`,
  )
  return validateResponse(response, isArray(isPageVisitDatumSummaryByCoursesCountries))
}

export const fetchCoursePageVisitDatumSummariesByDeviceTypes = async (
  courseId: string,
): Promise<Array<PageVisitDatumSummaryByCourseDeviceTypes>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/page-visit-datum-summary-by-device-types`,
  )
  return validateResponse(response, isArray(isPageVisitDatumSummaryByCourseDeviceTypes))
}

export const fetchCoursePageVisitDatumSummaryByPages = async (
  courseId: string,
): Promise<Array<PageVisitDatumSummaryByPages>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/page-visit-datum-summary-by-pages`,
  )
  return validateResponse(response, isArray(isPageVisitDatumSummaryByPages))
}

export const fetchCourseExercises = async (courseId: string): Promise<Array<Exercise>> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/exercises`)
  return validateResponse(response, isArray(isExercise))
}

export const fetchCourseExercisesAndCountOfAnswersRequiringAttention = async (
  courseId: string,
): Promise<Array<ExerciseAnswersInCourseRequiringAttentionCount>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/exercises-and-count-of-answers-requiring-attention`,
  )
  return validateResponse(response, isArray(isExerciseAnswersInCourseRequiringAttentionCount))
}

export const fetchCourseStructure = async (courseId: string): Promise<CourseStructure> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/structure`)
  return validateResponse(response, isCourseStructure)
}

export const fetchCourseWeekdayHourSubmissionCounts = async (
  courseId: string,
): Promise<Array<ExerciseSlideSubmissionCountByWeekAndHour>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/weekday-hour-submission-counts`,
  )
  return validateResponse(response, isArray(isExerciseSlideSubmissionCountByWeekAndHour))
}

export const fetchCourseInstances = async (courseId: string): Promise<Array<CourseInstance>> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/course-instances`)
  return validateResponse(response, isArray(isCourseInstance))
}

export const newCourseInstance = async (
  courseId: string,
  update: CourseInstanceForm,
): Promise<string> => {
  const response = await mainFrontendClient.post(
    `/courses/${courseId}/new-course-instance`,
    update,
    { responseType: "json" },
  )
  return validateResponse(response, isString)
}

export const fetchGlossary = async (courseId: string): Promise<Array<Term>> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/glossary`)
  return validateResponse(response, isArray(isTerm))
}

export const postNewTerm = async (
  courseId: string,
  newTerm: string,
  newDefinition: string,
): Promise<void> => {
  const term: TermUpdate = {
    term: newTerm,
    definition: newDefinition,
  }
  await mainFrontendClient.post(`/courses/${courseId}/glossary`, term)
}

export const postNewPageOrdering = async (courseId: string, pages: Page[]): Promise<void> => {
  // To avoid too large payload errors, remove the content from the pages as it's not needed for this endpoint
  const pagesWithoutContent: Page[] = pages.map((page) => {
    return {
      ...page,
      content: null,
    }
  })
  await mainFrontendClient.post(`/courses/${courseId}/new-page-ordering`, pagesWithoutContent)
}

/** Teacher can use this to delete their own submissions, points, etc but they cannot use it to delete those things for other users */
export const teacherResetCourseProgressForThemselves = async (courseId: string): Promise<void> => {
  await mainFrontendClient.delete(
    `/courses/${courseId}/teacher-reset-course-progress-for-themselves`,
  )
}

/** Teacher can use this to delete submissions, points, etc for everyone. Can only be used for draft courses. */
export const teacherResetCourseProgressForEveryone = async (courseId: string): Promise<void> => {
  await mainFrontendClient.delete(`/courses/${courseId}/teacher-reset-course-progress-for-everyone`)
}

export const postNewChapterOrdering = async (
  courseId: string,
  chapters: Chapter[],
): Promise<void> => {
  await mainFrontendClient.post(`/courses/${courseId}/new-chapter-ordering`, chapters)
}

export const fetchCourseReferences = async (courseId: string): Promise<MaterialReference[]> => {
  return (await mainFrontendClient.get(`/courses/${courseId}/references`)).data
}

export const postNewReferences = async (
  courseId: string,
  data: NewMaterialReference[],
): Promise<void> => {
  await mainFrontendClient.post(`/courses/${courseId}/references`, data)
}

export const postReferenceUpdate = async (
  courseId: string,
  referenceId: string,
  reference: NewMaterialReference,
): Promise<void> => {
  await mainFrontendClient.post(`/courses/${courseId}/references/${referenceId}`, reference)
}

export const deleteReference = async (courseId: string, referenceId: string): Promise<void> => {
  await mainFrontendClient.delete(`/courses/${courseId}/references/${referenceId}`)
}

export const postUpdatePeerReviewQueueReviewsReceived = async (
  courseId: string,
): Promise<boolean> => {
  const res = await mainFrontendClient.post(
    `/courses/${courseId}/update-peer-review-queue-reviews-received`,
  )
  return validateResponse(res, isBoolean)
}
