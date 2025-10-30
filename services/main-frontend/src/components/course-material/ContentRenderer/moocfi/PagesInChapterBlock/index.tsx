"use client"
import { useParams } from "next/navigation"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import PagesInChapter from "./PagesInChapter"

import PageContext from "@/contexts/course-material/PageContext"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const PagesInChapterBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)
  const params = useParams<{ organizationSlug: string; courseSlug: string }>()
  const courseSlug = params?.courseSlug
  const organizationSlug = params?.organizationSlug

  if (pageContext.state !== "ready") {
    return <Spinner variant={"medium"} />
  }
  const chapterId = pageContext.pageData.chapter_id

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
