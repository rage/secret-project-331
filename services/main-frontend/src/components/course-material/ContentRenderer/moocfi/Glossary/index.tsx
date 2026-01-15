"use client"

import { useAtomValue } from "jotai"
import React from "react"
import { useTranslation } from "react-i18next"

import Glossary from "./Glossary"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { courseMaterialAtom } from "@/state/course-material"
import { currentPageDataAtom } from "@/state/course-material/selectors"

const GlossaryBlock: React.FC = () => {
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const pageData = useAtomValue(currentPageDataAtom)

  if (courseMaterialState.status !== "ready") {
    return <Spinner variant="small" />
  }

  if (pageData?.course_id === null || pageData?.course_id === undefined) {
    return <ErrorBanner variant="readOnly" error={t("block-invalid-without-course")} />
  }

  return <Glossary courseId={pageData.course_id} />
}

export default withErrorBoundary(GlossaryBlock)
