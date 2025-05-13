import { QueryClient, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { createCourseCopy, createNewCourse } from "../services/backend/courses"

import { formatLanguageVersionsQueryKey } from "./useCourseLanguageVersions"
import { formatCourseQueryKey } from "./useCourseQuery"

import { CopyCourseMode, Course, NewCourse } from "@/shared-module/common/bindings"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { normalizeIETFLanguageTag } from "@/shared-module/common/utils/strings"

export interface CreateCourseParams {
  organizationId: string
  courseId?: string
  isLanguageVersion?: boolean
  createDuplicate?: boolean
  createAsLanguageVersion?: boolean
  useExistingLanguageGroup?: boolean
  targetCourseId?: string
  data: Omit<NewCourse, "organization_id" | "language_code">
  language_code: string
  onSuccess?: () => void
  onClose: () => void
}

export const useCreateCourse = () => {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useToastMutation<Course, unknown, CreateCourseParams>(
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
      }

      if (isLanguageVersion && courseId) {
        const mode = createLanguageVersionMode(Boolean(useExistingLanguageGroup), targetCourseId)

        return createCourseCopy(courseId, {
          ...newCourse,
          mode,
        })
      }

      if (createDuplicate && courseId) {
        if (createAsLanguageVersion) {
          const mode = createLanguageVersionMode(Boolean(useExistingLanguageGroup), targetCourseId)

          return createCourseCopy(courseId, {
            ...newCourse,
            mode,
          })
        }

        return createCourseCopy(courseId, {
          ...newCourse,
          // eslint-disable-next-line i18next/no-literal-string
          mode: { mode: "duplicate" },
        })
      }

      return createNewCourse(newCourse)
    },
    {
      notify: true,
      method: "POST",
      successMessage: t("course-created-successfully"),
      errorMessage: t("error-creating-course"),
    },
    {
      onSuccess: async (newCourse, params) => {
        invalidateCourseQueries(queryClient, newCourse.id)
        if (params.onSuccess) {
          params.onSuccess()
        }
        params.onClose()
      },
    },
  )
}

function invalidateCourseQueries(queryClient: QueryClient, courseId: string) {
  queryClient.invalidateQueries({ queryKey: formatCourseQueryKey(courseId) })
  queryClient.invalidateQueries({ queryKey: [formatLanguageVersionsQueryKey(courseId)] })
}

function createLanguageVersionMode(
  useExistingLanguageGroup: boolean,
  targetCourseId?: string,
): CopyCourseMode {
  if (useExistingLanguageGroup && targetCourseId) {
    // eslint-disable-next-line i18next/no-literal-string
    return { mode: "existing_language_group", target_course_id: targetCourseId }
  } else {
    // eslint-disable-next-line i18next/no-literal-string
    return { mode: "same_language_group" }
  }
}
