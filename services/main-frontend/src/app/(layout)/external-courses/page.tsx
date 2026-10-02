"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { getExternalCoursesOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button } from "@/shared-module/components/"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"

import NewExternalCourseDialog from "./NewExternalCourseDialog"

const ExternalCourses = () => {
  const { t } = useTranslation()
  usePageTitle(t("external-courses"))
  const [newExternalCourseFormOpen, setNewExternalCourseFormOpen] = useState(false)

  const externalCoursesQuery = useQuery(getExternalCoursesOptions())

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
              <div key={course.id}>
                <h3>{course.name}</h3>

                {course.description && <p>{course.description}</p>}

                <a href={course.url} target="_blank" rel="noreferrer">
                  {course.url}
                </a>
              </div>
            ))}
          </div>
        )}
      </QueryResult>
    </div>
  )
}
export default withErrorBoundary(withSignedIn(ExternalCourses))
