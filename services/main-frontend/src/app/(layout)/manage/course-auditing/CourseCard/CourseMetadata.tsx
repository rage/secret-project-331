"use client"

import { css } from "@emotion/css"
import type { QueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import type { UseFormReset } from "react-hook-form"
import { useTranslation } from "react-i18next"

import AIMetadataForm from "@/components/forms/AIMetadataForm"
import { getCoursesForAuditingQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseAuditingData,
  CourseMetadata as CourseMetadataData,
} from "@/generated/api/types.generated"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import { undefinedToNull } from "@/shared-module/common/utils/nullability"
import { Button } from "@/shared-module/components"

import { buildFormValues, type EditCourseAuditingData } from "./CourseCard"

interface Props {
  courseId: string
  defaultModuleUhCourseCode: string | null | undefined
  reset: UseFormReset<EditCourseAuditingData>
  courseAuditingData: CourseAuditingData
  queryClient: QueryClient
}

const CourseMetadata: React.FC<Props> = ({
  courseId,
  defaultModuleUhCourseCode,
  reset,
  courseAuditingData: courseAuditingdata,
  queryClient,
}) => {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)

  const handleOnUpdateCourse = (data: CourseMetadataData) => {
    const updatedData = {
      ...courseAuditingdata,
      description: undefinedToNull(data.course_description),
      prerequisites: data.course_prerequisites,
      audiences: data.course_audiences,
      updated_at: data.course_updated_at,
    }

    reset(buildFormValues(updatedData))

    queryClient.setQueryData(getCoursesForAuditingQueryKey(), (old: CourseAuditingData[]) => {
      if (!old) {
        return []
      }
      return old.map((o) => (o.id === updatedData.id ? updatedData : o))
    })
  }

  return (
    <div>
      <div>
        <Button
          className={css`
            margin: 0.5rem 0;
          `}
          disabled={!defaultModuleUhCourseCode}
          variant="primary"
          size="medium"
          onClick={() => setShowForm(true)}
        >
          {t("generate-ai-metadata")}
        </Button>
        {!defaultModuleUhCourseCode && (
          <GenericInfobox>{t("missing-uh-course-code-notification")}</GenericInfobox>
        )}
      </div>

      <AIMetadataForm
        courseId={courseId}
        onSubmitForm={handleOnUpdateCourse}
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  )
}

export default CourseMetadata
