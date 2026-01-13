"use client"
import { useAtomValue } from "jotai"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import PagesInChapter from "./PagesInChapter"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { currentPageDataAtom, viewStatusAtom } from "@/state/course-material/selectors"

const PagesInChapterBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = () => {
  const { t } = useTranslation()
  const viewStatus = useAtomValue(viewStatusAtom)
  const pageData = useAtomValue(currentPageDataAtom)
  const params = useParams<{ organizationSlug: string; courseSlug: string }>()
  const courseSlug = params?.courseSlug
  const organizationSlug = params?.organizationSlug

  if (viewStatus !== "ready") {
    return <Spinner variant={"medium"} />
  }
  const chapterId = pageData?.chapter_id

  if (!chapterId) {
    return <ErrorBanner variant={"readOnly"} error={t("error-page-does-not-belong-to-chapter")} />
  }

  if (!courseSlug || !organizationSlug) {
    return <Spinner variant={"medium"} />
  }

  return (
    <div>
      <PagesInChapter
        chapterId={chapterId}
        organizationSlug={organizationSlug}
        courseSlug={courseSlug}
      />
    </div>
  )
}

export default withErrorBoundary(PagesInChapterBlock)
