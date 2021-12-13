import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import CoursePageContext from "../../../../contexts/CoursePageContext"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import GenericLoading from "../../../GenericLoading"

import PagesInChapter from "./PagesInChapter"

const PagesInChapterBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(CoursePageContext)
  const courseSlug = useQueryParameter("courseSlug")
  const organizationSlug = useQueryParameter("organizationSlug")

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  if (!courseSlug || !organizationSlug) {
    return <GenericLoading />
  }

  const chapterId = pageContext.pageData.chapter_id

  if (!chapterId) {
    return <pre>{t("error-page-does-not-belong-to-chapter")}</pre>
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

export default withErrorBoundary(PagesInChapterBlock)
