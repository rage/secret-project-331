import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"

import PagesInChapter from "./PagesInChapter"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import dontRenderUntilQueryParametersReady from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const PagesInChapterBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)
  const courseSlug = useQueryParameter("courseSlug")
  const organizationSlug = useQueryParameter("organizationSlug")

  if (pageContext.state !== "ready") {
    return <Spinner variant={"medium"} />
  }
  const chapterId = pageContext.pageData.chapter_id

  if (!chapterId) {
    return <ErrorBanner variant={"readOnly"} error={t("error-page-does-not-belong-to-chapter")} />
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

export default withErrorBoundary(dontRenderUntilQueryParametersReady(PagesInChapterBlock))
