"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { getExternalCoursesOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button } from "@/shared-module/components/"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"

import ExternalCourseCard from "./ExternalCourseCard"
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
      <h1>{t("title-external-courses")}</h1>
      <div
        className={css`
          margin-top: 0.5rem;
          margin-bottom: 1rem;
        `}
      >
        <Button size="medium" variant="primary" onClick={() => setNewExternalCourseFormOpen(true)}>
          {t("button-text-create")}
        </Button>
      </div>

      <QueryResult query={externalCoursesQuery} emptyFallback={<p>{t("no-external-courses")}</p>}>
        {(externalCourses) => (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
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
