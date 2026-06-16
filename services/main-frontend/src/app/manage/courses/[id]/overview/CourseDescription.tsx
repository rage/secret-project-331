"use client"

import { QueryObserverResult, RefetchOptions, RefetchQueryFilters } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import AIDescriptionForm from "./AIDescriptionForm"

import type { Course } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Button from "@/shared-module/common/components/Button"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"

interface Props {
  course: Course
  refetch: (
    options?: (RefetchOptions & RefetchQueryFilters) | undefined,
  ) => Promise<QueryObserverResult<Course, Error>>
}

const CourseDescription: React.FC<React.PropsWithChildren<Props>> = ({ course, refetch }) => {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)

  const courseStructure = useCourseStructure(course.id)

  const hasCourseCode = courseStructure.data?.modules.every(
    (cm) => cm.uh_course_code !== null && cm.uh_course_code !== "",
  )
  const handleOnUpdateCourse = async () => {
    await refetch()
  }

  return (
    <div>
      {hasCourseCode ? (
        <Button variant="primary" size="medium" onClick={() => setShowForm(true)}>
          {t("generate-ai-description")}
        </Button>
      ) : (
        <div>
          <Button disabled variant="primary" size="medium" onClick={() => setShowForm(true)}>
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
