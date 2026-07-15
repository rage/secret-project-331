"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { createCourse, createCourseCopy } from "@/generated/api/sdk.generated"
import type { CopyCourseMode, Course, NewCourse } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { normalizeIETFLanguageTag } from "@/shared-module/common/utils/strings"

import { invalidateCourseLanguageVersions } from "./useCourseLanguageVersions"
import { invalidateCourseQuery } from "./useCourseQuery"
import { invalidateOrganizationCourseCount } from "./useOrganizationCourseCount"
import { invalidateOrganizationCourses } from "./useOrganizationCourses"

export interface CreateCourseParams {
  organizationId: string
  courseId?: string
  isLanguageVersion?: boolean
  createDuplicate?: boolean
  createAsLanguageVersion?: boolean
  useExistingLanguageGroup?: boolean
  targetCourseId?: string
  data: Omit<NewCourse, "organization_id" | "language_code" | "can_add_chatbot">
  language_code: string
  onSuccess?: () => void
}

export const useCreateCourse = () => {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useToastMutation<Course, unknown, CreateCourseParams>(
    // oxlint-disable-next-line eslint/require-await -- kept async for the mutationFn Promise<Course> contract
    async (params) => {
      const {
        organizationId,
        courseId,
        isLanguageVersion,
        createDuplicate,
        createAsLanguageVersion,
        useExistingLanguageGroup,
        targetCourseId,
        data,
        language_code,
      } = params

      const normalizedLanguageCode = normalizeIETFLanguageTag(language_code)
      const newCourse: NewCourse = {
        ...data,
        organization_id: organizationId,
        language_code: normalizedLanguageCode,
        can_add_chatbot: false,
      }

      if (isLanguageVersion && courseId) {
        const mode = createLanguageVersionMode(Boolean(useExistingLanguageGroup), targetCourseId)

        return createCourseCopy({
          body: {
            ...newCourse,
            mode,
          },
          path: {
            course_id: courseId,
          },
        })
      }

      if (createDuplicate && courseId) {
        if (createAsLanguageVersion) {
          const mode = createLanguageVersionMode(Boolean(useExistingLanguageGroup), targetCourseId)

          return createCourseCopy({
            body: {
              ...newCourse,
              mode,
            },
            path: {
              course_id: courseId,
            },
          })
        }

        return createCourseCopy({
          body: {
            ...newCourse,
            // oxlint-disable-next-line i18next/no-literal-string
            mode: { mode: "duplicate" },
          },
          path: {
            course_id: courseId,
          },
        })
      }

      return createCourse({
        body: newCourse,
      })
    },
    {
      notify: true,
      method: "POST",
      successMessage: t("course-created-successfully"),
      errorMessage: t("error-creating-course"),
    },
    {
      // oxlint-disable-next-line eslint/require-await -- async; react-query awaits the onSuccess promise
      onSuccess: async (newCourse, params) => {
        invalidateCourseQueries(queryClient, newCourse.id, params.organizationId)
        if (params.onSuccess) {
          params.onSuccess()
        }
      },
    },
  )
}

function invalidateCourseQueries(
  queryClient: QueryClient,
  courseId: string,
  organizationId: string,
) {
  invalidateCourseQuery(queryClient, courseId)
  invalidateCourseLanguageVersions(queryClient, courseId)
  invalidateOrganizationCourses(queryClient, organizationId)
  invalidateOrganizationCourseCount(queryClient, organizationId)
}

function createLanguageVersionMode(
  useExistingLanguageGroup: boolean,
  targetCourseId?: string,
): CopyCourseMode {
  if (useExistingLanguageGroup && targetCourseId) {
    // oxlint-disable-next-line i18next/no-literal-string
    return { mode: "existing_language_group", target_course_id: targetCourseId }
  }
  // oxlint-disable-next-line i18next/no-literal-string
  return { mode: "same_language_group" }
}
