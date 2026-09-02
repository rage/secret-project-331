"use client"

import { css } from "@emotion/css"
import type {
  QueryObserverResult,
  RefetchOptions,
  RefetchQueryFilters,
} from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import AIMetadataForm from "@/components/forms/AIMetadataForm"
import type { Course } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Button from "@/shared-module/common/components/Button"
import { Infobox } from "@/shared-module/components"

interface Props {
  courseId: string
  refetch: (
    options?: (RefetchOptions & RefetchQueryFilters) | undefined,
  ) => Promise<QueryObserverResult<Course, Error>>
}

const CourseMetadata: React.FC<React.PropsWithChildren<Props>> = ({ courseId, refetch }) => {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)

  const courseStructure = useCourseStructure(courseId)

  const defaultModule = courseStructure.data?.modules.find((module) => module.order_number === 0)

  const structureLoaded = courseStructure.isSuccess
  const hasCourseCode =
    defaultModule?.uh_course_code !== null && defaultModule?.uh_course_code !== undefined

  const handleOnUpdateCourse = async () => {
    await refetch()
  }

  return (
    <div>
      <div>
        <Button
          className={css`
            margin: 0.5rem 0;
          `}
          disabled={!structureLoaded || !hasCourseCode}
          variant="primary"
          size="medium"
          onClick={() => setShowForm(true)}
        >
          {t("generate-ai-metadata")}
        </Button>
        {structureLoaded && !hasCourseCode && (
          <Infobox>{t("missing-uh-course-code-notification")}</Infobox>
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
