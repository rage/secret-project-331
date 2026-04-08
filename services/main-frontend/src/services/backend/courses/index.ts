import { queryOptions } from "@tanstack/react-query"
import { isBoolean } from "lodash"

import { downloadTextFile } from "../downloads"
import { validateGeneratedData } from "../generated"

import {
  approveCourseSuspectedCheaterMutation,
  archiveCourseSuspectedCheaterMutation,
  createCourseCopyMutation,
  createCourseInstanceMutation,
  createCourseMutation,
  createCourseReferencesMutation,
  deleteCourseMutation,
  deleteCoursePartnersBlockMutation,
  deleteCourseReferenceMutation,
  getCourseBreadcrumbInfoOptions as getCourseBreadcrumbInfoGeneratedOptions,
  getCourseByJoinCodeOptions as getCourseByJoinCodeGeneratedOptions,
  getCourseDailySubmissionCountsOptions as getCourseDailySubmissionCountsGeneratedOptions,
  getCourseDailyUsersWhoSubmittedSomethingOptions as getCourseDailyUsersWhoSubmittedSomethingGeneratedOptions,
  getCourseExercisesAndAnswersRequiringAttentionCountsOptions as getCourseExercisesAndAnswersRequiringAttentionCountsGeneratedOptions,
  getCourseExercisesOptions as getCourseExercisesGeneratedOptions,
  getCourseExerciseStatusesForUserOptions as getCourseExerciseStatusesForUserGeneratedOptions,
  getCourseOptions as getCourseGeneratedOptions,
  getCourseInstancesOptions as getCourseInstancesGeneratedOptions,
  getCourseLanguageVersionsOptions as getCourseLanguageVersionsGeneratedOptions,
  getCourseModuleCompletionsForUserOptions as getCourseModuleCompletionsForUserGeneratedOptions,
  getCoursePageVisitDatumSummaryByCountriesOptions as getCoursePageVisitDatumSummaryByCountriesGeneratedOptions,
  getCoursePageVisitDatumSummaryByDeviceTypesOptions as getCoursePageVisitDatumSummaryByDeviceTypesGeneratedOptions,
  getCoursePageVisitDatumSummaryByPagesOptions as getCoursePageVisitDatumSummaryByPagesGeneratedOptions,
  getCoursePageVisitDatumSummaryOptions as getCoursePageVisitDatumSummaryGeneratedOptions,
  getCoursePartnersBlockOptions as getCoursePartnersBlockGeneratedOptions,
  getCourseProgressForUserOptions as getCourseProgressForUserGeneratedOptions,
  getCourseReferencesOptions as getCourseReferencesGeneratedOptions,
  getCourseStructureOptions as getCourseStructureGeneratedOptions,
  getCourseSuspectedCheatersOptions as getCourseSuspectedCheatersGeneratedOptions,
  getCourseThresholdsOptions as getCourseThresholdsGeneratedOptions,
  getCourseUsersCountsByExerciseOptions as getCourseUsersCountsByExerciseGeneratedOptions,
  getCourseUserSettingsForUserOptions as getCourseUserSettingsForUserGeneratedOptions,
  getCourseWeekdayHourSubmissionCountsOptions as getCourseWeekdayHourSubmissionCountsGeneratedOptions,
  joinCourseWithJoinCodeMutation,
  resetCourseProgressForEveryoneMutation,
  resetCourseProgressForTeacherThemselvesMutation,
  setCourseJoinCodeMutation,
  updateCourseChapterOrderingMutation,
  updateCourseMutation,
  updateCoursePageOrderingMutation,
  updateCoursePeerReviewQueueReviewsReceivedMutation,
  updateCourseReferenceMutation,
  upsertCoursePartnersBlockMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  approveCourseSuspectedCheater,
  archiveCourseSuspectedCheater,
  createCourse,
  createCourseCopy as createCourseCopyFromApi,
  createCourseInstance as createCourseInstanceFromApi,
  createCourseReferences,
  deleteCourse as deleteCourseFromApi,
  deleteCoursePartnersBlock,
  deleteCourseReference,
  exportCourseExerciseTasksCsv,
  exportCourseInstancesCsv,
  exportCourseSubmissionsCsv,
  exportCourseUserConsentsCsv,
  exportCourseUserDetailsCsv,
  exportCourseUserExerciseStatesCsv,
  getCourseBreadcrumbInfo as getCourseBreadcrumbInfoFromApi,
  getCourseByJoinCode as getCourseByJoinCodeFromApi,
  getCourseDailySubmissionCounts as getCourseDailySubmissionCountsFromApi,
  getCourseDailyUsersWhoSubmittedSomething as getCourseDailyUsersWhoSubmittedSomethingFromApi,
  getCourseExercisesAndAnswersRequiringAttentionCounts as getCourseExercisesAndAnswersRequiringAttentionCountsFromApi,
  getCourseExercises as getCourseExercisesFromApi,
  getCourseExerciseStatusesForUser as getCourseExerciseStatusesForUserFromApi,
  getCourse as getCourseFromApi,
  getCourseInstances as getCourseInstancesFromApi,
  getCourseLanguageVersions as getCourseLanguageVersionsFromApi,
  getCourseModuleCompletionsForUser as getCourseModuleCompletionsForUserFromApi,
  getCoursePageVisitDatumSummaryByCountries as getCoursePageVisitDatumSummaryByCountriesFromApi,
  getCoursePageVisitDatumSummaryByDeviceTypes as getCoursePageVisitDatumSummaryByDeviceTypesFromApi,
  getCoursePageVisitDatumSummaryByPages as getCoursePageVisitDatumSummaryByPagesFromApi,
  getCoursePageVisitDatumSummary as getCoursePageVisitDatumSummaryFromApi,
  getCoursePartnersBlock as getCoursePartnersBlockFromApi,
  getCourseProgressForUser as getCourseProgressForUserFromApi,
  getCourseReferences as getCourseReferencesFromApi,
  getCourseStructure as getCourseStructureFromApi,
  getCourseSuspectedCheaters as getCourseSuspectedCheatersFromApi,
  getCourseThresholds as getCourseThresholdsFromApi,
  getCourseUsersCountsByExercise as getCourseUsersCountsByExerciseFromApi,
  getCourseUserSettingsForUser as getCourseUserSettingsForUserFromApi,
  getCourseWeekdayHourSubmissionCounts as getCourseWeekdayHourSubmissionCountsFromApi,
  joinCourseWithJoinCode,
  resetCourseProgressForEveryone,
  resetCourseProgressForTeacherThemselves,
  setCourseJoinCode,
  updateCourseChapterOrdering,
  updateCourse as updateCourseFromApi,
  updateCoursePageOrdering,
  updateCoursePeerReviewQueueReviewsReceived,
  updateCourseReference,
  upsertCoursePartnersBlock,
} from "@/generated/api/sdk.generated"
import type { Term } from "@/generated/api/types.generated"
import { createGlossaryTerm, fetchGlossaryFromApi } from "@/services/api/client"
import {
  Chapter,
  CopyCourseRequest,
  Course,
  CourseBreadcrumbInfo,
  CourseInstance,
  CourseInstanceForm,
  CourseModuleCompletion,
  CourseStructure,
  CourseUpdate,
  Exercise,
  ExerciseAnswersInCourseRequiringAttentionCount,
  ExerciseSlideSubmissionCount,
  ExerciseSlideSubmissionCountByWeekAndHour,
  ExerciseStatusSummaryForUser,
  ExerciseUserCounts,
  MaterialReference,
  NewCourse,
  NewMaterialReference,
  Page,
  PageVisitDatumSummaryByCourse,
  PageVisitDatumSummaryByCourseDeviceTypes,
  PageVisitDatumSummaryByCoursesCountries,
  PageVisitDatumSummaryByPages,
  PartnersBlock,
  SuspectedCheaters,
  ThresholdData,
  UserCourseProgress,
  UserCourseSettings,
} from "@/shared-module/common/bindings"
import {
  isCourse,
  isCourseBreadcrumbInfo,
  isCourseInstance,
  isCourseModuleCompletion,
  isCourseStructure,
  isExercise,
  isExerciseAnswersInCourseRequiringAttentionCount,
  isExerciseSlideSubmissionCount,
  isExerciseSlideSubmissionCountByWeekAndHour,
  isExerciseStatusSummaryForUser,
  isExerciseUserCounts,
  isMaterialReference,
  isPageVisitDatumSummaryByCourse,
  isPageVisitDatumSummaryByCourseDeviceTypes,
  isPageVisitDatumSummaryByCoursesCountries,
  isPageVisitDatumSummaryByPages,
  isPartnersBlock,
  isSuspectedCheaters,
  isUserCourseProgress,
  isUserCourseSettings,
} from "@/shared-module/common/bindings.guard"
import { isArray, isNull, isString, isUnion } from "@/shared-module/common/utils/fetching"

interface Threshold {
  id: string
  course_module_id: string
  duration_seconds: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

const isThreshold = (data: unknown): data is Threshold =>
  typeof data === "object" &&
  data !== null &&
  "course_module_id" in data &&
  "duration_seconds" in data

export const getCourse = async (courseId: string): Promise<Course> => {
  const data = await getCourseFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isCourse)
}

export const getCourseOptions = (courseId: string) =>
  queryOptions({
    ...getCourseGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): Course => validateGeneratedData(data, isCourse),
  })

export const getUserProgressForCourse = async (
  courseId: string,
  userId: string,
): Promise<UserCourseProgress[]> => {
  const data = await getCourseProgressForUserFromApi({
    path: {
      course_id: courseId,
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isUserCourseProgress))
}

export const getCourseProgressForUserOptions = (courseId: string, userId: string) =>
  queryOptions({
    ...getCourseProgressForUserGeneratedOptions({
      path: {
        course_id: courseId,
        user_id: userId,
      },
    }),
    select: (data): UserCourseProgress[] =>
      validateGeneratedData(data, isArray(isUserCourseProgress)),
  })

export const getAllExerciseStatusSummariesForUserAndCourse = async (
  courseId: string,
  userId: string,
): Promise<ExerciseStatusSummaryForUser[]> => {
  const data = await getCourseExerciseStatusesForUserFromApi({
    path: {
      course_id: courseId,
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExerciseStatusSummaryForUser))
}

export const getCourseExerciseStatusesForUserOptions = (courseId: string, userId: string) =>
  queryOptions({
    ...getCourseExerciseStatusesForUserGeneratedOptions({
      path: {
        course_id: courseId,
        user_id: userId,
      },
    }),
    select: (data): ExerciseStatusSummaryForUser[] =>
      validateGeneratedData(data, isArray(isExerciseStatusSummaryForUser)),
  })

export const getAllCourseModuleCompletionsForUserAndCourse = async (
  courseId: string,
  userId: string,
): Promise<CourseModuleCompletion[]> => {
  const data = await getCourseModuleCompletionsForUserFromApi({
    path: {
      course_id: courseId,
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourseModuleCompletion))
}

export const getCourseModuleCompletionsForUserOptions = (courseId: string, userId: string) =>
  queryOptions({
    ...getCourseModuleCompletionsForUserGeneratedOptions({
      path: {
        course_id: courseId,
        user_id: userId,
      },
    }),
    select: (data): CourseModuleCompletion[] =>
      validateGeneratedData(data, isArray(isCourseModuleCompletion)),
  })

export const getCourseBreadCrumbInfo = async (courseId: string): Promise<CourseBreadcrumbInfo> => {
  const data = await getCourseBreadcrumbInfoFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isCourseBreadcrumbInfo)
}

export const getCourseBreadCrumbInfoOptions = (courseId: string) =>
  queryOptions({
    ...getCourseBreadcrumbInfoGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): CourseBreadcrumbInfo => validateGeneratedData(data, isCourseBreadcrumbInfo),
  })

export const deleteCourse = async (courseId: string): Promise<Course> => {
  const data = await deleteCourseFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isCourse)
}

export const deleteCourseMutationOptions = () => deleteCourseMutation()

export const fetchCourseLanguageVersions = async (courseId: string): Promise<Array<Course>> => {
  const data = await getCourseLanguageVersionsFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourse))
}

export const getCourseLanguageVersionsOptions = (courseId: string) =>
  queryOptions({
    ...getCourseLanguageVersionsGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): Course[] => validateGeneratedData(data, isArray(isCourse)),
  })

export const updateCourse = async (courseId: string, data: CourseUpdate): Promise<Course> => {
  const response = await updateCourseFromApi({
    body: data,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(response, isCourse)
}

export const updateCourseMutationOptions = () => updateCourseMutation()

export const fetchCourseDailySubmissionCounts = async (
  courseId: string,
): Promise<Array<ExerciseSlideSubmissionCount>> => {
  const data = await getCourseDailySubmissionCountsFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExerciseSlideSubmissionCount))
}

export const getCourseDailySubmissionCountsOptions = (courseId: string) =>
  queryOptions({
    ...getCourseDailySubmissionCountsGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): ExerciseSlideSubmissionCount[] =>
      validateGeneratedData(data, isArray(isExerciseSlideSubmissionCount)),
  })

export const fetchCourseDailyUserCountsWithSubmissions = async (
  courseId: string,
): Promise<Array<ExerciseSlideSubmissionCount>> => {
  const data = await getCourseDailyUsersWhoSubmittedSomethingFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExerciseSlideSubmissionCount))
}

export const getCourseDailyUsersWhoSubmittedSomethingOptions = (courseId: string) =>
  queryOptions({
    ...getCourseDailyUsersWhoSubmittedSomethingGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): ExerciseSlideSubmissionCount[] =>
      validateGeneratedData(data, isArray(isExerciseSlideSubmissionCount)),
  })

export const fetchCourseUsersCountByExercise = async (
  courseId: string,
): Promise<Array<ExerciseUserCounts>> => {
  const data = await getCourseUsersCountsByExerciseFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExerciseUserCounts))
}

export const getCourseUsersCountByExerciseOptions = (courseId: string) =>
  queryOptions({
    ...getCourseUsersCountsByExerciseGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): ExerciseUserCounts[] =>
      validateGeneratedData(data, isArray(isExerciseUserCounts)),
  })

export const fetchCoursePageVisitDatumSummaries = async (
  courseId: string,
): Promise<Array<PageVisitDatumSummaryByCourse>> => {
  const data = await getCoursePageVisitDatumSummaryFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isPageVisitDatumSummaryByCourse))
}

export const getCoursePageVisitDatumSummaryOptions = (courseId: string) =>
  queryOptions({
    ...getCoursePageVisitDatumSummaryGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): PageVisitDatumSummaryByCourse[] =>
      validateGeneratedData(data, isArray(isPageVisitDatumSummaryByCourse)),
  })

export const fetchCoursePageVisitDatumSummariesByCountry = async (
  courseId: string,
): Promise<Array<PageVisitDatumSummaryByCoursesCountries>> => {
  const data = await getCoursePageVisitDatumSummaryByCountriesFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isPageVisitDatumSummaryByCoursesCountries))
}

export const getCoursePageVisitDatumSummaryByCountriesOptions = (courseId: string) =>
  queryOptions({
    ...getCoursePageVisitDatumSummaryByCountriesGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): PageVisitDatumSummaryByCoursesCountries[] =>
      validateGeneratedData(data, isArray(isPageVisitDatumSummaryByCoursesCountries)),
  })

export const fetchCoursePageVisitDatumSummariesByDeviceTypes = async (
  courseId: string,
): Promise<Array<PageVisitDatumSummaryByCourseDeviceTypes>> => {
  const data = await getCoursePageVisitDatumSummaryByDeviceTypesFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isPageVisitDatumSummaryByCourseDeviceTypes))
}

export const getCoursePageVisitDatumSummaryByDeviceTypesOptions = (courseId: string) =>
  queryOptions({
    ...getCoursePageVisitDatumSummaryByDeviceTypesGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): PageVisitDatumSummaryByCourseDeviceTypes[] =>
      validateGeneratedData(data, isArray(isPageVisitDatumSummaryByCourseDeviceTypes)),
  })

export const fetchCoursePageVisitDatumSummaryByPages = async (
  courseId: string,
): Promise<Array<PageVisitDatumSummaryByPages>> => {
  const data = await getCoursePageVisitDatumSummaryByPagesFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isPageVisitDatumSummaryByPages))
}

export const getCoursePageVisitDatumSummaryByPagesOptions = (courseId: string) =>
  queryOptions({
    ...getCoursePageVisitDatumSummaryByPagesGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): PageVisitDatumSummaryByPages[] =>
      validateGeneratedData(data, isArray(isPageVisitDatumSummaryByPages)),
  })

export const fetchCourseExercises = async (courseId: string): Promise<Array<Exercise>> => {
  const data = await getCourseExercisesFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExercise))
}

export const getCourseExercisesOptions = (courseId: string) =>
  queryOptions({
    ...getCourseExercisesGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): Exercise[] => validateGeneratedData(data, isArray(isExercise)),
  })

export const fetchCourseExercisesAndCountOfAnswersRequiringAttention = async (
  courseId: string,
): Promise<Array<ExerciseAnswersInCourseRequiringAttentionCount>> => {
  const data = await getCourseExercisesAndAnswersRequiringAttentionCountsFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExerciseAnswersInCourseRequiringAttentionCount))
}

export const getCourseExercisesAndAnswersRequiringAttentionCountsOptions = (courseId: string) =>
  queryOptions({
    ...getCourseExercisesAndAnswersRequiringAttentionCountsGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): ExerciseAnswersInCourseRequiringAttentionCount[] =>
      validateGeneratedData(data, isArray(isExerciseAnswersInCourseRequiringAttentionCount)),
  })

export const fetchCourseStructure = async (courseId: string): Promise<CourseStructure> => {
  const data = await getCourseStructureFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isCourseStructure)
}

export const getCourseStructureOptions = (courseId: string) =>
  queryOptions({
    ...getCourseStructureGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): CourseStructure => validateGeneratedData(data, isCourseStructure),
  })

export const fetchCourseWeekdayHourSubmissionCounts = async (
  courseId: string,
): Promise<Array<ExerciseSlideSubmissionCountByWeekAndHour>> => {
  const data = await getCourseWeekdayHourSubmissionCountsFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExerciseSlideSubmissionCountByWeekAndHour))
}

export const getCourseWeekdayHourSubmissionCountsOptions = (courseId: string) =>
  queryOptions({
    ...getCourseWeekdayHourSubmissionCountsGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): ExerciseSlideSubmissionCountByWeekAndHour[] =>
      validateGeneratedData(data, isArray(isExerciseSlideSubmissionCountByWeekAndHour)),
  })

export const fetchCourseInstances = async (courseId: string): Promise<Array<CourseInstance>> => {
  const data = await getCourseInstancesFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourseInstance))
}

export const getCourseInstancesOptions = (courseId: string) =>
  queryOptions({
    ...getCourseInstancesGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): CourseInstance[] => validateGeneratedData(data, isArray(isCourseInstance)),
  })

export const newCourseInstance = async (
  courseId: string,
  update: CourseInstanceForm,
): Promise<string> => {
  return await createCourseInstanceFromApi({
    body: update,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const createCourseInstanceMutationOptions = () => createCourseInstanceMutation()

export const fetchGlossary = async (courseId: string): Promise<Array<Term>> => {
  return fetchGlossaryFromApi(courseId)
}

export const postNewTerm = async (
  courseId: string,
  newTerm: string,
  newDefinition: string,
): Promise<void> => {
  await createGlossaryTerm(courseId, {
    definition: newDefinition,
    term: newTerm,
  })
}

export const postNewPageOrdering = async (courseId: string, pages: Page[]): Promise<void> => {
  const pagesWithoutContent: Page[] = pages.map((page) => ({
    ...page,
    content: null,
  }))

  await updateCoursePageOrdering({
    body: pagesWithoutContent,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const updateCoursePageOrderingMutationOptions = () => updateCoursePageOrderingMutation()

export const teacherResetCourseProgressForThemselves = async (courseId: string): Promise<void> => {
  await resetCourseProgressForTeacherThemselves({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const resetCourseProgressForTeacherThemselvesMutationOptions = () =>
  resetCourseProgressForTeacherThemselvesMutation()

export const teacherResetCourseProgressForEveryone = async (courseId: string): Promise<void> => {
  await resetCourseProgressForEveryone({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const resetCourseProgressForEveryoneMutationOptions = () =>
  resetCourseProgressForEveryoneMutation()

export const postNewChapterOrdering = async (
  courseId: string,
  chapters: Chapter[],
): Promise<void> => {
  await updateCourseChapterOrdering({
    body: chapters,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const updateCourseChapterOrderingMutationOptions = () =>
  updateCourseChapterOrderingMutation()

export const fetchCourseReferences = async (courseId: string): Promise<MaterialReference[]> => {
  const data = await getCourseReferencesFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isMaterialReference))
}

export const getCourseReferencesOptions = (courseId: string) =>
  queryOptions({
    ...getCourseReferencesGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): MaterialReference[] =>
      validateGeneratedData(data, isArray(isMaterialReference)),
  })

export const postNewReferences = async (
  courseId: string,
  data: NewMaterialReference[],
): Promise<void> => {
  await createCourseReferences({
    body: data,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const createCourseReferencesMutationOptions = () => createCourseReferencesMutation()

export const postReferenceUpdate = async (
  courseId: string,
  referenceId: string,
  reference: NewMaterialReference,
): Promise<void> => {
  await updateCourseReference({
    body: reference,
    path: {
      course_id: courseId,
      reference_id: referenceId,
    },
    throwOnError: true,
  })
}

export const updateCourseReferenceMutationOptions = () => updateCourseReferenceMutation()

export const deleteReference = async (courseId: string, referenceId: string): Promise<void> => {
  await deleteCourseReference({
    path: {
      course_id: courseId,
      reference_id: referenceId,
    },
    throwOnError: true,
  })
}

export const deleteCourseReferenceMutationOptions = () => deleteCourseReferenceMutation()

export const postUpdatePeerReviewQueueReviewsReceived = async (
  courseId: string,
): Promise<boolean> => {
  const data = await updateCoursePeerReviewQueueReviewsReceived({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isBoolean)
}

export const updateCoursePeerReviewQueueReviewsReceivedMutationOptions = () =>
  updateCoursePeerReviewQueueReviewsReceivedMutation()

export const getAllThresholds = async (courseId: string): Promise<Threshold[]> => {
  const data = await getCourseThresholdsFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isThreshold))
}

export const getCourseThresholdsOptions = (courseId: string) =>
  queryOptions({
    ...getCourseThresholdsGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): Threshold[] => validateGeneratedData(data, isArray(isThreshold)),
  })

export const fetchSuspectedCheaters = async (
  courseId: string,
  archive: boolean,
): Promise<SuspectedCheaters[]> => {
  const data = await getCourseSuspectedCheatersFromApi({
    path: {
      course_id: courseId,
    },
    query: {
      archive,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isSuspectedCheaters))
}

export const getCourseSuspectedCheatersOptions = (courseId: string, archive: boolean) =>
  queryOptions({
    ...getCourseSuspectedCheatersGeneratedOptions({
      path: {
        course_id: courseId,
      },
      query: {
        archive,
      },
    }),
    select: (data): SuspectedCheaters[] =>
      validateGeneratedData(data, isArray(isSuspectedCheaters)),
  })

export const archiveSuspectedCheaters = async (courseId: string, id: string): Promise<void> => {
  await archiveCourseSuspectedCheater({
    path: {
      course_id: courseId,
      id,
    },
    throwOnError: true,
  })
}

export const archiveCourseSuspectedCheaterMutationOptions = () =>
  archiveCourseSuspectedCheaterMutation()

export const approveSuspectedCheaters = async (courseId: string, id: string): Promise<void> => {
  await approveCourseSuspectedCheater({
    path: {
      course_id: courseId,
      id,
    },
    throwOnError: true,
  })
}

export const approveCourseSuspectedCheaterMutationOptions = () =>
  approveCourseSuspectedCheaterMutation()

export const fetchCourseWithJoinCode = async (joinCode: string): Promise<Course> => {
  const data = await getCourseByJoinCodeFromApi({
    path: {
      join_code: joinCode,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isCourse)
}

export const getCourseByJoinCodeOptions = (joinCode: string) =>
  queryOptions({
    ...getCourseByJoinCodeGeneratedOptions({
      path: {
        join_code: joinCode,
      },
    }),
    select: (data): Course => validateGeneratedData(data, isCourse),
  })

export const addUserToCourseWithJoinCode = async (courseId: string): Promise<string> => {
  const data = await joinCourseWithJoinCode({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isString)
}

export const joinCourseWithJoinCodeMutationOptions = () => joinCourseWithJoinCodeMutation()

export const setJoinCourseLinkForCourse = async (courseId: string): Promise<void> => {
  await setCourseJoinCode({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const setCourseJoinCodeMutationOptions = () => setCourseJoinCodeMutation()

export const setPartnerBlockForCourse = async (
  courseId: string,
  data: object | null,
): Promise<void> => {
  await upsertCoursePartnersBlock({
    body: data,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const upsertCoursePartnersBlockMutationOptions = () => upsertCoursePartnersBlockMutation()

export const fetchPartnersBlock = async (courseId: string): Promise<PartnersBlock> => {
  const data = await getCoursePartnersBlockFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isPartnersBlock)
}

export const getCoursePartnersBlockOptions = (courseId: string) =>
  queryOptions({
    ...getCoursePartnersBlockGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): PartnersBlock => validateGeneratedData(data, isPartnersBlock),
  })

export const deletePartnersBlock = async (courseId: string): Promise<void> => {
  await deleteCoursePartnersBlock({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const deleteCoursePartnersBlockMutationOptions = () => deleteCoursePartnersBlockMutation()

export const createCourseCopy = async (
  courseId: string,
  data: CopyCourseRequest,
): Promise<Course> => {
  const response = await createCourseCopyFromApi({
    body: data,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(response, isCourse)
}

export const createCourseCopyMutationOptions = () => createCourseCopyMutation()

export const createNewCourse = async (data: NewCourse): Promise<Course> => {
  const response = await createCourse({
    body: data,
    throwOnError: true,
  })

  return validateGeneratedData(response, isCourse)
}

export const createCourseMutationOptions = () => createCourseMutation()

export const getUserCourseSettingsForUser = async (
  courseId: string,
  userId: string,
): Promise<UserCourseSettings | null> => {
  const data = await getCourseUserSettingsForUserFromApi({
    path: {
      course_id: courseId,
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isUnion(isUserCourseSettings, isNull))
}

export const getUserCourseSettingsForUserOptions = (courseId: string, userId: string) =>
  queryOptions({
    ...getCourseUserSettingsForUserGeneratedOptions({
      path: {
        course_id: courseId,
        user_id: userId,
      },
    }),
    select: (data): UserCourseSettings | null =>
      validateGeneratedData(data, isUnion(isUserCourseSettings, isNull)),
  })

export const downloadCourseSubmissionsCsv = async (courseId: string): Promise<void> => {
  const csv = await exportCourseSubmissionsCsv({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  downloadTextFile(csv, `course-${courseId}-submissions.csv`)
}

export const downloadCourseUserDetailsCsv = async (courseId: string): Promise<void> => {
  const csv = await exportCourseUserDetailsCsv({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  downloadTextFile(csv, `course-${courseId}-user-details.csv`)
}

export const downloadCourseExerciseTasksCsv = async (courseId: string): Promise<void> => {
  const csv = await exportCourseExerciseTasksCsv({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  downloadTextFile(csv, `course-${courseId}-exercise-tasks.csv`)
}

export const downloadCourseInstancesCsv = async (courseId: string): Promise<void> => {
  const csv = await exportCourseInstancesCsv({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  downloadTextFile(csv, `course-${courseId}-instances.csv`)
}

export const downloadCourseUserConsentsCsv = async (courseId: string): Promise<void> => {
  const csv = await exportCourseUserConsentsCsv({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  downloadTextFile(csv, `course-${courseId}-user-consents.csv`)
}

export const downloadCourseUserExerciseStatesCsv = async (courseId: string): Promise<void> => {
  const csv = await exportCourseUserExerciseStatesCsv({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  downloadTextFile(csv, `course-${courseId}-user-exercise-states.csv`)
}
