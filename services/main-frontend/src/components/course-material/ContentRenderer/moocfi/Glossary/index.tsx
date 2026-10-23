"use client"

import { useAtomValue } from "jotai"
import React from "react"
import { useTranslation } from "react-i18next"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { LoadingRegion, ErrorNotice } from "@/shared-module/components"
import { courseMaterialAtom } from "@/state/course-material"
import { currentPageDataAtom } from "@/state/course-material/selectors"

import Glossary from "./Glossary"

const GlossaryBlock: React.FC = () => {
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const pageData = useAtomValue(currentPageDataAtom)

  if (courseMaterialState.status !== "ready") {
    return <LoadingRegion />
  }

  if (pageData?.course_id === null || pageData?.course_id === undefined) {
    return <ErrorNotice error={t("block-invalid-without-course")} />
  }

  return <Glossary courseId={pageData.course_id} />
}

export default withErrorBoundary(GlossaryBlock)
