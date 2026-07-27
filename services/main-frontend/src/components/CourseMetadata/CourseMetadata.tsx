"use client"

import { css } from "@emotion/css"
import type {
  QueryObserverResult,
  RefetchOptions,
  RefetchQueryFilters,
} from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { Course } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Button from "@/shared-module/common/components/Button"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"

import AIMetadataForm from "./AIMetadataForm/index"

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
          disabled={!hasCourseCode}
          variant="primary"
          size="medium"
          onClick={() => setShowForm(true)}
        >
          {t("generate-ai-metadata")}
        </Button>
        {!hasCourseCode && (
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
