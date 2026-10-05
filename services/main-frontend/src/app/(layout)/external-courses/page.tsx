"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  deleteExternalCourseMutation,
  getExternalCoursesOptions,
  getExternalCoursesQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button } from "@/shared-module/components/"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"

import ExternalCourseCard from "./ExternalCourseCard"
import NewExternalCourseDialog from "./NewExternalCourseDialog"

const ExternalCourses = () => {
  const { t } = useTranslation()
  usePageTitle(t("external-courses"))
  const [newExternalCourseFormOpen, setNewExternalCourseFormOpen] = useState(false)
  const queryClient = useQueryClient()

  const externalCoursesQuery = useQuery(getExternalCoursesOptions())

  const deleteExternalCourse = useToastMutationOptions(
    deleteExternalCourseMutation(),
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getExternalCoursesQueryKey(),
        })
      },
    },
  )

  return (
    <div>
      <NewExternalCourseDialog
        open={newExternalCourseFormOpen}
        onClose={() => setNewExternalCourseFormOpen(false)}
      />
      <Button size="medium" variant="primary" onClick={() => setNewExternalCourseFormOpen(true)}>
        {t("button-text-create")}
      </Button>
      <QueryResult query={externalCoursesQuery} emptyFallback={<p>{t("no-external-courses")}</p>}>
        {(externalCourses) => (
          <div>
            {externalCourses.map((course) => (
              <ExternalCourseCard key={course.id} externalCourse={course} />
            ))}
          </div>
        )}
      </QueryResult>
    </div>
  )
}
export default withErrorBoundary(withSignedIn(ExternalCourses))
