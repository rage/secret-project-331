import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import CoursePageContext from "../../../../contexts/CoursePageContext"
import useQueryParameter from "../../../../hooks/useQueryParameter"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import PagesInChapter from "./PagesInChapter"

const PagesInChapterBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(CoursePageContext)
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
    <div className={normalWidthCenteredComponentStyles}>
      <PagesInChapter
        chapterId={chapterId}
        organizationSlug={organizationSlug}
        courseSlug={courseSlug}
      />
    </div>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(PagesInChapterBlock))
