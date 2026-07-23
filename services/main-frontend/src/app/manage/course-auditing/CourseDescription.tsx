"use client"

import { css } from "@emotion/css"
import type {
  QueryObserverResult,
  RefetchOptions,
  RefetchQueryFilters,
} from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { Course, CourseToAudit } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Button from "@/shared-module/common/components/Button"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"

import AIDescriptionForm from "../courses/[id]/overview/AIDescriptionForm"
import type { EditCourseAuditingData } from "./CourseAuditingCard"

interface Props {
  course: CourseToAudit
  refetch: (
    options?: (RefetchOptions & RefetchQueryFilters) | undefined,
  ) => Promise<QueryObserverResult<CourseToAudit, Error>>
}

const CourseDescription: React.FC<React.PropsWithChildren<Props>> = ({ course, refetch }) => {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)

  const handleOnUpdateCourse = async () => {
    await refetch()
  }

  return (
    <div>
      {course.uh_course_code ? (
        <Button
          className={css`
            margin: 0.5rem 0;
          `}
          variant="primary"
          size="medium"
          onClick={() => setShowForm(true)}
        >
          {t("generate-ai-description")}
        </Button>
      ) : (
        <div>
          <Button
            className={css`
              margin: 0.5rem 0;
            `}
            disabled
            variant="primary"
            size="medium"
            onClick={() => setShowForm(true)}
          >
            {t("generate-ai-description")}
          </Button>
          <GenericInfobox>{t("missing-uh-course-code-notification")}</GenericInfobox>
        </div>
      )}

      <AIDescriptionForm
        course={course}
        onSubmitForm={handleOnUpdateCourse}
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  )
}

export default CourseDescription
