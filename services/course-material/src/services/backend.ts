/* eslint-disable i18next/no-literal-string */
import { RawAxiosRequestHeaders } from "axios"
import { Dictionary } from "lodash"

import { courseMaterialClient } from "./courseMaterialClient"

import {
  ChaptersWithStatus,
  ChatbotConversation,
  ChatbotConversationInfo,
  CodeGiveawayStatus,
  Course,
  CourseBackgroundQuestionsAndAnswers,
  CourseInstance,
  CourseMaterialExercise,
  CourseMaterialPeerOrSelfReviewDataWithToken,
  CourseMaterialPeerOrSelfReviewSubmission,
  CourseModuleCompletion,
  CoursePageWithUserData,
  CustomViewExerciseSubmissions,
  ExamData,
  ExamEnrollment,
  ExerciseSlideSubmissionAndUserExerciseStateList,
  IsChapterFrontPage,
  MaterialReference,
  NewFeedback,
  NewMaterialReference,
  NewProposedPageEdits,
  NewResearchFormQuestionAnswer,
  OEmbedResponse,
  Page,
  PageAudioFile,
  PageChapterAndCourseInformation,
  PageNavigationInformation,
  PageSearchResult,
  PageWithExercises,
  PartnersBlock,
  PeerOrSelfReviewsReceived,
  PrivacyLink,
  ResearchForm,
  ResearchFormQuestion,
  ResearchFormQuestionAnswer,
  SaveCourseSettingsPayload,
  SearchRequest,
  StudentCountry,
  StudentExerciseSlideSubmission,
  StudentExerciseSlideSubmissionResult,
  Term,
  TermUpdate,
  UserCourseInstanceChapterExerciseProgress,
  UserCourseInstanceChapterProgress,
  UserCourseInstanceProgress,
  UserCourseSettings,
  UserModuleCompletionStatus,
} from "@/shared-module/common/bindings"
import {
  isChaptersWithStatus,
  isChatbotConversation,
  isChatbotConversationInfo,
  isCodeGiveawayStatus,
  isCourse,
  isCourseBackgroundQuestionsAndAnswers,
  isCourseInstance,
  isCourseMaterialExercise,
  isCourseMaterialPeerOrSelfReviewDataWithToken,
  isCourseModuleCompletion,
  isCoursePageWithUserData,
  isCustomViewExerciseSubmissions,
  isExamData,
  isExerciseSlideSubmissionAndUserExerciseStateList,
  isIsChapterFrontPage,
  isMaterialReference,
  isOEmbedResponse,
  isPage,
  isPageAudioFile,
  isPageChapterAndCourseInformation,
  isPageNavigationInformation,
  isPageSearchResult,
  isPageWithExercises,
  isPartnersBlock,
  isPeerOrSelfReviewsReceived,
  isPrivacyLink,
  isResearchForm,
  isResearchFormQuestion,
  isResearchFormQuestionAnswer,
  isStudentCountry,
  isStudentExerciseSlideSubmissionResult,
  isTerm,
  isUserCourseInstanceChapterExerciseProgress,
  isUserCourseInstanceChapterProgress,
  isUserCourseInstanceProgress,
  isUserCourseSettings,
  isUserModuleCompletionStatus,
} from "@/shared-module/common/bindings.guard"
import {
  isArray,
  isNull,
  isNumber,
  isObjectMap,
  isString,
  isUnion,
  isUuid,
  validateResponse,
} from "@/shared-module/common/utils/fetching"

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
  const response = await courseMaterialClient.get(`/courses/${courseId}/course-instances`)
  return validateResponse(response, isArray(isCourseInstance))
}

export const fetchBackgroundQuestionsAndAnswers = async (
  courseInstanceId: string,
): Promise<CourseBackgroundQuestionsAndAnswers> => {
  const response = await courseMaterialClient.get(
    `/course-instances/${courseInstanceId}/background-questions-and-answers`,
  )
  return validateResponse(response, isCourseBackgroundQuestionsAndAnswers)
}

export const postSaveCourseSettings = async (
  courseInstanceId: string,
  payload: SaveCourseSettingsPayload,
): Promise<void> => {
  await courseMaterialClient.post(
    `/course-instances/${courseInstanceId}/save-course-settings`,
    payload,
  )
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

export const fetchPeerOrSelfReviewDataByExerciseId = async (
  id: string,
): Promise<CourseMaterialPeerOrSelfReviewDataWithToken> => {
  const response = await courseMaterialClient.get(`/exercises/${id}/peer-review`, {
    responseType: "json",
  })
  return validateResponse(response, isCourseMaterialPeerOrSelfReviewDataWithToken)
}

export const fetchPeerReviewDataReceivedByExerciseId = async (
  id: string,
  submissionId: string,
): Promise<PeerOrSelfReviewsReceived> => {
  const response = await courseMaterialClient.get(
    `/exercises/${id}/exercise-slide-submission/${submissionId}/peer-or-self-reviews-received`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isPeerOrSelfReviewsReceived)
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
  searchRequest: SearchRequest,
  courseId: string,
): Promise<Array<PageSearchResult>> => {
  const response = await courseMaterialClient.post(
    `/courses/${courseId}/search-pages-with-phrase`,
    searchRequest,
  )
  return validateResponse(response, isArray(isPageSearchResult))
}

export const searchPagesWithWords = async (
  searchRequest: SearchRequest,
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

export const postPeerOrSelfReviewSubmission = async (
  exerciseId: string,
  peerOrSelfReviewSubmission: CourseMaterialPeerOrSelfReviewSubmission,
): Promise<void> => {
  await courseMaterialClient.post(
    `/exercises/${exerciseId}/peer-or-self-reviews`,
    peerOrSelfReviewSubmission,
    {
      responseType: "json",
    },
  )
}

export const postStartPeerOrSelfReview = async (exerciseId: string): Promise<void> => {
  await courseMaterialClient.post(`/exercises/${exerciseId}/peer-or-self-reviews/start`)
}

export const fetchExamEnrollment = async (examId: string): Promise<ExamEnrollment | null> => {
  const response = await courseMaterialClient.get(`/exams/${examId}/enrollment`)
  return response.data
}

export const enrollInExam = async (examId: string, is_teacher_testing: boolean): Promise<void> => {
  await courseMaterialClient.post(
    `/exams/${examId}/enroll`,
    { is_teacher_testing },
    {
      responseType: "json",
    },
  )
}

export const fetchExam = async (examId: string): Promise<ExamData> => {
  const response = await courseMaterialClient.get(`/exams/${examId}`, { responseType: "json" })
  return validateResponse(response, isExamData)
}

export const fetchExamForTesting = async (examId: string): Promise<ExamData> => {
  const response = await courseMaterialClient.get(
    `/exams/testexam/${examId}/fetch-exam-for-testing`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isExamData)
}

export const resetExamProgress = async (examId: string): Promise<void> => {
  const response = await courseMaterialClient.post(`/exams/testexam/${examId}/reset-exam-progress`)
  return response.data
}

export const updateShowExerciseAnswers = async (
  examId: string,
  showExerciseAnswers: boolean,
): Promise<void> => {
  await courseMaterialClient.post(
    `/exams/testexam/${examId}/update-show-exercise-answers`,
    { show_exercise_answers: showExerciseAnswers },
    {
      responseType: "json",
    },
  )
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

export const fetchPageAudioFiles = async (pageId: string): Promise<PageAudioFile[]> => {
  const response = await courseMaterialClient.get(`/page_audio/${pageId}/files`)
  return validateResponse(response, isArray(isPageAudioFile))
}

export const fetchCourseLanguageVersions = async (courseId: string): Promise<Array<Course>> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/language-versions`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isCourse))
}

export const postStudentCountry = async (
  course_id: string,
  course_instance_id: string,
  country_code: string,
): Promise<void> => {
  await courseMaterialClient.post(
    `/courses/${course_id}/course-instances/${course_instance_id}/student-countries/${country_code}`,
  )
}

export const fetchStudentCountry = async (course_instance_id: string): Promise<StudentCountry> => {
  const response = await courseMaterialClient.get(
    `/courses/${course_instance_id}/student-country`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isStudentCountry)
}

export const fetchStudentCountries = async (
  course_id: string,
  course_instance_id: string,
): Promise<{ [key: string]: number }> => {
  const response = await courseMaterialClient.get(
    `/courses/${course_id}/course-instances/${course_instance_id}/student-countries`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isObjectMap(isNumber))
}

export const fetchPageByCourseIdAndLanguageGroupId = async (
  course_id: string,
  page_language_group_id: string,
): Promise<Page> => {
  const response = await courseMaterialClient.get(
    `/courses/${course_id}/pages/by-language-group-id/${page_language_group_id}`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isPage)
}

export const fetchResearchFormWithCourseId = async (
  courseId: string,
): Promise<ResearchForm | null> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/research-consent-form`, {
    responseType: "json",
  })
  return validateResponse(response, isUnion(isResearchForm, isNull))
}

export const fetchResearchFormQuestionsWithCourseId = async (
  course_id: string,
): Promise<Array<ResearchFormQuestion>> => {
  const response = await courseMaterialClient.get(
    `/courses/${course_id}/research-consent-form-questions`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isArray(isResearchFormQuestion))
}

export const fetchResearchFormAnswersWithUserId = async (
  course_id: string,
): Promise<Array<ResearchFormQuestionAnswer>> => {
  const response = await courseMaterialClient.get(
    `/courses/${course_id}/research-consent-form-user-answers`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isArray(isResearchFormQuestionAnswer))
}

export const getChatbotConfigurationForCourse = async (
  course_id: string,
): Promise<string | null> => {
  const response = await courseMaterialClient.get(`/chatbot/for-course/${course_id}`, {
    responseType: "json",
  })
  return validateResponse(response, isUnion(isString, isNull))
}

export const postResearchFormUserAnswer = async (
  courseId: string,
  user_id: string,
  research_form_question_id: string,
  research_consent: boolean,
): Promise<string> => {
  const answer: NewResearchFormQuestionAnswer = {
    user_id,
    research_form_question_id,
    research_consent,
  }
  const response = await courseMaterialClient.post(
    `/courses/${courseId}/research-consent-form-questions-answer`,
    answer,
  )
  return validateResponse(response, isString)
}

export const fetchCourseModuleExercisesAndSubmissionsByType = async (
  courseModuleId: string,
  exercise_type: string,
  courseInstanceId: string,
): Promise<CustomViewExerciseSubmissions> => {
  const res = await courseMaterialClient.get(
    `/course-modules/${courseModuleId}/exercise-tasks/${exercise_type}/${courseInstanceId}`,
    {
      responseType: "json",
    },
  )
  return validateResponse(res, isCustomViewExerciseSubmissions)
}

export const fetchModuleIdByChapterId = async (chapter_id: string) => {
  const res = await courseMaterialClient.get(`/course-modules/chapter/${chapter_id}`, {
    responseType: "json",
  })
  return validateResponse(res, isUuid)
}

export const fetchDefaultModuleIdByCourseId = async (course_id: string) => {
  const res = await courseMaterialClient.get(`/course-modules/course/${course_id}`, {
    responseType: "json",
  })
  return validateResponse(res, isUuid)
}

export const getAllCourseModuleCompletionsForUserAndCourseInstance = async (
  courseInstanceId: string,
  userId: string,
): Promise<CourseModuleCompletion[]> => {
  const response = await courseMaterialClient.get(
    `/course-instances/${courseInstanceId}/course-module-completions/${userId}`,
  )
  return validateResponse(response, isArray(isCourseModuleCompletion))
}

export const fetchExerciseSubmissions = async (
  exerciseId: string,
  page: number,
  limit: number,
): Promise<ExerciseSlideSubmissionAndUserExerciseStateList> => {
  const response = await courseMaterialClient.get(
    `/exams/${exerciseId}/submissions?page=${page}&limit=${limit}`,
  )
  return validateResponse(response, isExerciseSlideSubmissionAndUserExerciseStateList)
}

export const endExamTime = async (examId: string): Promise<void> => {
  const response = await courseMaterialClient.post(`/exams/${examId}/end-exam-time`)
  return response.data
}

export const getChatbotCurrentConversationInfo = async (
  chatBotConfigurationId: string,
): Promise<ChatbotConversationInfo> => {
  const response = await courseMaterialClient.get(
    `/chatbot/${chatBotConfigurationId}/conversations/current`,
  )
  return validateResponse(response, isChatbotConversationInfo)
}

export const newChatbotConversation = async (
  chatBotConfigurationId: string,
): Promise<ChatbotConversation> => {
  const response = await courseMaterialClient.post(
    `/chatbot/${chatBotConfigurationId}/conversations/new`,
  )
  return validateResponse(response, isChatbotConversation)
}

export const sendChatbotMessage = async (
  chatBotConfigurationId: string,
  conversationId: string,
  message: string,
): Promise<ReadableStream<Uint8Array>> => {
  const url = `/api/v0/course-material/chatbot/${chatBotConfigurationId}/conversations/${conversationId}/send-message`

  const requestOptions: RequestInit = {
    method: "POST",
    body: JSON.stringify(message),
    headers: {
      "Content-Type": "application/json",
    },
  }

  const res = await fetch(url, requestOptions)

  if (res.status !== 200) {
    let errorDetails: string
    try {
      const errorData = await res.json()
      errorDetails = JSON.stringify(errorData)
    } catch {
      errorDetails = await res.text()
    }

    throw new Error(`Request failed with status ${res.status}: ${errorDetails}`)
  }

  const stream = res.body

  if (!stream) {
    throw new Error("No response body")
  }

  return stream
}

/**
 GET /api/v0/course-material/code-giveaways/:id/status - Returns information about a code giveaway.
*/
export const getCodeGiveawayStatus = async (id: string): Promise<CodeGiveawayStatus> => {
  const response = await courseMaterialClient.get(`/code-giveaways/${id}/status`)
  return validateResponse(response, isCodeGiveawayStatus)
}

export const claimCodeFromCodeGiveaway = async (id: string): Promise<string> => {
  const response = await courseMaterialClient.post(`/code-giveaways/${id}/claim`)
  return validateResponse(response, isString)
}

export const fetchPartnersBlock = async (courseId: string): Promise<PartnersBlock> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/partners-block`)
  return validateResponse(response, isPartnersBlock)
}

export const fetchPrivacyLink = async (courseId: string): Promise<PrivacyLink> => {
  const response = await courseMaterialClient.get(`/courses/${courseId}/privacy-link`)
  return validateResponse(response, isPrivacyLink)
}
