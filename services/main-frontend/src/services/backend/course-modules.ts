import { queryOptions, UseMutationOptions } from "@tanstack/react-query"

import {
  createCourseModuleThresholdMutation,
  deleteCourseModuleThresholdMutation,
  getCourseModuleCompletionOptions as getCourseModuleCompletionGeneratedOptions,
  getCourseModuleCompletionRegistrationLinkOptions as getCourseModuleCompletionRegistrationLinkGeneratedOptions,
  getCourseModuleOptions as getCourseModuleGeneratedOptions,
  getCourseModuleUserCompletionOptions as getCourseModuleUserCompletionGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  getCourseModuleCompletion as getCourseModuleCompletionFromApi,
  getCourseModuleCompletionRegistrationLink as getCourseModuleCompletionRegistrationLinkFromApi,
  getCourseModule as getCourseModuleFromApi,
  getCourseModuleUserCompletion as getCourseModuleUserCompletionFromApi,
  setCourseModuleCertificateGeneration as setCourseModuleCertificateGenerationFromApi,
  updateCourseModules,
} from "@/generated/api/sdk.generated"
import type {
  CompletionRegistrationLink as GeneratedCompletionRegistrationLink,
  CourseModule as GeneratedCourseModule,
  CourseModuleCompletion as GeneratedCourseModuleCompletion,
  UserCompletionInformation as GeneratedUserCompletionInformation,
} from "@/generated/api/types.generated"
import type {
  AutomaticCompletionRequirements,
  CompletionPolicy,
  CompletionRegistrationLink,
  CourseModule,
  CourseModuleCompletion,
  ModifiedModule,
  ModuleUpdates,
  NewModule,
  UserCompletionInformation,
} from "@/shared-module/common/bindings"

const normalizeCompletionPolicy = (
  completionPolicy: GeneratedCourseModule["completion_policy"],
): CompletionPolicy => {
  if (completionPolicy.policy === "manual") {
    return { policy: "manual" }
  }

  const requirements: AutomaticCompletionRequirements = {
    ...completionPolicy,
    number_of_exercises_attempted_treshold:
      completionPolicy.number_of_exercises_attempted_treshold ?? null,
    number_of_points_treshold: completionPolicy.number_of_points_treshold ?? null,
  }

  return {
    policy: "automatic",
    ...requirements,
  }
}

const normalizeCourseModule = (courseModule: GeneratedCourseModule): CourseModule => ({
  ...courseModule,
  completion_policy: normalizeCompletionPolicy(courseModule.completion_policy),
  completion_registration_link_override: courseModule.completion_registration_link_override ?? null,
  copied_from: courseModule.copied_from ?? null,
  deleted_at: courseModule.deleted_at ?? null,
  ects_credits: courseModule.ects_credits ?? null,
  name: courseModule.name ?? null,
  uh_course_code: courseModule.uh_course_code ?? null,
})

const normalizeCourseModuleCompletion = (
  courseModuleCompletion: GeneratedCourseModuleCompletion,
): CourseModuleCompletion => ({
  ...courseModuleCompletion,
  completion_granter_user_id: courseModuleCompletion.completion_granter_user_id ?? null,
  completion_registration_attempt_date:
    courseModuleCompletion.completion_registration_attempt_date ?? null,
  deleted_at: courseModuleCompletion.deleted_at ?? null,
  grade: courseModuleCompletion.grade ?? null,
})

const normalizeUserCompletionInformation = (
  userCompletionInformation: GeneratedUserCompletionInformation,
): UserCompletionInformation => ({
  ...userCompletionInformation,
  ects_credits: userCompletionInformation.ects_credits ?? null,
})

const normalizeCompletionRegistrationLink = (
  completionRegistrationLink: GeneratedCompletionRegistrationLink,
): CompletionRegistrationLink => completionRegistrationLink

type SetCertificationGenerationVariables = {
  id: string
  enabled: boolean
}

export const getCourseModuleOptions = (id: string) =>
  queryOptions({
    ...getCourseModuleGeneratedOptions({
      path: {
        course_module_id: id,
      },
    }),
    select: (courseModule): CourseModule => normalizeCourseModule(courseModule),
  })

export const fetchCourseModule = async (id: string): Promise<CourseModule> => {
  const courseModule = await getCourseModuleFromApi({
    path: {
      course_module_id: id,
    },
    throwOnError: true,
  })

  return normalizeCourseModule(courseModule)
}

export const getCourseModuleUserCompletionOptions = (courseModuleId: string) =>
  queryOptions({
    ...getCourseModuleUserCompletionGeneratedOptions({
      path: {
        course_module_id: courseModuleId,
      },
    }),
    select: (userCompletionInformation): UserCompletionInformation =>
      normalizeUserCompletionInformation(userCompletionInformation),
  })

export const fetchUserCompletionInformation = async (
  courseModuleId: string,
): Promise<UserCompletionInformation> => {
  const userCompletionInformation = await getCourseModuleUserCompletionFromApi({
    path: {
      course_module_id: courseModuleId,
    },
    throwOnError: true,
  })

  return normalizeUserCompletionInformation(userCompletionInformation)
}

export const getCourseModuleCompletionRegistrationLinkOptions = (courseModuleId: string) =>
  queryOptions({
    ...getCourseModuleCompletionRegistrationLinkGeneratedOptions({
      path: {
        course_module_id: courseModuleId,
      },
    }),
    select: (completionRegistrationLink): CompletionRegistrationLink =>
      normalizeCompletionRegistrationLink(completionRegistrationLink),
  })

export const fetchCompletionRegistrationLink = async (
  courseModuleId: string,
): Promise<CompletionRegistrationLink> => {
  const completionRegistrationLink = await getCourseModuleCompletionRegistrationLinkFromApi({
    path: {
      course_module_id: courseModuleId,
    },
    throwOnError: true,
  })

  return normalizeCompletionRegistrationLink(completionRegistrationLink)
}

export const submitChanges = async (
  courseId: string,
  newModules: NewModule[],
  deletedModules: string[],
  modifiedModules: ModifiedModule[],
  movedChapters: Array<[string, string]>,
): Promise<void> => {
  const data: ModuleUpdates = {
    new_modules: newModules,
    deleted_modules: deletedModules,
    modified_modules: modifiedModules,
    moved_chapters: movedChapters,
  }
  await updateCourseModules({
    body: data,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const setCertificationGeneration = async (id: string, enable: boolean): Promise<boolean> => {
  return await setCourseModuleCertificateGenerationFromApi({
    path: {
      course_module_id: id,
      enabled: enable,
    },
    throwOnError: true,
  })
}

export const setCourseModuleCertificateGenerationMutationOptions = (): UseMutationOptions<
  boolean,
  unknown,
  SetCertificationGenerationVariables
> => ({
  mutationFn: async ({ id, enabled }) =>
    setCourseModuleCertificateGenerationFromApi({
      path: {
        course_module_id: id,
        enabled,
      },
      throwOnError: true,
    }),
})

export const getCourseModuleCompletionOptions = (courseModuleId: string) =>
  queryOptions({
    ...getCourseModuleCompletionGeneratedOptions({
      path: {
        course_module_id: courseModuleId,
      },
    }),
    select: (courseModuleCompletion): CourseModuleCompletion | null =>
      courseModuleCompletion ? normalizeCourseModuleCompletion(courseModuleCompletion) : null,
  })

export const fetchUserCourseModuleCompletion = async (
  courseModuleId: string,
): Promise<CourseModuleCompletion | null> => {
  const courseModuleCompletion = await getCourseModuleCompletionFromApi({
    path: {
      course_module_id: courseModuleId,
    },
    throwOnError: true,
  })

  return courseModuleCompletion ? normalizeCourseModuleCompletion(courseModuleCompletion) : null
}

export const createCourseModuleThresholdMutationOptions = () =>
  createCourseModuleThresholdMutation()

export const deleteCourseModuleThresholdMutationOptions = () =>
  deleteCourseModuleThresholdMutation()
