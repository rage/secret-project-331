"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import AIDescriptionForm from "./AIDescriptionForm"

import type { Course } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Button from "@/shared-module/common/components/Button"
interface Props {
  course: Course
}
const CourseDescription: React.FC<React.PropsWithChildren<Props>> = ({ course }) => {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)

  const courseStructure = useCourseStructure(course.id)

  const hasCourseCode = courseStructure.data?.modules.every(
    (cm) => cm.uh_course_code !== null && cm.uh_course_code !== "",
  )
  const handleOnUpdateCourse = () => {
    console.log("123")
  }

  return (
    <div>
      {hasCourseCode ? (
        <Button variant="primary" size="medium" onClick={() => setShowForm(true)}>
          {t("generate-ai-description")}
        </Button>
      ) : (
        <Button disabled variant="primary" size="medium" onClick={() => setShowForm(true)}>
          {t("generate-ai-description")}
        </Button>
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
