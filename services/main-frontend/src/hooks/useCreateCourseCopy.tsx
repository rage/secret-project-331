import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { createCourseCopy } from "../services/backend/courses"

import { formatLanguageVersionsQueryKey } from "./useCourseLanguageVersions"
import { formatCourseQueryKey } from "./useCourseQuery"

import { CopyCourseRequest, Course } from "@/shared-module/common/bindings"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

export const useCreateCourseCopy = (courseId: string) => {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useToastMutation<Course, unknown, CopyCourseRequest>(
    (data) => createCourseCopy(courseId, data),
    {
      notify: true,
      method: "POST",
      successMessage: t("course-created-successfully"),
    },
    {
      onSuccess: async () => {
        queryClient.invalidateQueries({ queryKey: formatCourseQueryKey(courseId) })
        queryClient.invalidateQueries({ queryKey: [formatLanguageVersionsQueryKey(courseId)] })
      },
    },
  )
}
