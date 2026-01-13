"use client"

import { useAtomValue } from "jotai"
import React from "react"
import { useTranslation } from "react-i18next"

import ChapterGrid from "./ChapterGrid"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { courseMaterialAtom } from "@/state/course-material"

const CourseChapterGridBlock: React.FC = () => {
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)

  if (courseMaterialState.status !== "ready") {
    return <Spinner variant={"small"} />
  }

  if (
    courseMaterialState.page?.course_id === null ||
    courseMaterialState.page?.course_id === undefined
  ) {
    return <div>{t("error-page-without-course")}</div>
  }

  return (
    <BreakFromCentered sidebar={false}>
      <div>
        <ChapterGrid courseId={courseMaterialState.page.course_id} />
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CourseChapterGridBlock)
