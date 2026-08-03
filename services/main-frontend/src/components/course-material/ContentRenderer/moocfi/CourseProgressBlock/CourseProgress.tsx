"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { UserCourseProgress } from "@/generated/course-material-api/types.generated"

import CourseModuleProgressBars from "./CourseModuleProgressBars"
import TempAccordionItem from "./TempAccordionItem"

export interface CourseProgressProps {
  userCourseProgress: UserCourseProgress[]
}

const CourseProgress: React.FC<React.PropsWithChildren<CourseProgressProps>> = ({
  userCourseProgress,
}) => {
  const [openedModule, setOpenedModule] = useState(0)
  const { t } = useTranslation()

  const handleAccordionToggle = (sourceId: number) => {
    setOpenedModule((prev) => (prev !== sourceId ? sourceId : -1))
  }

  return (
    <>
      <h2
        className={css`
          font-size: clamp(30px, 3.5vw, 46px);
          margin: 1rem;
          font-weight: 700;
          color: #1a2333;
          text-align: center;
          opacity: 0.9;
        `}
      >
        {t("track-your-progress")}
      </h2>
      {userCourseProgress
        .toSorted((a, b) => a.course_module_order_number - b.course_module_order_number)
        .map((courseModuleProgress) => (
          <TempAccordionItem
            onClick={() => handleAccordionToggle(courseModuleProgress.course_module_order_number)}
            open={openedModule === courseModuleProgress.course_module_order_number}
            title={courseModuleProgress.course_module_name}
            key={courseModuleProgress.course_module_id}
          >
            <CourseModuleProgressBars courseModuleProgress={courseModuleProgress} />
          </TempAccordionItem>
        ))}
    </>
  )
}

export default CourseProgress
