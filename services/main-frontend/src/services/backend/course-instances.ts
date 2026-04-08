import { queryOptions } from "@tanstack/react-query"
import { isBoolean } from "lodash"

import { downloadTextFile } from "./downloads"
import { validateGeneratedData } from "./generated"

import {
  createCourseInstanceCompletionsMutation,
  createCourseInstanceEmailTemplateMutation,
  deleteCourseInstanceMutation,
  editCourseInstanceMutation,
  getCourseInstanceCompletionsOptions as getCourseInstanceCompletionsGeneratedOptions,
  getCourseInstanceCourseModuleCompletionsForUserOptions as getCourseInstanceCourseModuleCompletionsForUserGeneratedOptions,
  getCourseInstanceDefaultCertificateConfigurationsOptions as getCourseInstanceDefaultCertificateConfigurationsGeneratedOptions,
  getCourseInstanceEmailTemplatesOptions as getCourseInstanceEmailTemplatesGeneratedOptions,
  getCourseInstanceExerciseStatusesForUserOptions as getCourseInstanceExerciseStatusesForUserGeneratedOptions,
  getCourseInstanceOptions as getCourseInstanceGeneratedOptions,
  getCourseInstancePointsOptions as getCourseInstancePointsGeneratedOptions,
  getCourseInstanceUserProgressOptions as getCourseInstanceUserProgressGeneratedOptions,
  previewCourseInstanceCompletionsMutation,
  reprocessCourseCompletionsMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  createCourseInstanceCompletions,
  createCourseInstanceEmailTemplate,
  deleteCourseInstance as deleteCourseInstanceFromApi,
  editCourseInstance as editCourseInstanceFromApi,
  exportCourseInstanceCompletionsCsv,
  exportCourseInstancePointsCsv,
  getCourseInstanceCompletions as getCourseInstanceCompletionsFromApi,
  getCourseInstanceCourseModuleCompletionsForUser as getCourseInstanceCourseModuleCompletionsForUserFromApi,
  getCourseInstanceDefaultCertificateConfigurations as getCourseInstanceDefaultCertificateConfigurationsFromApi,
  getCourseInstanceEmailTemplates as getCourseInstanceEmailTemplatesFromApi,
  getCourseInstanceExerciseStatusesForUser as getCourseInstanceExerciseStatusesForUserFromApi,
  getCourseInstance as getCourseInstanceFromApi,
  getCourseInstancePoints as getCourseInstancePointsFromApi,
  getCourseInstanceUserProgress as getCourseInstanceUserProgressFromApi,
  previewCourseInstanceCompletions as previewCourseInstanceCompletionsFromApi,
  reprocessCourseCompletions,
} from "@/generated/api/sdk.generated"
import {
  CertificateConfigurationAndRequirements,
  CourseInstance,
  CourseInstanceCompletionSummary,
  CourseInstanceForm,
  CourseModuleCompletion,
  EmailTemplate,
  EmailTemplateNew,
  ExerciseStatusSummaryForUser,
  ManualCompletionPreview,
  Points,
  TeacherManualCompletionRequest,
  UserCourseProgress,
} from "@/shared-module/common/bindings"
import {
  isCertificateConfigurationAndRequirements,
  isCourseInstance,
  isCourseInstanceCompletionSummary,
  isCourseModuleCompletion,
  isEmailTemplate,
  isExerciseStatusSummaryForUser,
  isManualCompletionPreview,
  isPoints,
  isUserCourseProgress,
} from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

export const fetchCourseInstance = async (courseInstanceId: string): Promise<CourseInstance> => {
  const data = await getCourseInstanceFromApi({
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isCourseInstance)
}

export const getCourseInstanceOptions = (courseInstanceId: string) =>
  queryOptions({
    ...getCourseInstanceGeneratedOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
    select: (data): CourseInstance => validateGeneratedData(data, isCourseInstance),
  })

export const postNewEmailTemplateForCourseInstance = async (
  courseInstanceId: string,
  data: EmailTemplateNew,
): Promise<EmailTemplate> => {
  const response = await createCourseInstanceEmailTemplate({
    body: data,
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(response, isEmailTemplate)
}

export const createCourseInstanceEmailTemplateMutationOptions = () =>
  createCourseInstanceEmailTemplateMutation()

export const postReprocessModuleCompletions = async (courseId: string): Promise<boolean> => {
  const data = await reprocessCourseCompletions({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isBoolean)
}

export const reprocessCourseCompletionsMutationOptions = () => reprocessCourseCompletionsMutation()

export const fetchCourseInstanceEmailTemplates = async (
  courseInstanceId: string,
): Promise<EmailTemplate[]> => {
  const data = await getCourseInstanceEmailTemplatesFromApi({
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isEmailTemplate))
}

export const getCourseInstanceEmailTemplatesOptions = (courseInstanceId: string) =>
  queryOptions({
    ...getCourseInstanceEmailTemplatesGeneratedOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
    select: (data): EmailTemplate[] => validateGeneratedData(data, isArray(isEmailTemplate)),
  })

export const getCompletions = async (
  courseInstanceId: string,
): Promise<CourseInstanceCompletionSummary> => {
  const data = await getCourseInstanceCompletionsFromApi({
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isCourseInstanceCompletionSummary)
}

export const getCourseInstanceCompletionsOptions = (courseInstanceId: string) =>
  queryOptions({
    ...getCourseInstanceCompletionsGeneratedOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
    select: (data): CourseInstanceCompletionSummary =>
      validateGeneratedData(data, isCourseInstanceCompletionSummary),
  })

export const postCompletionsPreview = async (
  courseInstanceId: string,
  data: TeacherManualCompletionRequest,
): Promise<ManualCompletionPreview> => {
  const response = await previewCourseInstanceCompletionsFromApi({
    body: data,
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(response, isManualCompletionPreview)
}

export const previewCourseInstanceCompletionsMutationOptions = () =>
  previewCourseInstanceCompletionsMutation()

export const postCompletions = async (
  courseInstanceId: string,
  data: TeacherManualCompletionRequest,
): Promise<void> => {
  await createCourseInstanceCompletions({
    body: data,
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })
}

export const createCourseInstanceCompletionsMutationOptions = () =>
  createCourseInstanceCompletionsMutation()

export const downloadCourseInstancePointsCsv = async (
  courseInstanceId: string,
  courseInstanceName?: string,
): Promise<void> => {
  const csv = await exportCourseInstancePointsCsv({
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })

  downloadTextFile(csv, `${courseInstanceName ?? `course-instance-${courseInstanceId}`}-points.csv`)
}

export const downloadCourseInstanceCompletionsCsv = async (
  courseInstanceId: string,
): Promise<void> => {
  const csv = await exportCourseInstanceCompletionsCsv({
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })

  downloadTextFile(csv, `completions-${courseInstanceId}.csv`)
}

export const getPoints = async (courseInstanceId: string): Promise<Points> => {
  const data = await getCourseInstancePointsFromApi({
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isPoints)
}

export const getCourseInstancePointsOptions = (courseInstanceId: string) =>
  queryOptions({
    ...getCourseInstancePointsGeneratedOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
    select: (data): Points => validateGeneratedData(data, isPoints),
  })

export const getAllExerciseStatusSummariesForUserAndCourseInstance = async (
  courseInstanceId: string,
  userId: string,
): Promise<ExerciseStatusSummaryForUser[]> => {
  const data = await getCourseInstanceExerciseStatusesForUserFromApi({
    path: {
      course_instance_id: courseInstanceId,
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExerciseStatusSummaryForUser))
}

export const getCourseInstanceExerciseStatusesForUserOptions = (
  courseInstanceId: string,
  userId: string,
) =>
  queryOptions({
    ...getCourseInstanceExerciseStatusesForUserGeneratedOptions({
      path: {
        course_instance_id: courseInstanceId,
        user_id: userId,
      },
    }),
    select: (data): ExerciseStatusSummaryForUser[] =>
      validateGeneratedData(data, isArray(isExerciseStatusSummaryForUser)),
  })

export const getAllCourseModuleCompletionsForUserAndCourseInstance = async (
  courseInstanceId: string,
  userId: string,
): Promise<CourseModuleCompletion[]> => {
  const data = await getCourseInstanceCourseModuleCompletionsForUserFromApi({
    path: {
      course_instance_id: courseInstanceId,
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourseModuleCompletion))
}

export const getCourseInstanceCourseModuleCompletionsForUserOptions = (
  courseInstanceId: string,
  userId: string,
) =>
  queryOptions({
    ...getCourseInstanceCourseModuleCompletionsForUserGeneratedOptions({
      path: {
        course_instance_id: courseInstanceId,
        user_id: userId,
      },
    }),
    select: (data): CourseModuleCompletion[] =>
      validateGeneratedData(data, isArray(isCourseModuleCompletion)),
  })

export const getUserProgressForCourseInstance = async (
  courseInstanceId: string,
  userId: string,
): Promise<UserCourseProgress[]> => {
  const data = await getCourseInstanceUserProgressFromApi({
    path: {
      course_instance_id: courseInstanceId,
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isUserCourseProgress))
}

export const getCourseInstanceUserProgressOptions = (courseInstanceId: string, userId: string) =>
  queryOptions({
    ...getCourseInstanceUserProgressGeneratedOptions({
      path: {
        course_instance_id: courseInstanceId,
        user_id: userId,
      },
    }),
    select: (data): UserCourseProgress[] =>
      validateGeneratedData(data, isArray(isUserCourseProgress)),
  })

export const editCourseInstance = async (
  courseInstanceId: string,
  update: CourseInstanceForm,
): Promise<void> => {
  await editCourseInstanceFromApi({
    body: update,
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })
}

export const editCourseInstanceMutationOptions = () => editCourseInstanceMutation()

export const deleteCourseInstance = async (courseInstanceId: string): Promise<void> => {
  await deleteCourseInstanceFromApi({
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })
}

export const deleteCourseInstanceMutationOptions = () => deleteCourseInstanceMutation()

export const fetchDefaultCertificateConfigurations = async (
  courseInstanceId: string,
): Promise<Array<CertificateConfigurationAndRequirements>> => {
  const data = await getCourseInstanceDefaultCertificateConfigurationsFromApi({
    path: {
      course_instance_id: courseInstanceId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCertificateConfigurationAndRequirements))
}

export const getCourseInstanceDefaultCertificateConfigurationsOptions = (
  courseInstanceId: string,
) =>
  queryOptions({
    ...getCourseInstanceDefaultCertificateConfigurationsGeneratedOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
    select: (data): CertificateConfigurationAndRequirements[] =>
      validateGeneratedData(data, isArray(isCertificateConfigurationAndRequirements)),
  })
