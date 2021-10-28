import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from ".."
import CoursePageContext from "../../../contexts/CoursePageContext"
import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import GenericLoading from "../../GenericLoading"

import PagesInChapter from "./PagesInChapter"

const PagesInChapterBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  const chapterId = pageContext.pageData.chapter_id

  if (!chapterId) {
    return <pre>{t("error-page-does-not-belong-to-chapter")}</pre>
  }

  return (
    <div className={courseMaterialCenteredComponentStyles}>
      <PagesInChapter chapterId={chapterId} />
    </div>
  )
}

export default withErrorBoundary(PagesInChapterBlock)
